import fs from "fs";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import {
  autoUpdater,
  type ProgressInfo,
  type UpdateDownloadedEvent,
  type UpdateInfo,
} from "electron-updater";
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
import { SnapshotHandler } from "@main/handlers/snapshot-handler";
import { ServerService } from "@main/service/server-service";
import { LoggerService } from "@main/service/logger-service";

type UpdaterStatus =
  | { status: "disabled"; reason: string }
  | { status: "checking" }
  | { status: "available"; info: UpdateInfo }
  | { status: "not-available"; info: UpdateInfo }
  | { status: "downloading"; progress: ProgressInfo }
  | { status: "downloaded"; info: UpdateDownloadedEvent }
  | { status: "error"; message: string };

export class Application {
  private win: BrowserWindow | null = null;

  private server: LocalServer | null = null;
  private fileOpen?: FileOpenManager;
  private updaterReady = false;
  private updateDownloaded = false;

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

  private get isDevelopment() {
    return !app.isPackaged && process.env.APP_ENV !== "production";
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
        devTools: this.isDevelopment,
        // sandbox: false,
      },
    });

    if (this.isDevelopment) {
      this.win.webContents.openDevTools();
    }

    this.win.webContents.on("before-input-event", (event, input) => {
      if (!this.isDevelopment && this.isDevToolsShortcut(input)) {
        event.preventDefault();
      }
    });

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
    await ServerService.checkForHost();
    KeyManagerService.ensure();

    DefaultPluginsBootstrapper.installAll();
    new DatabaseBootstraper().tap();
    PluginManager.loadAll();
    NetworkService.tap();
    this.registerHandlers();
    this.registerUpdater();
    await this.createWindow();

    this.registerContextMenu();
    this.fileOpen?.flush();
    this.checkForUpdates();
  }

  private registerContextMenu() {
    this.win?.webContents.on("context-menu", (_event, _params) => {
      // const menu = new Menu();

      // menu.append(
      //   new MenuItem({
      //     label: "Inspect Element",

      //     click: () => {
      //       this.win!.webContents.inspectElement(params.x, params.y);
      //     },
      //   }),
      // );

      // menu.popup({
      //   window: this.win!,
      // });
    });
  }

  private isDevToolsShortcut(input: Electron.Input) {
    const key = input.key.toLowerCase();
    const isMacInspectShortcut = input.meta && input.alt && key === "i";
    const isWindowsLinuxInspectShortcut =
      input.control && input.shift && key === "i";

    return key === "f12" || isMacInspectShortcut || isWindowsLinuxInspectShortcut;
  }

  private registerHandlers() {
    ConfigHandler.register();

    SessionHandler.register();

    ProfileHandler.register();

    HighTexHandler.register();

    PluginHandler.register();

    PluginScannerHandler.register();
    SnapshotHandler.register()
    ZoteroHandler.register();
    SharingHandler.register();
  }

  private registerUpdater() {
    if (this.updaterReady) {
      return;
    }

    this.updaterReady = true;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = {
      info: (message) => LoggerService.write(message, "updater:info"),
      warn: (message) => LoggerService.write(message, "updater:warn"),
      error: (message) => LoggerService.write(message, "updater:error"),
      debug: (message) => LoggerService.write(message, "updater:debug"),
    };

    autoUpdater.on("checking-for-update", () => {
      this.sendUpdaterStatus({ status: "checking" });
    });

    autoUpdater.on("update-available", (info) => {
      this.sendUpdaterStatus({ status: "available", info });
    });

    autoUpdater.on("update-not-available", (info) => {
      this.sendUpdaterStatus({ status: "not-available", info });
    });

    autoUpdater.on("download-progress", (progress) => {
      this.sendUpdaterStatus({ status: "downloading", progress });
    });

    autoUpdater.on("update-downloaded", async (info) => {
      this.updateDownloaded = true;
      this.sendUpdaterStatus({ status: "downloaded", info });

      const options = {
        type: "info",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "HighTex update is ready",
        message: `HighTex ${info.version} has been downloaded.`,
        detail: "Restart the app to install the latest update.",
      } satisfies Electron.MessageBoxOptions;

      const result = this.win
        ? await dialog.showMessageBox(this.win, options)
        : await dialog.showMessageBox(options);

      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });

    autoUpdater.on("error", (error) => {
      LoggerService.write(error, "updater:error");
      this.sendUpdaterStatus({
        status: "error",
        message: error.message,
      });
    });

    ipcMain.handle("updater:check", () => this.checkForUpdates(true));
    ipcMain.handle("updater:install", () => {
      if (!this.updateDownloaded) {
        return { ok: false, message: "The update has not finished downloading." };
      }

      autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    });
  }

  private async checkForUpdates(manual = false): Promise<UpdaterStatus> {
    if (this.isDevelopment || !app.isPackaged) {
      const status = {
        status: "disabled",
        reason: "Auto updater is only available in packaged builds.",
      } satisfies UpdaterStatus;

      if (manual) {
        this.sendUpdaterStatus(status);
      }

      return status;
    }

    try {
      const result = await autoUpdater.checkForUpdates();

      if (!result) {
        const status = {
          status: "error",
          message: "Updater did not return a check result.",
        } satisfies UpdaterStatus;

        this.sendUpdaterStatus(status);
        return status;
      }

      const status = result?.isUpdateAvailable
        ? ({
            status: "available",
            info: result.updateInfo,
          } satisfies UpdaterStatus)
        : ({
            status: "not-available",
            info: result.updateInfo,
          } satisfies UpdaterStatus);

      if (manual) {
        this.sendUpdaterStatus(status);
      }

      return status;
    } catch (error) {
      LoggerService.write(error, "updater:check");
      const status = {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to check for app updates.",
      } satisfies UpdaterStatus;

      this.sendUpdaterStatus(status);
      return status;
    }
  }

  private sendUpdaterStatus(status: UpdaterStatus) {
    this.win?.webContents.send("updater:status", status);
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
