import { expect, test, afterEach } from "bun:test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import vm from "node:vm";
import ts from "typescript";
import type { BrowserWindow } from "electron";
import type { UpdateInfo } from "electron-updater";
import type { UpdaterStatus } from "../electron/updater/types";

interface FixtureOptions {
  platform?: NodeJS.Platform;
  isDev?: boolean;
  feedUrl?: string;
  appVersion?: string;
  electronUpdaterLogger?: { info: () => void; warn: () => void; error: () => void; debug: () => void };
}

function setupFixture(options: FixtureOptions = {}) {
  const { platform = "darwin", isDev = false, appVersion = "1.4.1" } = options;
  const calls: string[] = [];
  const statuses: UpdaterStatus[] = [];
  const handlers = new Map<
    string,
    (
      event: unknown,
    ) => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>
  >();
  let canClose = true;
  let profileSaving = false;
  let nativeFailure: "throw" | "event" | undefined;
  let launch: () => Promise<void> = async () => {};
  let beforeEditors: () => void = () => {};
  let quitting: () => void = () => {
    app.emit("quit");
  };
  const updaters: EventEmitter[] = [];

  class MockAppUpdater extends EventEmitter {
    autoDownload = false;
    logger = options.electronUpdaterLogger || { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    
    private _feedUrl: string | null = null;
    private _updateAvailable = false;
    private _updateInfo: UpdateInfo = {
      version: "1.4.1",
      files: [],
      path: "",
      sha512: "",
      releaseDate: new Date().toISOString(),
    };

    constructor() {
      super();
      if (options.feedUrl) this.setFeedURL(options.feedUrl);
    }
    
    setFeedURL(url: string) {
      this._feedUrl = url;
      calls.push(`setFeedURL: ${url}`);
    }

    async checkForUpdates() {
      calls.push("checkForUpdates");
      if (!this._feedUrl) throw new Error("feedUrl not set");

      // Simulate fetching latest.json from feedUrl
      const latestJsonUrl = new URL("latest.json", this._feedUrl).toString();
      try {
        const response = await fetch(latestJsonUrl);
        if (!response.ok) throw new Error(`Failed to fetch ${latestJsonUrl}`);
        const data = await response.json();
        
        this._updateInfo = data.updateInfo ?? data;
        this._updateAvailable =
          data.isUpdateAvailable ?? data.version !== appVersion;

        if (this._updateAvailable) {
          this.emit("update-available", this._updateInfo);
          return { isUpdateAvailable: true, updateInfo: this._updateInfo };
        } else {
          this.emit("update-not-available", this._updateInfo);
          return { isUpdateAvailable: false, updateInfo: this._updateInfo };
        }

      } catch (error) {
        this.emit("error", error);
        throw error;
      }
    }

    async downloadUpdate() {
      calls.push("downloadUpdate");
      if (!this._updateAvailable || !this._updateInfo.files[0]) throw new Error("No update available or file info missing");

      // Simulate download progress
      this.emit("download-progress", { percent: 0, transferred: 0, total: 1000000 });
      await new Promise(resolve => setTimeout(resolve, 50));
      this.emit("download-progress", { percent: 50, transferred: 500000, total: 1000000 });
      await new Promise(resolve => setTimeout(resolve, 50));
      this.emit("download-progress", { percent: 100, transferred: 1000000, total: 1000000 });

      const downloadedEvent = { version: this._updateInfo.version, downloadedFile: "/tmp/dummy-update.dmg" };
      this.emit("update-downloaded", downloadedEvent);
      return Promise.resolve();
    }

    quitAndInstall() {
      calls.push("native-install");
      if (nativeFailure === "throw") throw Error("Native installer failed");
      if (nativeFailure === "event")
        this.emit("error", Error("Native installer failed"));
    }

    downloadedArtifact() {
      return { file: "/tmp/dummy-update.dmg", version: this._updateInfo.version, sha512: this._updateInfo.sha512 };
    }
  }

  class MockInstaller {
    wasCancelled = false;
    async prepare() {
      this.wasCancelled = false;
      calls.push("prepare");
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
    isPackaged: !isDev,
    getVersion: () => appVersion,
    quit: () => {
      calls.push("quit");
      quitting();
    },
  });
  const mockAutoUpdater = new MockAppUpdater();
  updaters.push(mockAutoUpdater);

  const modules: Record<string, unknown> = {
    electron: { app },
    "electron-updater": { autoUpdater: mockAutoUpdater },
    "./mac-downloader": { MacManualUpdater: MockAppUpdater }, // Use MockAppUpdater for MacManualUpdater too
    "./mac-installer": { MacUpdateInstaller: MockInstaller },
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
        process: { platform: platform },
        Error,
        String, // Add String to the context
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
    isDev: () => isDev,
    window: () => window as unknown as BrowserWindow,
    profileSaving: () => profileSaving,
    prepareEditors: async () => {
      calls.push("close-editors");
      beforeEditors();
      return canClose;
    },
  });
  facade.register();

  return {
    facade,
    app,
    calls,
    statuses,
    mockAutoUpdater,
    beforeEditors: (callback: () => void) => {
      beforeEditors = callback;
    },
    nativeFailure: (value: typeof nativeFailure) => {
      nativeFailure = value;
    },
    install: (from: unknown = sender) =>
      handlers.get("updater:install")!({ sender: from }),
    profileSaving: (value: boolean) => {
      profileSaving = value;
    },
    canClose: (value: boolean) => {
      canClose = value;
    },
    launch: (action: typeof launch) => {
      launch = action;
    },
    quit: (action: () => void) => {
      quitting = action;
    },
  };
}

