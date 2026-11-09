import { constants, createReadStream, writeFileSync } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  realpath,
  writeFile,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { checkMacArchitecture } from "./mach-o";
import { macInstallScript, type MacInstallJob } from "./mac-install-script";
import type { MacUpdateArtifact } from "./mac-downloader";

const exec = promisify(execFile);
export type MacCommandRunner = (
  command: string,
  args: string[],
) => Promise<string>;
const runCommand: MacCommandRunner = async (command, args) =>
  (await exec(command, args, { encoding: "utf8", maxBuffer: 1024 * 1024 }))
    .stdout;
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
const appleString = (value: string) =>
  '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
const inside = (root: string, file: string) => {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return (
    relative === "" ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
};

interface BundleInfo {
  CFBundleIdentifier: string;
  CFBundleShortVersionString: string;
  CFBundleExecutable: string;
}
interface PendingJob extends MacInstallJob {
  directory: string;
  script: string;
  log: string;
}

export class MacUpdateInstaller {
  private pending?: PendingJob;
  private cancelled = false;
  private readonly jobs: string;
  private readonly current: string;

  constructor(
    root: string,
    private readonly executable = process.execPath,
    private readonly run: MacCommandRunner = runCommand,
  ) {
    this.jobs = path.join(root, "mac-updates");
    this.current = path.join(this.jobs, "current.json");
  }

  private bundlePath() {
    const marker = `${path.sep}Contents${path.sep}MacOS${path.sep}`;
    const index = this.executable.lastIndexOf(marker);
    if (index < 0)
      throw Error(
        "Update the installed HighTex application, not a development build.",
      );
    const target = this.executable.slice(0, index);
    if (
      !target.endsWith(".app") ||
      target.startsWith("/Volumes/") ||
      target.includes("/AppTranslocation/")
    )
      throw Error(
        "Move HighTex to Applications before installing this update.",
      );
    return target;
  }

  private async info(bundle: string): Promise<BundleInfo> {
    if (!(await lstat(bundle)).isDirectory())
      throw Error("The update does not contain a valid application bundle.");
    const json = await this.run("/usr/bin/plutil", [
      "-convert",
      "json",
      "-o",
      "-",
      path.join(bundle, "Contents", "Info.plist"),
    ]);
    const info = JSON.parse(json) as BundleInfo;
    if (
      typeof info.CFBundleIdentifier !== "string" ||
      !info.CFBundleIdentifier ||
      typeof info.CFBundleExecutable !== "string" ||
      !info.CFBundleExecutable ||
      info.CFBundleExecutable !== path.basename(info.CFBundleExecutable)
    )
      throw Error("The update belongs to a different application.");
    return info;
  }

  private async validateBundle(
    bundle: string,
    version: string,
    arch: string,
    identifier: string,
  ) {
    const info = await this.info(bundle);
    if (info.CFBundleIdentifier !== identifier)
      throw Error("The update belongs to a different application.");
    if (info.CFBundleShortVersionString !== version)
      throw Error(
        "The downloaded application version does not match the update.",
      );
    const root = await realpath(bundle);
    const visit = async (directory: string) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) {
          if (!inside(root, await realpath(file)))
            throw Error(
              "The update contains a link outside its application bundle.",
            );
        } else if (entry.isDirectory()) await visit(file);
      }
    };
    await visit(bundle);
    const executable = path.join(
      bundle,
      "Contents",
      "MacOS",
      info.CFBundleExecutable,
    );
    if (!inside(root, await realpath(executable)))
      throw Error("Invalid application executable.");
    await checkMacArchitecture(executable, arch);
  }

  async prepare(
    artifact: MacUpdateArtifact,
    arch = process.arch,
  ): Promise<void> {
    this.abortHelper();
    this.pending = undefined;
    this.cancelled = false;
    const target = this.bundlePath();
    const current = await this.info(target);
    if (!artifact.file.toLowerCase().endsWith(".dmg"))
      throw Error("A macOS disk image is required for this update.");
    const digest = Buffer.from(artifact.sha512, "base64");
    if (digest.length !== 64 || digest.toString("base64") !== artifact.sha512)
      throw Error("The update checksum is invalid.");
    await mkdir(this.jobs, { recursive: true, mode: 0o700 });
    const directory = await mkdtemp(path.join(this.jobs, "install-"));
    await chmod(directory, 0o700);
    let mounted = false;
    try {
      const image = path.join(directory, "update.dmg");
      await copyFile(artifact.file, image);
      const hash = createHash("sha512");
      for await (const chunk of createReadStream(image)) hash.update(chunk);
      if (hash.digest("base64") !== artifact.sha512)
        throw Error("The downloaded update failed its checksum check.");
      const mount = path.join(directory, "mounted");
      await mkdir(mount);
      const source = path.join(directory, path.basename(target));
      try {
        await this.run("/usr/bin/hdiutil", [
          "attach",
          "-readonly",
          "-nobrowse",
          "-quiet",
          "-mountpoint",
          mount,
          image,
        ]);
        mounted = true;
        const candidates: string[] = [];
        for (const entry of await readdir(mount, { withFileTypes: true })) {
          if (!entry.isDirectory() || !entry.name.endsWith(".app")) continue;
          const candidate = path.join(mount, entry.name);
          const info = await this.info(candidate);
          if (info.CFBundleIdentifier === current.CFBundleIdentifier)
            candidates.push(candidate);
        }
        if (candidates.length !== 1)
          throw Error(
            "The installer does not contain a unique matching application.",
          );
        const bundle = candidates[0];
        await this.validateBundle(
          bundle,
          artifact.version,
          arch,
          current.CFBundleIdentifier,
        );
        await this.run("/usr/bin/ditto", [bundle, source]);
        await this.validateBundle(
          source,
          artifact.version,
          arch,
          current.CFBundleIdentifier,
        );
      } finally {
        if (mounted) {
          await this.run("/usr/bin/hdiutil", ["detach", "-quiet", mount]);
          mounted = false;
        }
      }
      const job: PendingJob = {
        directory,
        source,
        target,
        version: artifact.version,
        nonce: randomUUID(),
        pid: process.pid,
        uid: process.getuid!(),
        script: path.join(directory, "install.sh"),
        log: path.join(directory, "install.log"),
        ready: path.join(directory, "ready"),
        commit: path.join(directory, "commit"),
        abort: path.join(directory, "abort"),
        ack: path.join(directory, "ack"),
        result: path.join(directory, "result"),
      };
      if (!job.uid)
        throw Error("Run HighTex as your regular macOS user before updating.");
      await Promise.all(
        [job.ready, job.commit, job.abort, job.ack].map((file) =>
          writeFile(file, "", { mode: 0o600 }),
        ),
      );
      await writeFile(job.result, "prepared", { mode: 0o600 });
      await writeFile(job.script, macInstallScript(job), { mode: 0o700 });
      await writeFile(this.current, JSON.stringify(job), { mode: 0o600 });
      this.pending = job;
      if (this.cancelled) {
        this.abortHelper();
        throw Error("Update installation cancelled.");
      }
    } catch (error) {
      if (!mounted && !this.pending)
        await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  async launch(): Promise<void> {
    const job = this.pending;
    if (!job) throw Error("The update is not prepared.");
    let elevated = false;
    try {
      await access(path.dirname(job.target), constants.W_OK);
    } catch {
      elevated = true;
    }
    const log = await open(job.log, "a", 0o600);
    const command = `/bin/bash ${quote(job.script)}`;
    const child = elevated
      ? spawn(
          "/usr/bin/osascript",
          [
            "-e",
            `do shell script ${appleString(command)} with administrator privileges`,
          ],
          { detached: true, stdio: ["ignore", log.fd, log.fd] },
        )
      : spawn("/bin/bash", [job.script], {
          detached: true,
          stdio: ["ignore", log.fd, log.fd],
        });
    await log.close();
    let exit: Error | undefined;
    child.once("error", (error) => {
      exit = error;
    });
    child.once("exit", () => {
      exit ??= Error(
        "The update helper stopped before installation was ready. Authorization may have been cancelled.",
      );
    });
    try {
      const deadline = Date.now() + 120000;
      while ((await readFile(job.ready, "utf8")) !== job.nonce) {
        if (exit) throw exit;
        if (Date.now() > deadline)
          throw Error("Waiting for update authorization timed out.");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      child.unref();
    } catch (error) {
      this.abortHelper();
      child.kill();
      throw error;
    }
  }

  /** Only Electron's final quit event authorizes replacement; a cancelled quit never does. */
  commitQuit() {
    if (this.pending && !this.cancelled)
      writeFileSync(this.pending.commit, this.pending.nonce, { mode: 0o600 });
  }

  cancel() {
    this.cancelled = true;
    this.abortHelper();
  }

  private abortHelper() {
    if (this.pending) {
      try {
        writeFileSync(this.pending.abort, this.pending.nonce, { mode: 0o600 });
      } catch {
        /* Without the quit commit an aborted helper cannot replace the app. */
      }
    }
  }

  get wasCancelled() {
    return this.cancelled;
  }

  async acknowledgeLaunch(version: string): Promise<string | undefined> {
    let job: PendingJob;
    try {
      job = JSON.parse(await readFile(this.current, "utf8")) as PendingJob;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    // Treat persisted update metadata as paths, never commands; keep every marker inside its job.
    if (
      typeof job.directory !== "string" ||
      !inside(this.jobs, job.directory) ||
      !/^[a-f0-9-]{36}$/.test(job.nonce) ||
      [job.ack, job.result].some(
        (file) => typeof file !== "string" || !inside(job.directory, file),
      )
    )
      throw Error("Invalid saved update state.");
    const result = await readFile(job.result, "utf8");
    if (
      result === "installed" &&
      job.version === version &&
      job.target === this.bundlePath()
    ) {
      await writeFile(job.ack, job.nonce, { mode: 0o600 });
      return;
    }
    if (
      [
        "rolled-back",
        "rollback-failed",
        "copy-failed",
        "backup-failed",
        "replace-failed",
        "invalid-target",
        "quit-timeout",
      ].includes(result)
    )
      return result;
  }
}
