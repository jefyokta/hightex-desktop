import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import type { ResolvedUpdateFileInfo } from "electron-updater";

function fixture() {
  const downloads: unknown[] = [];
  const events: unknown[] = [];
  let task: unknown;
  class AppUpdater {
    emit() {}
    dispatchUpdateDownloaded(info: unknown) {
      events.push(info);
    }
    async executeDownload(options: {
      task(file: string, options: object): Promise<unknown>;
      done(event: { downloadedFile: string; version: string }): Promise<void>;
    }) {
      task = options;
      await options.task("/fixture/update.dmg", { sha512: "fixture-checksum" });
      await options.done({
        downloadedFile: "/fixture/update.dmg",
        version: "2.0.0",
      });
      return { updateFile: "/fixture/update.dmg" };
    }
  }
  const modules: Record<string, unknown> = {
    "electron-updater": { AppUpdater },
    "electron-updater/out/electronHttpExecutor.js": {
      ElectronHttpExecutor: class {
        async download(...args: unknown[]) {
          downloads.push(args);
        }
      },
    },
  };
  const exports = {} as typeof import("../electron/updater/mac-downloader");
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../electron/updater/mac-downloader.ts", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText,
    {
      exports,
      require: (name: string) => modules[name],
      process: { arch: "arm64" },
      decodeURIComponent,
    },
  );
  return { exports, downloads, events, task: () => task };
}
const file = (
  name: string,
  sha512 = "fixture-checksum",
): ResolvedUpdateFileInfo => ({
  url: new URL("https://github.com/example/release/" + name),
  info: { url: name, sha512 },
});

test("macOS chooses a compatible disk image and ignores native-updater ZIPs", () => {
  const f = fixture();
  const files = [
    file("HighTex-arm64.zip"),
    file("HighTex-x64.dmg"),
    file("HighTex-arm64.dmg"),
  ];
  expect(f.exports.selectMacInstaller(files, "arm64")).toBe(files[2]);
  expect(f.exports.selectMacInstaller(files, "x64")).toBe(files[1]);
  expect(() => f.exports.selectMacInstaller([files[0]], "arm64")).toThrow();
  expect(() =>
    f.exports.selectMacInstaller([file("HighTex-arm64.dmg", "")], "arm64"),
  ).toThrow();
});

test("downloader uses the library checksum/caching pipeline and dispatches readiness without Squirrel", async () => {
  const f = fixture();
  const updater = new f.exports.MacManualUpdater();
  const info = { version: "2.0.0" };
  const internal = updater as unknown as {
    doDownloadUpdate(options: unknown): Promise<unknown>;
  };
  await internal.doDownloadUpdate({
    updateInfoAndProvider: {
      info,
      provider: { resolveFiles: () => [file("HighTex-arm64.dmg")] },
    },
    requestHeaders: {},
    cancellationToken: {},
  });
  expect(updater.autoInstallOnAppQuit).toBe(false);
  expect(updater.autoDownload).toBe(false);
  expect(f.downloads).toHaveLength(1);
  expect(f.events).toEqual([
    { downloadedFile: "/fixture/update.dmg", version: "2.0.0" },
  ]);
  expect(updater.downloadedArtifact()).toEqual({
    file: "/fixture/update.dmg",
    version: "2.0.0",
    sha512: "fixture-checksum",
  });
  expect(f.task()).toMatchObject({ fileExtension: "dmg" });
  expect(() => updater.quitAndInstall()).toThrow(
    "staged application installer",
  );
});