let server: Server | undefined;
let tempDir: string | undefined;
let serverPort: number | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => (err ? reject(err) : resolve()));
    });
    server = undefined;
    serverPort = undefined;
  }
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

test("updater checks a local HTTP server for updates and downloads the artifact", async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "hightex-updater-server-"));
  const dummyDmgPath = path.join(tempDir, "HighTex-Mac-1.4.2-Installer.dmg");
  const latestJsonPath = path.join(tempDir, "latest.json");

  // Create dummy DMG file
  await writeFile(dummyDmgPath, "dummy DMG content");

  const newVersion = "1.4.2";
  const currentVersion = "1.4.1";

  const latestJsonContent = {
    version: newVersion,
    files: [
      {
        url: "HighTex-Mac-1.4.2-Installer.dmg",
        sha512: "dummy-sha512",
      },
    ],
    path: "HighTex-Mac-1.4.2-Installer.dmg",
    sha512: "dummy-sha512",
    releaseDate: new Date().toISOString(),
    releaseName: `Version ${newVersion}`,
    releaseNotes: "Test update notes",
  };
  await writeFile(latestJsonPath, JSON.stringify(latestJsonContent, null, 2));

  server = createServer(async (req, res) => {
    const filePath = path.join(tempDir!, req.url!);
    try {
      const content = await readFile(filePath);
      const mimeType = req.url!.endsWith(".dmg") ? "application/x-apple-diskimage" : "application/json";
      res.writeHead(200, { "Content-Type": mimeType });
      res.end(content);
    } catch (error) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  serverPort = await new Promise<number>((resolve) => {
    server!.listen(0, "127.0.0.1", () => {
      const address = server!.address();
      if (typeof address === "object" && address) {
        resolve(address.port);
      } else {
        throw new Error("Could not get server address");
      }
    });
  });

  const feedUrl = `http://127.0.0.1:${serverPort}`;

  const f = setupFixture({
    appVersion: currentVersion,
    isDev: false, // Ensure updater is enabled
    feedUrl,
  });

  // Simulate check for updates
  const checkResult = await f.facade.check(true);
  expect(checkResult).toMatchObject({
    status: "available",
    info: { version: newVersion },
  });
  expect(f.calls).toContain("setFeedURL: " + feedUrl);
  expect(f.calls).toContain("checkForUpdates");
  expect(f.statuses).toContainEqual({
    status: "available",
    info: { ...latestJsonContent, version: newVersion },
    manual: true,
  });

  // Simulate download
  await f.facade.download();
  expect(f.calls).toContain("downloadUpdate");
  expect(f.statuses).toContainEqual(
    expect.objectContaining({
      status: "downloaded",
      info: expect.objectContaining({ version: newVersion }),
    }),
  );

  // Simulate install
  const installResult = await f.install();
  expect(installResult.ok).toBe(true);
  expect(f.calls).toContain("prepare");
  expect(f.calls).toContain("launch");
  expect(f.calls).toContain("close-editors");
  expect(f.calls).toContain("quit");
});
