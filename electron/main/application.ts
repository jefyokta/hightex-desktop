import fs from "fs";
import { app, BrowserWindow, Menu, MenuItem, dialog } from "electron";
import { ConfigService } from "../service/config-service";
import en from "../../src/locales/en.json";
import id from "../../src/locales/id.json";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ConfigHandler } from "../handlers/config-handler";
import { ProfileHandler } from "../handlers/profile-handlers";
import { SessionHandler } from "../handlers/session-handlers";
import { HighTexHandler } from "../handlers/hightex-handlers";
import { ZoteroHandler } from "../handlers/zotero-handler";
import { FileOpenManager } from "../managers/file-open-manager";
import { SharingHandler } from "../handlers/sharing-handler";
import { DatabaseBootstraper } from "@main/database/core/bootstrapper";
import { NetworkService } from "@main/service/network-service";
import { SnapshotHandler } from "@main/handlers/snapshot-handler";
import { LoggerService } from "@main/service/logger-service";
import { CLIService } from "@main/service/cli-service";
import { getCliArgs, isCliInvocation } from "./cli-args";
import { HightexProtocol } from "@main/server/hightex-protocol";
import { firstInstalled } from "@main/utilities/first-installed";
import { DocumentErrorHandler } from "@main/handlers/document-error-handler";
import { FileSystemHandler } from "@main/handlers/file-system-handler";
import { EditorHandler } from "@main/handlers/editor-handler";
import { appEvent } from "@main/event";
import { WindowHandler } from "@main/handlers/window-handler";
import { DeepLinkService } from "@main/service/deep-link-service";
import { ApplicationRuntime } from "./application-runtime";
import { WorkspaceRuntime } from "../workspaces/runtime";
import { registerWorkspaceHandlers } from "../workspaces/handlers";
import { EditorWindow } from "../windows/editor-window";
import { UpdaterFacade } from "../updater/facade";

export class Application {
  public profileDraftBusy = false;
  private win: BrowserWindow | null = null;

  private server!: HightexProtocol;
  private fileOpen?: FileOpenManager;
  private documentWindowLoading?: Promise<void>;
  private pendingLinks: string[] = [];
  private pendingDocumentFiles: string[] = [];
  private linksReady = false;
  private readonly updater: UpdaterFacade;

  private readonly __dirname = path.dirname(fileURLToPath(import.meta.url));

  static instance: Application;

  public get window() {
    return this.win;
  }

  private windowOptions = {
    show: true,
  };

