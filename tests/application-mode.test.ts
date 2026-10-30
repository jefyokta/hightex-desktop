import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function fixture(
  isPackaged: boolean,
  appEnv?: string,
  rendererUrl = "http://localhost:5173/",
) {
  const windows: FakeWindow[] = [];
  let inspections = 0;
  let updateChecks = 0;
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
  const { Application } = load<typeof import("../electron/main/application")>(
    "../electron/main/application.ts",
  );
  const application = new Application();
  const internal = application as unknown as {
    server: { url: string; start(): void };
    createWindow(): Promise<void>;
    registerContextMenu(): void;
    checkForUpdates(manual: boolean): Promise<{ status: string }>;
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
  };
}

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
      dev ? "http://localhost:5173/" : "hightex://renderer",
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
  expect(f.windows[0].loaded).toBe("hightex://renderer");
  expect(f.windows[0].devToolsOpened).toBe(1);
  expect(f.application.resolveRendererUrl("document/doc")).toBe(
    "hightex://renderer/document/doc",
  );
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
    const result = await f.internal.checkForUpdates(true);
    expect(result.status).toBe(packaged ? "not-available" : "disabled");
    expect(f.updateChecks()).toBe(packaged ? 1 : 0);
  },
);
