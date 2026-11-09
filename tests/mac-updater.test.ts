import { afterEach, expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import {
  macInstallScript,
  type MacInstallJob,
} from "../electron/updater/mac-install-script";
import { machoArchitectures } from "../electron/updater/mach-o";
import {
  MacUpdateInstaller,
  type MacCommandRunner,
} from "../electron/updater/mac-installer";

const exec = promisify(execFile);
const directories: string[] = [];
const children: ChildProcess[] = [];
afterEach(async () => {
  for (const child of children.splice(0)) child.kill("SIGKILL");
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function directory() {
  const root = await mkdtemp(path.join(tmpdir(), "hightex-updater-test-"));
  directories.push(root);
  return root;
}
async function until(action: () => Promise<boolean>) {
  const end = Date.now() + 5000;
  while (!(await action())) {
    if (Date.now() > end) throw Error("Installer test timed out");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
const exits = (child: ChildProcess) =>
  new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
async function helperFixture(successfulLaunch = true, copyFails = false) {
  const root = await directory();
  // These characters must remain literal in every shell/AppleScript argument.
  const target = path.join(root, "HighTex's $(touch SHOULD_NOT_EXIST).app");
  const source = path.join(root, "replacement.app");
  await mkdir(target);
  await mkdir(source);
  await writeFile(path.join(target, "version"), "old");
  await writeFile(path.join(source, "version"), "new");
  const parent = spawn("/bin/sleep", ["60"]);
  children.push(parent);
  const job: MacInstallJob = {
    nonce: randomUUID(),
    pid: parent.pid!,
    uid: process.getuid!(),
    version: "2.0.0",
    target,
    source,
    ready: path.join(root, "ready"),
    commit: path.join(root, "commit"),
    abort: path.join(root, "abort"),
    ack: path.join(root, "ack"),
    result: path.join(root, "result"),
  };
  await Promise.all(
    [job.ready, job.commit, job.abort, job.ack, job.result].map((file) =>
      writeFile(file, ""),
    ),
  );
  const opener = path.join(root, "open.sh");
  await writeFile(
    opener,
    successfulLaunch
      ? `#!/bin/sh\nprintf '%s' ${quote(job.nonce)} > ${quote(job.ack)}\n`
      : "#!/bin/sh\nexit 1\n",
  );
  const script = path.join(root, "install.sh");
  await writeFile(
    script,
    macInstallScript(job, {
      copy: copyFails ? ["/usr/bin/false"] : ["/bin/cp", "-R"],
      open: ["/bin/sh", opener],
      sleep: 0.02,
      quitAttempts: 200,
      launchAttempts: 10,
    }),
  );
  const helper = spawn("/bin/bash", [script], { stdio: "pipe", cwd: root });
  children.push(helper);
  const finished = exits(helper);
  await until(async () => (await readFile(job.ready, "utf8")) === job.nonce);
  return { root, target, source, parent, job, finished };
}

test("installer waits for process exit and committed quit, then replaces atomically and confirms launch", async () => {
  const f = await helperFixture();
  expect(await readFile(path.join(f.target, "version"), "utf8")).toBe("old");
  await writeFile(f.job.commit, f.job.nonce);
  expect(await readFile(path.join(f.target, "version"), "utf8")).toBe("old");
  f.parent.kill();
  expect(await f.finished).toBe(0);
  expect(await readFile(path.join(f.target, "version"), "utf8")).toBe("new");
  expect(await readFile(f.job.result, "utf8")).toBe("complete");
  expect(
    await access(f.target + ".hightex-backup-" + f.job.nonce).then(
      () => true,
      () => false,
    ),
  ).toBe(false);
  expect(
    await access(path.join(f.root, "SHOULD_NOT_EXIST")).then(
      () => true,
      () => false,
    ),
  ).toBe(false);
});

test("cancelled close never replaces the app, even if it quits later", async () => {
  const f = await helperFixture();
  await writeFile(f.job.abort, f.job.nonce);
  expect(await f.finished).toBe(0);
  await writeFile(f.job.commit, f.job.nonce);
  f.parent.kill();
  expect(await readFile(path.join(f.target, "version"), "utf8")).toBe("old");
  expect(await readFile(f.job.result, "utf8")).toBe("cancelled");
});

test("crashing without Electron's final quit signal never installs an update", async () => {
  const f = await helperFixture();
  f.parent.kill();
  expect(await f.finished).toBe(0);
  expect(await readFile(path.join(f.target, "version"), "utf8")).toBe("old");
  expect(await readFile(f.job.result, "utf8")).toBe("cancelled");
});

test("copy failure preserves the complete old app", async () => {
  const f = await helperFixture(true, true);
  await writeFile(f.job.commit, f.job.nonce);
  f.parent.kill();
  expect(await f.finished).toBe(1);
  expect(await readFile(path.join(f.target, "version"), "utf8")).toBe("old");
  expect(await readFile(f.job.result, "utf8")).toBe("copy-failed");
});

test("a new app that fails to confirm startup is rolled back", async () => {
  const f = await helperFixture(false);
  await writeFile(f.job.commit, f.job.nonce);
  f.parent.kill();
  expect(await f.finished).toBe(1);
  expect(await readFile(path.join(f.target, "version"), "utf8")).toBe("old");
  expect(await readFile(f.job.result, "utf8")).toBe("rolled-back");
  expect(
    await readFile(
      path.join(f.target + ".hightex-failed-" + f.job.nonce, "version"),
      "utf8",
    ),
  ).toBe("new");
});

function thin(cpu: number) {
  const bytes = Buffer.alloc(32);
  bytes.writeUInt32LE(0xfeedfacf, 0);
  bytes.writeUInt32LE(cpu, 4);
  return bytes;
}
test("Mach-O validation recognizes Intel, Apple Silicon and universal bundles and rejects malformed headers", () => {
  expect(machoArchitectures(thin(0x01000007))).toEqual(["x64"]);
  expect(machoArchitectures(thin(0x0100000c))).toEqual(["arm64"]);
  const fat = Buffer.alloc(48);
  fat.writeUInt32BE(0xcafebabe, 0);
  fat.writeUInt32BE(2, 4);
  fat.writeUInt32BE(0x01000007, 8);
  fat.writeUInt32BE(0x0100000c, 28);
  expect(machoArchitectures(fat)).toEqual(["x64", "arm64"]);
  expect(() =>
    machoArchitectures(Buffer.from("not a real executable")),
  ).toThrow();
  fat.writeUInt32BE(999, 4);
  expect(() => machoArchitectures(fat)).toThrow();
});

async function stageFixture(
  options: {
    badHash?: boolean;
    badVersion?: boolean;
    badId?: boolean;
    badArch?: boolean;
    escapingLink?: boolean;
  } = {},
) {
  const root = await directory();
  const current = path.join(root, "HighTex.app");
  await mkdir(path.join(current, "Contents", "MacOS"), { recursive: true });
  const file = path.join(root, "download.dmg");
  const content = Buffer.from("fixture disk image");
  await writeFile(file, content);
  let mounted = false,
    detached = false,
    commands = 0;
  const run: MacCommandRunner = async (command, args) => {
    commands++;
    if (command.endsWith("plutil")) {
      const replacement =
        args[args.length - 1] !== path.join(current, "Contents", "Info.plist");
      return JSON.stringify({
        CFBundleIdentifier:
          replacement && options.badId ? "com.other.app" : "com.hightex.app",
        CFBundleShortVersionString: replacement
          ? options.badVersion
            ? "9.0.0"
            : "2.0.0"
          : "1.0.0",
        CFBundleExecutable: "HighTex",
      });
    }
    if (command.endsWith("hdiutil")) {
      if (args[0] === "attach") {
        mounted = true;
        const mount = args[args.indexOf("-mountpoint") + 1];
        await mkdir(path.join(mount, "HighTex.app", "Contents", "MacOS"), {
          recursive: true,
        });
        await writeFile(
          path.join(mount, "HighTex.app", "Contents", "MacOS", "HighTex"),
          thin(options.badArch ? 0x01000007 : 0x0100000c),
        );
        if (options.escapingLink)
          await import("node:fs/promises").then((fs) =>
            fs.symlink(root, path.join(mount, "HighTex.app", "outside")),
          );
      } else detached = true;
      return "";
    }
    if (command.endsWith("ditto")) {
      await exec("/bin/cp", ["-R", ...args]);
      return "";
    }
    throw Error("Unexpected command " + command);
  };
  const installer = new MacUpdateInstaller(
    path.join(root, "data"),
    path.join(current, "Contents", "MacOS", "HighTex"),
    run,
  );
  const artifact = {
    file,
    version: "2.0.0",
    sha512: options.badHash
      ? Buffer.alloc(64).toString("base64")
      : createHash("sha512").update(content).digest("base64"),
  };
  return {
    installer,
    artifact,
    root,
    commands: () => commands,
    mounted: () => mounted,
    detached: () => detached,
  };
}

for (const [name, options] of Object.entries({
  checksum: { badHash: true },
  version: { badVersion: true },
  identity: { badId: true },
  architecture: { badArch: true },
  symlink: { escapingLink: true },
})) {
  test(`staging rejects an invalid ${name} without replacing the app`, async () => {
    const f = await stageFixture(options);
    await expect(f.installer.prepare(f.artifact, "arm64")).rejects.toThrow();
    expect(
      await access(path.join(f.root, "HighTex.app")).then(
        () => true,
        () => false,
      ),
    ).toBe(true);
    if (name === "checksum") expect(f.mounted()).toBe(false);
    else expect(f.detached()).toBe(true);
  });
}

test("a valid bundle is staged and a cancelled install cannot emit a quit commit", async () => {
  const f = await stageFixture();
  // CI can run as root; staging must reject that production configuration before it can launch.
  if (process.getuid!() === 0) {
    await expect(f.installer.prepare(f.artifact, "arm64")).rejects.toThrow(
      "regular macOS user",
    );
    return;
  }
  await f.installer.prepare(f.artifact, "arm64");
  expect(f.detached()).toBe(true);
  const job = JSON.parse(
    await readFile(
      path.join(f.root, "data", "mac-updates", "current.json"),
      "utf8",
    ),
  );
  f.installer.cancel();
  f.installer.commitQuit();
  expect(await readFile(job.commit, "utf8")).toBe("");
  expect(await readFile(job.abort, "utf8")).toBe(job.nonce);
});