  constructor() {
    Application.instance = this;
    this.updater = new UpdaterFacade({
      storageRoot: () => WorkspaceRuntime.root ?? app.getPath("userData"),
      isDev: () => this.isDev,
      window: () => this.win,
      profileSaving: () => this.profileDraftBusy,
      prepareEditors: () => EditorWindow.prepareForWorkspaceSwitch(),
    });
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

  public static get isDev(): boolean {
    return ApplicationRuntime.isDev;
  }

  public get isDev(): boolean {
    return Application.isDev;
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
    if (process.defaultApp && process.argv[1])
      app.setAsDefaultProtocolClient("hightex", process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    else app.setAsDefaultProtocolClient("hightex");
    app.on("open-url", (event, url) => {
      event.preventDefault();
      if (!this.linksReady) this.pendingLinks.push(url);
      else void this.handleDeepLink(url);
    });
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

    this.createProtocol();
    this.fileOpen = new FileOpenManager(
      (filePath) => {
        void this.openDocumentFile(filePath).catch((error) => {
          LoggerService.write(error, "file:open");
        });
      },
      async (args) => {
        await this.handleCliArgs(args);
      },
    );
    this.fileOpen.bootstrap(app);

    app.whenReady().then(() => this.onReady());
  }

  public createProtocol() {
    HightexProtocol.registerSchemesAsPrivileged();
    this.server = new HightexProtocol();
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

  private async createWindow(options: { show?: boolean } = {}, route = "/") {
    this.windowOptions = { ...options, ...this.windowOptions };
    const publicPath =
      this.isDev && process.env.VITE_DEV_SERVER_URL
        ? this.publicRoot
        : this.rendererDist;

    this.win = new BrowserWindow({
      show: false,
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
        devTools: this.isDev,
      },
    });

    if (this.isDev && options.show !== false) {
      this.win.webContents.openDevTools();
    }

    this.win.webContents.on("before-input-event", (event, input) => {
      if (!this.isDev && this.isDevToolsShortcut(input)) {
        event.preventDefault();
      }
    });
    const mainWindow = this.win;
    mainWindow.webContents.on("will-prevent-unload", (event) => {
      const messages = (ConfigService.getKey("language") === "id" ? id : en)
        .profile;
      if (this.profileDraftBusy) {
        this.updater.cancelInstall();
        dialog.showMessageBoxSync(mainWindow, {
          type: "info",
          message: messages.save_pending,
          detail: messages.save_pending_description,
          buttons: [messages.stay],
        });
        return;
      }
      const response = dialog.showMessageBoxSync(mainWindow, {
        type: "question",
        message: messages.leave_title,
        detail: messages.leave_description,
        buttons: [messages.stay, messages.discard],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (response === 1) event.preventDefault();
      else this.updater.cancelInstall();
    });

    this.win.webContents.on("did-finish-load", () => {
      void this.updater.acknowledgeStartup();
      if (this.windowOptions.show) {
        this.win?.show();
      }
      this.win?.webContents.send(
        "main-process-message",
        new Date().toLocaleString(),
      );
      this.win?.webContents.send("first-installed", firstInstalled());
    });

    this.win.on("maximize", () => {
      this.win?.webContents.send("win:maximize", true);
    });

    this.win.on("unmaximize", () => {
      this.win?.webContents.send("win:maximize", false);
    });

    this.server.start();
    const initialRoute = WorkspaceRuntime.migrating
      ? "/profiles/migration"
      : route;

    if (
      this.isDev &&
      process.env.VITE_DEV_SERVER_URL &&
      (!WorkspaceRuntime.profile || WorkspaceRuntime.migrating)
    ) {
      await this.win.loadURL(
        new URL(initialRoute, process.env.VITE_DEV_SERVER_URL).href,
      );
      return;
    }

    await this.win.loadURL(this.server.url + initialRoute);
  }

  public async openProfile() {
    if (!this.win || this.win.isDestroyed()) {
      await this.createWindow({}, "/profile");
    } else {
      this.win.webContents.send("application:navigate", "/profile");
    }

    if (!this.win || this.win.isDestroyed()) return;
    if (this.win.isMinimized()) this.win.restore();
    this.win.show();
    this.win.focus();
  }

  public async openDocumentFile(filePath: string) {
    if (WorkspaceRuntime.switching) {
      WorkspaceRuntime.switchInterrupted = true;
      this.pendingDocumentFiles.push(filePath);
      return;
    }
    if (!this.win || this.win.isDestroyed()) {
      this.documentWindowLoading = this.createWindow().finally(() => {
        this.documentWindowLoading = undefined;
      });
    }
    await this.documentWindowLoading;
    const window = this.win;
    if (!window || window.isDestroyed()) {
      throw new Error("The document import window was closed.");
    }
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    window.webContents.send("file:open", filePath);
  }

  private async onReady() {
    await this.prepareCoreServices();
    this.registerHandlers();
    appEvent.addListener("unauthorized", () => {
      void SessionHandler.user();
    });
    EditorHandler.register(this);
    WindowHandler.register();
    this.updater.register();
    await this.createWindow();
    this.registerContextMenu();
    this.linksReady = true;
    for (const url of this.pendingLinks.splice(0))
      await this.handleDeepLink(url);
    this.fileOpen?.flush();
    if (!WorkspaceRuntime.migrating) this.updater.check();
  }

  public async prepareCliMode() {
    await this.prepareCoreServices();
    this.registerHandlers();
    this.updater.register();

    await this.createWindow({ show: false });
  }

  public async closeCliMode() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy();
    }
    this.win = null;
  }

  private async prepareCoreServices() {
    new DatabaseBootstraper().tap();
    NetworkService.tap();
  }

  private async handleDeepLink(url: string) {
    if (WorkspaceRuntime.switching) {
      WorkspaceRuntime.switchInterrupted = true;
      this.pendingLinks.push(url);
      return;
    }
    try {
      await new DeepLinkService(url).handle();
      this.win?.show();
      this.win?.focus();
    } catch {
      LoggerService.write(
        new Error("Deep link could not be handled"),
        "deep-link",
      );
    }
  }

  public async resumePendingOpens() {
    if (WorkspaceRuntime.switching) return;
    const links = this.pendingLinks.splice(0);
    const files = this.pendingDocumentFiles.splice(0);
    for (const link of links) await this.handleDeepLink(link);
    for (const file of files) await this.openDocumentFile(file);
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
    this.win?.webContents.on("context-menu", (_event, params) => {
      if (!this.isDev) return;
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
    registerWorkspaceHandlers(this);
    ConfigHandler.register();
    SessionHandler.register();
    ProfileHandler.register(this);
    HighTexHandler.register();
    SnapshotHandler.register();
    ZoteroHandler.register();
    DocumentErrorHandler.register();
    SharingHandler.register();
    FileSystemHandler.register();
  }

  public resolveRendererUrl(route = "/") {
    if (
      this.isDev &&
      process.env.VITE_DEV_SERVER_URL &&
      !WorkspaceRuntime.profile
    ) {
      return `${process.env.VITE_DEV_SERVER_URL}${route}`;
    }

    if (!this.server) {
      throw new Error("Renderer server has not started yet");
    }

    const normalized = route.startsWith("/") ? route : `/${route}`;

    return `${this.server.url}${normalized}`;
  }
}
