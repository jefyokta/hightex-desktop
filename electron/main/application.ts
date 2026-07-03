import fs from "fs";
import { app, BrowserWindow, ipcMain } from "electron";
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
import { FileOpenManager } from "../service/file-open-service";
import { SharingHandler } from "../handlers/sharing-handler";
import { DatabaseBootstraper } from "@main/database/core/bootstrapper";
import { NetworkService } from "@main/service/network-service";
import { SnapshotHandler } from "@main/handlers/snapshot-handler";
import { ServerService } from "@main/service/server-service";
import { LoggerService } from "@main/service/logger-service";
import { CLIService } from "@main/service/cli-service";
import { getCliArgs, isCliInvocation } from "./cli-args";
import { HightexProtocol } from "@main/server/hightex-protocol";

type UpdaterStatus =
  | { status: "disabled"; reason: string; manual: boolean }
  | { status: "checking"; manual: boolean }
  | { status: "available"; info: UpdateInfo; manual: boolean }
  | { status: "not-available"; info: UpdateInfo; manual: boolean }
  | { status: "downloading"; progress: ProgressInfo; manual: boolean }
  | { status: "downloaded"; info: UpdateDownloadedEvent; manual: boolean }
  | { status: "error"; message: string; manual: boolean };

export class Application {
  private win: BrowserWindow | null = null;

  private server!: HightexProtocol;
  private fileOpen?: FileOpenManager;
  private updaterReady = false;
  private updateDownloaded = false;
  private checkingForUpdatesManually = false;
  private lastUpdaterStatus: UpdaterStatus | null = null;

  private readonly __dirname = path.dirname(fileURLToPath(import.meta.url));

  static instance: Application;

  public get window() {
    return this.win;
  }

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

    HightexProtocol.registerSchemesAsPrivileged();
    this.server = new HightexProtocol(this.rendererDist);

    this.fileOpen = new FileOpenManager(
      (filePath) => {
        this.win?.webContents.send("file:open", filePath);
        this.win?.focus();
      },
      async (args) => {
        await this.handleCliArgs(args);
      },
    );
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

  private async createWindow(options: { show?: boolean } = {}) {
    const publicPath = process.env.VITE_DEV_SERVER_URL
      ? this.publicRoot
      : this.rendererDist;

    this.win = new BrowserWindow({
      show: options.show ?? true,
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
      },
    });

    if (this.isDevelopment && options.show !== false) {
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

    this.server.start();
    await this.win.loadURL(this.server.url);
  }

  private async onReady() {
    await this.prepareCoreServices();
    this.registerHandlers();
    this.registerUpdater();
    await this.createWindow();

    this.registerContextMenu();
    this.fileOpen?.flush();
    this.checkForUpdates();
  }

  public async prepareCliMode() {
    await this.prepareCoreServices();
    this.registerHandlers();
    this.registerUpdater();

    await this.createWindow({ show: false });
  }

