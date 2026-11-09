import { app, type BrowserWindow } from "electron";
import { IPCMain } from "../utilities/ipc-main";
import { LoggerService } from "../service/logger-service";
import { createPlatformUpdater } from "./platform";
import type { InstallResult, PlatformUpdater, UpdaterStatus } from "./types";
import type { UpdateDownloadedEvent } from "electron-updater";

export interface UpdaterContext {
  storageRoot(): string;
  isDev(): boolean;
  window(): BrowserWindow | null;
  profileSaving(): boolean;
  prepareEditors(): Promise<boolean>;
}

/** OS selection and lifecycle live here; the application only forwards its window lifecycle. */
export class UpdaterFacade {
  private registered = false;
  private manual = false;
  private phase: "idle" | "preparing" | "quitting" = "idle";
  private downloaded: UpdateDownloadedEvent | null = null;
  private status: UpdaterStatus | null = null;
  constructor(
    private readonly context: UpdaterContext,
    private readonly platform: PlatformUpdater = createPlatformUpdater(
      context.storageRoot,
    ),
  ) {}

  register() {
    if (this.registered) return;
    this.registered = true;
    const updater = this.platform.client;
    updater.autoDownload = false;
    updater.logger = {
      info: (message) => LoggerService.write(message, "updater:info"),
      warn: (message) => LoggerService.write(message, "updater:warn"),
      error: (message) => LoggerService.write(message, "updater:error"),
      debug: (message) => LoggerService.write(message, "updater:debug"),
    };
    updater.on("checking-for-update", () =>
      this.send({ status: "checking", manual: this.manual }),
    );
    updater.on("update-available", (info) => {
      if (this.phase !== "idle") return;
      this.downloaded = null;
      this.send({ status: "available", info, manual: this.manual });
    });
    updater.on("update-not-available", (info) =>
      this.send({ status: "not-available", info, manual: this.manual }),
    );
    updater.on("download-progress", (progress) =>
      this.send({ status: "downloading", progress, manual: this.manual }),
    );
    updater.on("update-downloaded", (info) => {
      this.downloaded = info;
      this.send({ status: "downloaded", info, manual: this.manual });
    });
    updater.on("error", (error) => {
      LoggerService.write(error, "updater:error");
      this.send({
        status: "error",
        message: error.message,
        manual: this.manual,
      });
    });
    app.on("quit", () => this.platform.didQuit());
    IPCMain.handle("updater:check", () => this.check(true));
    IPCMain.handle("updater:status", () => this.status);
    IPCMain.handle("updater:download", () => this.download());
    IPCMain.handle("updater:install", (event) => {
      if (event.sender !== this.context.window()?.webContents)
        return {
          ok: false,
          message: "Install updates from the main application window.",
        };
      return this.install();
    });
  }

  async check(manual = false): Promise<UpdaterStatus> {
    if (this.phase !== "idle") return { status: "installing", manual };
    if (this.context.isDev() || !app.isPackaged) {
      const status = {
        status: "disabled",
        reason: "Auto updater is only available in packaged builds.",
        manual,
      } satisfies UpdaterStatus;
      if (manual) this.send(status);
      return status;
    }
    try {
      this.manual = manual;
      const result = await this.platform.client.checkForUpdates();
      if (!result) throw Error("Updater did not return a check result.");
      const status: UpdaterStatus = result.isUpdateAvailable
        ? { status: "available", info: result.updateInfo, manual }
        : { status: "not-available", info: result.updateInfo, manual };
      if (manual) this.send(status);
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
      this.send(status);
      return status;
    } finally {
      this.manual = false;
    }
  }

  download() {
    if (this.phase !== "idle") throw Error("An update is being installed.");
    return this.platform.client.downloadUpdate();
  }

  async install(): Promise<InstallResult> {
    if (this.phase !== "idle")
      return { ok: false, message: "An update is already being prepared." };
    const downloaded = this.downloaded;
    if (!downloaded)
      return { ok: false, message: "The update has not finished downloading." };
    if (this.context.profileSaving())
      return {
        ok: false,
        message: "Wait for the current profile save to finish, then try again.",
      };
    this.phase = "preparing";
    this.send({ status: "installing", manual: true });
    try {
      const result = await this.platform.install({
        profileSaving: this.context.profileSaving,
        prepareEditors: this.context.prepareEditors,
        quitting: () => {
          this.phase = "quitting";
        },
      });
      if (result === "cancelled") return { ok: false, cancelled: true };
      this.phase = "quitting";
      return { ok: true };
    } catch (error) {
      this.platform.cancel();
      LoggerService.write(error, "updater:install");
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The update could not be installed.",
      };
    } finally {
      if (this.phase !== "quitting") {
        this.phase = "idle";
        this.send({
          status: "downloaded",
          info: downloaded,
          manual: false,
          retry: true,
        });
      }
    }
  }

  cancelInstall() {
    this.platform.cancel();
    if (this.phase === "quitting") {
      this.phase = "idle";
      if (this.downloaded)
        this.send({
          status: "downloaded",
          info: this.downloaded,
          manual: false,
          retry: true,
        });
    }
  }

  async acknowledgeStartup() {
    try {
      const failure = await this.platform.acknowledgeStartup(app.getVersion());
      if (failure)
        this.send({
          status: "error",
          manual: true,
          message:
            failure === "rolled-back"
              ? "The new version could not start. The previous version has been restored."
              : "The update could not be installed. The previous application was preserved; see mac-updates for recovery details.",
        });
    } catch (error) {
      LoggerService.write(error, "updater:receipt");
    }
  }

  private send(status: UpdaterStatus) {
    this.status = status;
    const window = this.context.window();
    if (window && !window.isDestroyed())
      window.webContents.send("updater:status", status);
  }
}
