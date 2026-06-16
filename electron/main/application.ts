import fs from "fs";
import { app, BrowserWindow,  Menu, MenuItem } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ConfigHandler } from "../handlers/config-handler";
import { ProfileHandler } from "../handlers/profile-handlers";
import { SessionHandler } from "../handlers/session-handlers";
import { HighTexHandler } from "../handlers/hightex-handlers";
import { PluginHandler } from "../handlers/plugin-handlers";
import { PluginScannerHandler } from "../handlers/plugin-scanner-handlers";
import { PluginManager } from "../plugins/plugin-manager";
import { KeyManagerService } from "../service/key-manager-service";
import { DefaultPluginsBootstrapper } from "../plugins/plugin-default-boostraper";
import { ZoteroHandler } from "../handlers/zotero-handler";

import { LocalServer } from "../server/local-server";
import { FileOpenManager } from "../service/file-open-service";
import { SharingHandler } from "../handlers/sharing-handler";
import { DatabaseBootstraper } from "@main/database/core/bootstrapper";
import { NetworkService } from "@main/service/network-service";

export class Application {
  private win: BrowserWindow | null = null;

  private server: LocalServer | null = null;
  private fileOpen?: FileOpenManager;

  private readonly __dirname = path.dirname(fileURLToPath(import.meta.url));

  static instance: Application;

  constructor() {
    Application.instance = this;
  }

  private get appRoot() {
    return this.resolveAppRoot();
  }

  public get rendererDist() {
    return path.join(this.appRoot, "dist");
  }

  private get publicRoot() {
    return path.join(this.appRoot, "public");
  }

  private resolveAppRoot(): string {
    const candidates = [
      path.join(this.__dirname, "..", ".."),
      path.join(app.getAppPath(), ".."),
      app.getAppPath(),
      path.join(process.cwd(), "dist"),
      path.join(process.cwd(), "..", "dist"),
    ];

    const valid = candidates.find((candidate) =>
      fs.existsSync(path.join(candidate, "dist", "index.html")),
    );

    return valid ?? path.join(this.__dirname, "..", "..");
  }

  private readonly preloadCandidates = [
    path.join(this.__dirname, "preload.mjs"),
    path.join(this.__dirname, "index.mjs"),
    path.join(this.__dirname, "../preload/index.mjs"),
    path.join(this.__dirname, "../preload/index.js"),
    path.join(this.__dirname, "../preload.mjs"),
  ];

  public bootstrap() {
    app.on("window-all-closed", async () => {
      await this.server?.stop();

      if (process.platform !== "darwin") {
        app.quit();
        this.win = null;
      }
    });

    app.commandLine.appendSwitch("disable-blink-features", "LayoutNGPrinting");

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
    this.fileOpen = new FileOpenManager((filePath) => {
      this.win?.webContents.send("file:open", filePath);
      this.win?.focus();
    });
    this.fileOpen.bootstrap(app);

    app.whenReady().then(() => this.onReady());
  }

  public get preloadEntry() {
    const found = this.preloadCandidates.find((candidate) =>
      fs.existsSync(candidate),
    );

    if (!found) {
      throw new Error(
        "Unable to find preload entry. Checked: " +
          this.preloadCandidates.join(", "),
      );
    }

    return found;
  }

  private async createWindow() {
    const publicPath = process.env.VITE_DEV_SERVER_URL
      ? this.publicRoot
      : this.rendererDist;

    this.win = new BrowserWindow({
      width: 1200,
      height: 800,

      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,

      ...(process.platform !== "darwin"
        ? {
            titleBarOverlay: true,
          }
        : {}),

      icon: path.join(publicPath, "electron-vite.svg"),

      webPreferences: {
        preload: this.preloadEntry,
        contextIsolation: true,
        // sandbox: false,
      },
    });

    if (process.env.APP_ENV !== "production") {
      this.win.webContents.openDevTools();
    }

    this.win.webContents.on("did-finish-load", () => {
      this.win?.webContents.send(
        "main-process-message",
        new Date().toLocaleString(),
      );
    });

    this.win.on("maximize", () => {
      this.win?.webContents.send("win:maximize", true);
    });

    this.win.on("unmaximize", () => {
      this.win?.webContents.send("win:maximize", false);
    });

    if (process.env.VITE_DEV_SERVER_URL) {
      await this.win.loadURL(process.env.VITE_DEV_SERVER_URL);

      return;
    }

    this.server = new LocalServer(this.rendererDist);

    await this.server.start();

    await this.win.loadURL(this.server.url);
  }

  private async onReady() {
    KeyManagerService.ensure();

    DefaultPluginsBootstrapper.installAll();
    new DatabaseBootstraper().tap();
    PluginManager.loadAll();
    NetworkService.tap();
    this.registerHandlers();
    await this.createWindow();

    this.registerContextMenu();
    this.fileOpen?.flush();
  }

  private registerContextMenu() {
    this.win?.webContents.on("context-menu", (_event, params) => {
      const menu = new Menu();

      menu.append(
        new MenuItem({
          label: "Inspect Element",

          click: () => {
            this.win!.webContents.inspectElement(params.x, params.y);
          },
        }),
      );

      menu.popup({
        window: this.win!,
      });
    });
  }

  private registerHandlers() {
    ConfigHandler.register();

    SessionHandler.register();

    ProfileHandler.register();

    HighTexHandler.register();

    PluginHandler.register();

    PluginScannerHandler.register();

    ZoteroHandler.register();
    SharingHandler.register();
  }

  public resolveRendererUrl(route = "/") {
    const normalized = route;

    if (process.env.VITE_DEV_SERVER_URL) {
      return `${process.env.VITE_DEV_SERVER_URL}${normalized}`;
    }

    if (!this.server) {
      throw new Error("Renderer server has not started yet");
    }

    return `${this.server.url}/${normalized}`;
  }
}
