import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { EditorCloseGuard } from "../electron/utilities/editor-close-guard";

function fixture(
  isPackaged: boolean,
  appEnv?: string,
  rendererUrl = "http://localhost:5173/",
) {
  const windows: FakeWindow[] = [];
  let inspections = 0;
  let updateChecks = 0;
  let dialogResponse = 0;
  const dialogs: unknown[] = [];
  class FakeWindow extends EventEmitter {
    loaded = "";
    devToolsOpened = 0;
    readonly webContents = Object.assign(new EventEmitter(), {
      openDevTools: () => {
        this.devToolsOpened++;
      },
      send() {},
      inspectElement() {},
    });
    constructor(
      readonly options: { webPreferences: { devTools: boolean }; icon: string },
    ) {
      super();
      windows.push(this);
    }
    async loadURL(url: string) {
      this.loaded = url;
    }
  }
  const modules: Record<string, unknown> = {
    electron: {
      ipcMain: new EventEmitter(),
      dialog: {
        showMessageBoxSync: (_window: unknown, options: unknown) => {
          dialogs.push(options);
          return dialogResponse;
        },
      },
      app: { isPackaged, getAppPath: () => "/fixture" },
      BrowserWindow: FakeWindow,
      Menu: class {
        append() {}
        popup() {
          inspections++;
        }
      },
      MenuItem: class {},
    },
    "electron-updater": {
      autoUpdater: {
        async checkForUpdates() {
          updateChecks++;
          return { isUpdateAvailable: false, updateInfo: {} };
        },
      },
    },
    "dotenv/config": {},
    fs: { existsSync: (file: string) => file.endsWith("index.mjs") },
    "node:path": path,
    "node:url": { fileURLToPath },
    "../service/config-service": { ConfigService: { getKey: () => "en" } },
    "../../src/locales/en.json": JSON.parse(
      readFileSync(new URL("../src/locales/en.json", import.meta.url), "utf8"),
    ),
    "../../src/locales/id.json": JSON.parse(
      readFileSync(new URL("../src/locales/id.json", import.meta.url), "utf8"),
    ),
  };
  const process = {
    env: { APP_ENV: appEnv, VITE_DEV_SERVER_URL: rendererUrl },
    platform: "linux",
    cwd: () => "/fixture",
  };
  const load = <T>(file: string) => {
    const url = new URL(file, import.meta.url);
    const source = readFileSync(url, "utf8").replace(
      /import\.meta\.url/g,
      JSON.stringify(url.href),
    );
    const sandbox = {
      exports: {} as T,
      require: (name: string) => modules[name] ?? {},
      process,
      URL,
    };
    vm.runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      }).outputText,
      sandbox,
    );
    return sandbox.exports;
  };
  const runtime = load<typeof import("../electron/main/application-runtime")>(
    "../electron/main/application-runtime.ts",
  );
  modules["./application-runtime"] = runtime;
  modules["../workspaces/runtime"] = { WorkspaceRuntime: {} };
  modules["../updater/facade"] = {
    UpdaterFacade: class {
      constructor(private context: { isDev(): boolean }) {}
      register() {}
      cancelInstall() {}
      async acknowledgeStartup() {}
      async check() {
        if (this.context.isDev() || !isPackaged) return { status: "disabled" };
        updateChecks++;
        return { status: "not-available" };
      }
    },
  };

  const { Application } = load<typeof import("../electron/main/application")>(
    "../electron/main/application.ts",
  );
  const application = new Application();
  const internal = application as unknown as {
    server: { url: string; start(): void };
    createWindow(): Promise<void>;
    registerContextMenu(): void;
    updater: { check(manual: boolean): Promise<{ status: string }> };
  };
  internal.server = { url: "hightex://renderer", start() {} };
  return {
    Application,
    application,
    internal,
    windows,
    inspections: () => inspections,
    updateChecks: () => updateChecks,
    load,
    modules,
    dialogs,
    respondToDialog: (response: number) => {
      dialogResponse = response;
    },
  };
}

