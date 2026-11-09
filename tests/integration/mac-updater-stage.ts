// Opt-in macOS-only: stages a tiny unsigned fixture DMG. Never installs or launches HighTex.
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { MacUpdateInstaller } from "../../electron/updater/mac-installer";

if (process.platform !== "darwin")
  throw Error("This opt-in integration requires macOS.");
const exec = promisify(execFile);
const root = await mkdtemp(path.join(tmpdir(), "hightex-mac-stage-"));
async function bundle(directory: string, version: string) {
  const contents = path.join(directory, "Contents");
  await mkdir(path.join(contents, "MacOS"), { recursive: true });
  const plist = path.join(contents, "Info.plist");
  await writeFile(
    plist,
    JSON.stringify({
      CFBundleIdentifier: "com.hightex.app",
      CFBundleShortVersionString: version,
      CFBundleExecutable: "HighTex",
      CFBundlePackageType: "APPL",
    }),
  );
  await exec("/usr/bin/plutil", ["-convert", "xml1", plist]);
  const binary = Buffer.alloc(32);
  binary.writeUInt32LE(0xfeedfacf, 0);
  binary.writeUInt32LE(process.arch === "arm64" ? 0x0100000c : 0x01000007, 4);
  await writeFile(path.join(contents, "MacOS", "HighTex"), binary, {
    mode: 0o755,
  });
}
try {
  const target = path.join(root, "installed", "HighTex.app");
  const payload = path.join(root, "payload");
  await bundle(target, "1.0.0");
  await bundle(path.join(payload, "HighTex.app"), "2.0.0");
  const dmg = path.join(root, "fixture.dmg");
  await exec("/usr/bin/hdiutil", [
    "create",
    "-quiet",
    "-fs",
    "HFS+",
    "-format",
    "UDZO",
    "-volname",
    "HighTex Update Fixture",
    "-srcfolder",
    payload,
    dmg,
  ]);
  const installer = new MacUpdateInstaller(
    path.join(root, "data"),
    path.join(target, "Contents", "MacOS", "HighTex"),
  );
  await installer.prepare({
    file: dmg,
    version: "2.0.0",
    sha512: createHash("sha512")
      .update(await readFile(dmg))
      .digest("base64"),
  });
  installer.cancel();
  installer.commitQuit();
  const job = JSON.parse(
    await readFile(
      path.join(root, "data", "mac-updates", "current.json"),
      "utf8",
    ),
  );
  assert.equal(await readFile(job.commit, "utf8"), "");
  assert.equal(await readFile(job.abort, "utf8"), job.nonce);
  const info = JSON.parse(
    (
      await exec("/usr/bin/plutil", [
        "-convert",
        "json",
        "-o",
        "-",
        path.join(target, "Contents", "Info.plist"),
      ])
    ).stdout,
  );
  assert.equal(info.CFBundleShortVersionString, "1.0.0");
  console.log(
    "PASS: real hdiutil/plutil/ditto staging of an unsigned fixture DMG; checksum, identity, architecture and cancellation; installed fixture remains unchanged.",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