  public async closeCliMode() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy();
    }
    this.win = null;
  }

  private async prepareCoreServices() {
    await ServerService.checkForHost().catch(()=>{});
    KeyManagerService.ensure();

    DefaultPluginsBootstrapper.installAll();
    new DatabaseBootstraper().tap();
    PluginManager.loadAll();
    NetworkService.tap();
  }

  private async handleCliArgs(args: string[]) {
    const cliArgs = getCliArgs(args);

    if (!isCliInvocation(cliArgs)) return;

    try {
      if (!this.win) return;

      await new CLIService(cliArgs, this.win).handle();
    } catch (error) {
      LoggerService.write(error, "cli:second-instance");
    }
  }

  private registerContextMenu() {
    this.win?.webContents.on("context-menu", (_event, _params) => {});
  }

  private isDevToolsShortcut(input: Electron.Input) {
    const key = input.key.toLowerCase();
    const isMacInspectShortcut = input.meta && input.alt && key === "i";
    const isWindowsLinuxInspectShortcut =
      input.control && input.shift && key === "i";

    return (
      key === "f12" || isMacInspectShortcut || isWindowsLinuxInspectShortcut
    );
  }

  private registerHandlers() {
    ConfigHandler.register();
    SessionHandler.register();
    ProfileHandler.register();
    HighTexHandler.register();
    PluginHandler.register();
    PluginScannerHandler.register();
    SnapshotHandler.register();
    ZoteroHandler.register();
    SharingHandler.register();
  }

  private registerUpdater() {
    if (this.updaterReady) {
      return;
    }

    this.updaterReady = true;
    autoUpdater.autoDownload = false;
    autoUpdater.logger = {
      info: (message) => LoggerService.write(message, "updater:info"),
      warn: (message) => LoggerService.write(message, "updater:warn"),
      error: (message) => LoggerService.write(message, "updater:error"),
      debug: (message) => LoggerService.write(message, "updater:debug"),
    };

    autoUpdater.on("checking-for-update", () => {
      this.sendUpdaterStatus({
        status: "checking",
        manual: this.checkingForUpdatesManually,
      });
    });

    autoUpdater.on("update-available", (info) => {
      this.sendUpdaterStatus({
        status: "available",
        info,
        manual: this.checkingForUpdatesManually,
      });
    });

    autoUpdater.on("update-not-available", (info) => {
      this.sendUpdaterStatus({
        status: "not-available",
        info,
        manual: this.checkingForUpdatesManually,
      });
    });

    autoUpdater.on("download-progress", (progress) => {
      this.sendUpdaterStatus({
        status: "downloading",
        progress,
        manual: this.checkingForUpdatesManually,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      this.updateDownloaded = true;
      this.sendUpdaterStatus({
        status: "downloaded",
        info,
        manual: this.checkingForUpdatesManually,
      });
    });

    autoUpdater.on("error", (error) => {
      LoggerService.write(error, "updater:error");
      this.sendUpdaterStatus({
        status: "error",
        message: error.message,
        manual: this.checkingForUpdatesManually,
      });
    });

    ipcMain.handle("updater:check", () => this.checkForUpdates(true));
    ipcMain.handle("updater:status", () => this.lastUpdaterStatus);
    ipcMain.handle("updater:download", () => autoUpdater.downloadUpdate());
    ipcMain.handle("updater:install", () => {
      if (!this.updateDownloaded) {
        return {
          ok: false,
          message: "The update has not finished downloading.",
        };
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
        manual,
      } satisfies UpdaterStatus;

      if (manual) {
        this.sendUpdaterStatus(status);
      }

      return status;
    }

    try {
      this.checkingForUpdatesManually = manual;
      const result = await autoUpdater.checkForUpdates();

      if (!result) {
        const status = {
          status: "error",
          message: "Updater did not return a check result.",
          manual,
        } satisfies UpdaterStatus;

        this.sendUpdaterStatus(status);
        return status;
      }

      const status = result?.isUpdateAvailable
        ? ({
            status: "available",
            info: result.updateInfo,
            manual,
          } satisfies UpdaterStatus)
        : ({
            status: "not-available",
            info: result.updateInfo,
            manual,
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
        manual,
      } satisfies UpdaterStatus;

      this.sendUpdaterStatus(status);
      return status;
    } finally {
      this.checkingForUpdatesManually = false;
    }
  }

  private sendUpdaterStatus(status: UpdaterStatus) {
    this.lastUpdaterStatus = status;
    this.win?.webContents.send("updater:status", status);
  }

  public resolveRendererUrl(route = "/") {
    if (process.env.VITE_DEV_SERVER_URL) {
      return `${process.env.VITE_DEV_SERVER_URL}${route}`;
    }

    if (!this.server) {
      throw new Error("Renderer server has not started yet");
    }

    const normalized = route.startsWith("/") ? route : `/${route}`;

    return `${this.server.url}${normalized}`;
  }
}