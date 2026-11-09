import { app } from "electron";
import { autoUpdater, type AppUpdater } from "electron-updater";
import { MacManualUpdater } from "./mac-downloader";
import { MacUpdateInstaller } from "./mac-installer";
import type { InstallContext, PlatformUpdater } from "./types";

export class NativePlatformUpdater implements PlatformUpdater {
  private cancelled = false;
  constructor(readonly client: AppUpdater) {}
  async install(context: InstallContext): Promise<"quitting" | "cancelled"> {
    this.cancelled = false;
    if (
      context.profileSaving() ||
      !(await context.prepareEditors()) ||
      this.cancelled ||
      context.profileSaving()
    )
      return "cancelled";
    // BaseUpdater reports synchronous installation failures via an event
    // instead of throwing them from quitAndInstall.
    let failure: Error | undefined;
    const onError = (error: Error) => {
      failure = error;
    };
    this.client.on("error", onError);
    try {
      context.quitting();
      this.client.quitAndInstall(false, true);
      if (failure) throw failure;
    } finally {
      this.client.removeListener("error", onError);
    }
    return "quitting";
  }
  cancel() {
    this.cancelled = true;
  }
  didQuit() {}
  async acknowledgeStartup() {
    return undefined;
  }
}

export class MacPlatformUpdater implements PlatformUpdater {
  readonly client = new MacManualUpdater();
  private readonly installer: MacUpdateInstaller;

  constructor(storageRoot: string) {
    this.installer = new MacUpdateInstaller(storageRoot);
  }

  async install(context: InstallContext): Promise<"quitting" | "cancelled"> {
    try {
      const artifact = this.client.downloadedArtifact();
      await this.installer.prepare(artifact);
      await this.installer.launch();
      if (
        this.installer.wasCancelled ||
        context.profileSaving() ||
        !(await context.prepareEditors()) ||
        this.installer.wasCancelled ||
        context.profileSaving()
      ) {
        this.installer.cancel();
        return "cancelled";
      }
      context.quitting();
      app.quit();
      return this.installer.wasCancelled ? "cancelled" : "quitting";
    } catch (error) {
      if (this.installer.wasCancelled) return "cancelled";
      throw error;
    }
  }

  cancel() {
    this.installer.cancel();
  }
  didQuit() {
    this.installer.commitQuit();
  }
  acknowledgeStartup(version: string) {
    return this.installer.acknowledgeLaunch(version);
  }
}

export function createPlatformUpdater(
  storageRoot: () => string,
  platform: NodeJS.Platform = process.platform,
): PlatformUpdater {
  return platform === "darwin"
    ? new MacPlatformUpdater(storageRoot())
    : new NativePlatformUpdater(autoUpdater);
}
