import { app } from "electron";
import { autoUpdater, type AppUpdater } from "electron-updater";
import { MacManualUpdater } from "./mac-downloader";
import { MacUpdateInstaller } from "./mac-installer";
import type { InstallContext, PlatformUpdater } from "./types";

export class NativePlatformUpdater implements PlatformUpdater {
  constructor(readonly client: AppUpdater) {}
  async install(context: InstallContext): Promise<"quitting"> {
    context.quitting();
    this.client.quitAndInstall(false, true);
    return "quitting";
  }
  cancel() {}
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
        !(await context.prepareEditors())
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