test("native profile close keeps unsaved drafts unless discarded and refuses to leave during a pending save", async () => {
  const f = fixture(true);
  await f.internal.createWindow();
  let unloaded = 0;
  const attempt = () =>
    f.windows[0].webContents.emit("will-prevent-unload", {
      preventDefault: () => {
        unloaded++;
      },
    });
  attempt();
  expect(unloaded).toBe(0);
  f.respondToDialog(1);
  attempt();
  expect(unloaded).toBe(1);
  f.application.profileDraftBusy = true;
  attempt();
  expect(unloaded).toBe(1);
  expect(f.dialogs).toHaveLength(3);
});

test.each([
  { packaged: false, env: undefined, dev: true },
  { packaged: false, env: "development", dev: true },
  { packaged: false, env: "production", dev: true },
  { packaged: true, env: undefined, dev: false },
  { packaged: true, env: "development", dev: false },
  { packaged: true, env: "production", dev: false },
])(
  "Application.isDev drives renderer, DevTools and inspect menu: %j",
  async ({ packaged, env, dev }) => {
    const f = fixture(packaged, env);
    expect(f.Application.isDev).toBe(dev);
    expect(f.application.isDev).toBe(dev);
    await f.internal.createWindow();
    const window = f.windows[0];
    expect(window.options.webPreferences.devTools).toBe(dev);
    expect(window.devToolsOpened).toBe(dev ? 1 : 0);
    expect(window.loaded).toBe(
      dev ? "http://localhost:5173/" : "hightex://renderer/",
    );
    expect(f.application.resolveRendererUrl("document/doc")).toBe(
      dev
        ? "http://localhost:5173/document/doc"
        : "hightex://renderer/document/doc",
    );
    expect(
      window.options.icon.endsWith(
        dev ? "public/electron-vite.svg" : "dist/electron-vite.svg",
      ),
    ).toBe(true);
    f.internal.registerContextMenu();
    window.webContents.emit("context-menu", {}, { x: 1, y: 1 });
    expect(f.inspections()).toBe(dev ? 1 : 0);
    let blocked = false;
    window.webContents.emit(
      "before-input-event",
      {
        preventDefault: () => {
          blocked = true;
        },
      },
      { key: "F12" },
    );
    expect(blocked).toBe(!dev);
  },
);

test("development without Vite uses built renderer files while retaining development tools", async () => {
  const f = fixture(false, "development", "");
  await f.internal.createWindow();
  expect(f.Application.isDev).toBe(true);
  expect(f.windows[0].loaded).toBe("hightex://renderer/");
  expect(f.windows[0].devToolsOpened).toBe(1);
  expect(f.application.resolveRendererUrl("document/doc")).toBe(
    "hightex://renderer/document/doc",
  );
});

test("legacy dev migration reads the old Vite origin without doubling path slashes", async () => {
  const f = fixture(false, "development");
  Object.assign(
    (f.modules["../workspaces/runtime"] as { WorkspaceRuntime: object })
      .WorkspaceRuntime,
    { migrating: true, profile: { id: "local" } },
  );
  await f.internal.createWindow();
  expect(f.windows[0].loaded).toBe("http://localhost:5173/profiles/migration");
});

test.each([false, true])(
  "CLI argv parsing follows packaging when APP_ENV=production (%s)",
  (packaged) => {
    const f = fixture(packaged, "production");
    const { getCliArgs } = f.load<typeof import("../electron/main/cli-args")>(
      "../electron/main/cli-args.ts",
    );
    expect(
      getCliArgs(
        packaged ? ["hightex", "version"] : ["electron", "main.js", "version"],
      ),
    ).toEqual(["version"]);
  },
);

test.each([false, true])(
  "editor windows use Application.isDev (%s)",
  async (dev) => {
    const f = fixture(!dev);
    f.modules["./../main/application"] = { Application: f.Application };
    f.modules["../utilities/editor-close-guard"] = { EditorCloseGuard };
    const { EditorWindow } = f.load<
      typeof import("../electron/windows/editor-window")
    >("../electron/windows/editor-window.ts");
    await EditorWindow.open("doc");
    expect(f.windows[0].options.webPreferences.devTools).toBe(dev);
    expect(f.windows[0].devToolsOpened).toBe(dev ? 1 : 0);
  },
);

test.each([false, true])(
  "updater eligibility still requires a packaged build (%s)",
  async (packaged) => {
    const f = fixture(packaged, "production");
    const result = await f.internal.updater.check(true);
    expect(result.status).toBe(packaged ? "not-available" : "disabled");
    expect(f.updateChecks()).toBe(packaged ? 1 : 0);
  },
);
