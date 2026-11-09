import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import type { BrowserWindow } from "electron";
import type { UpdaterStatus } from "../electron/updater/types";

function fixture(os: NodeJS.Platform = "darwin") {
  const calls: string[] = [];
  const statuses: UpdaterStatus[] = [];
  const handlers = new Map<
    string,
    (
      event: unknown,
    ) => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>
  >();
  let canClose = true,
    failPrepare = false,
    profileSaving = false;
  let launch: () => Promise<void> = async () => {};
  let quitting: () => void = () => {
    app.emit("quit");
  };
  const updaters: Updater[] = [];
  class Updater extends EventEmitter {
    constructor() {
      super();
      updaters.push(this);
    }
    private artifact = {
      file: "/fixture/update.dmg",
      version: "2.0.0",
      sha512: "fixture",
    };
    downloadedArtifact() {
      return this.artifact;
    }
    quitAndInstall() {
      calls.push("native-install");
    }
    async downloadUpdate() {
      calls.push("download");
    }
    async checkForUpdates() {
      calls.push("check");
      return { isUpdateAvailable: false, updateInfo: { version: "1.0.0" } };
    }
  }
  class Installer {
    wasCancelled = false;
    async prepare() {
      this.wasCancelled = false;
      calls.push("prepare");
      if (failPrepare) throw Error("Invalid installer");
    }
    async launch() {
      calls.push("launch");
      await launch();
    }
    cancel() {
      this.wasCancelled = true;
      calls.push("cancel");
    }
    commitQuit() {
      if (!this.wasCancelled) calls.push("commit");
    }
    async acknowledgeLaunch() {
      calls.push("startup");
    }
  }
  const app = Object.assign(new EventEmitter(), {
    isPackaged: true,
    getVersion: () => "1.0.0",
    quit: () => {
      calls.push("quit");
      quitting();
    },
  });
  const native = new Updater();
  const modules: Record<string, unknown> = {
    electron: { app },
    "electron-updater": { autoUpdater: native },
    "./mac-downloader": { MacManualUpdater: Updater },
    "./mac-installer": { MacUpdateInstaller: Installer },
    "../utilities/ipc-main": {
      IPCMain: {
        handle: (
          channel: string,
          handler: (event: unknown) => Promise<{ ok: boolean }>,
        ) => handlers.set(channel, handler),
      },
    },
    "../service/logger-service": { LoggerService: { write() {} } },
  };
  function load<T>(file: string) {
    const exports = {} as T;
    vm.runInNewContext(
      ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      }).outputText,
      {
        exports,
        require: (name: string) => modules[name] ?? {},
        process: { platform: os },
        Error,
      },
    );
    return exports;
  }
  modules["./platform"] = load<typeof import("../electron/updater/platform")>(
    "../electron/updater/platform.ts",
  );
  const { UpdaterFacade } = load<typeof import("../electron/updater/facade")>(
    "../electron/updater/facade.ts",
  );
  const sender = {
    send: (_channel: string, status: UpdaterStatus) => statuses.push(status),
  };
  const window = { webContents: sender, isDestroyed: () => false };
  const facade = new UpdaterFacade({
    storageRoot: () => "/fixture-data",
    isDev: () => false,
    window: () => window as unknown as BrowserWindow,
    profileSaving: () => profileSaving,
    prepareEditors: async () => {
      calls.push("close-editors");
      return canClose;
    },
  });
  facade.register();
  updaters[updaters.length - 1].emit("update-downloaded", {
    version: "2.0.0",
    downloadedFile: "/fixture/update.dmg",
  });
  return {
    facade,
    app,
    calls,
    statuses,
    install: (from: unknown = sender) =>
      handlers.get("updater:install")!({ sender: from }),
    profileSaving: (value: boolean) => {
      profileSaving = value;
    },
    canClose: (value: boolean) => {
      canClose = value;
    },
    failPrepare: () => {
      failPrepare = true;
    },
    launch: (action: typeof launch) => {
      launch = action;
    },
    quit: (action: () => void) => {
      quitting = action;
    },
  };
}

test("only the main window can install; pending profile saves do not close anything", async () => {
  const f = fixture();
  expect((await f.install({})).ok).toBe(false);
  expect(f.calls).toEqual([]);
  f.profileSaving(true);
  expect((await f.install()).ok).toBe(false);
  expect(f.calls).toEqual([]);
});
test("editor cancellation aborts the macOS helper and restores readiness without prompting again", async () => {
  const f = fixture();
  f.canClose(false);
  expect(await f.install()).toMatchObject({ ok: false, cancelled: true });
  expect(f.calls).toEqual(["prepare", "launch", "close-editors", "cancel"]);
  expect(f.statuses[f.statuses.length - 1]).toMatchObject({
    status: "downloaded",
    retry: true,
  });
});
test("macOS authorizes replacement only on the final quit event", async () => {
  const f = fixture();
  expect(await f.install()).toMatchObject({ ok: true });
  expect(f.calls).toEqual([
    "prepare",
    "launch",
    "close-editors",
    "quit",
    "commit",
  ]);
});
test("a delayed Stay decision cancels replacement and clears the installing state", async () => {
  const f = fixture();
  f.quit(() => {});
  expect(await f.install()).toMatchObject({ ok: true });
  expect((await f.facade.check()).status).toBe("installing");
  expect((await f.install()).ok).toBe(false);
  f.facade.cancelInstall();
  expect(f.statuses[f.statuses.length - 1]).toMatchObject({
    status: "downloaded",
    retry: true,
  });
  expect(f.calls).not.toContain("commit");
  expect((await f.facade.check()).status).toBe("not-available");
});
test("validation failure never launches a helper or closes editors and remains retryable", async () => {
  const f = fixture();
  f.failPrepare();
  expect(await f.install()).toMatchObject({
    ok: false,
    message: "Invalid installer",
  });
  expect(f.calls).toEqual(["prepare", "cancel"]);
  expect(f.statuses[f.statuses.length - 1].status).toBe("downloaded");
});
test("concurrent install requests cannot prepare two replacement jobs", async () => {
  const f = fixture();
  let release!: () => void;
  f.launch(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const work = f.install();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect((await f.install()).ok).toBe(false);
  release();
  expect((await work).ok).toBe(true);
  expect(f.calls.filter((call) => call === "prepare")).toHaveLength(1);
});
for (const os of ["win32", "linux"] as const)
  test(`${os} uses the native adapter through the same non-optional facade`, async () => {
    const f = fixture(os);
    expect((await f.install()).ok).toBe(true);
    expect(f.calls).toEqual(["native-install"]);
    await f.facade.acknowledgeStartup();
    expect(f.calls).not.toContain("startup");
  });
