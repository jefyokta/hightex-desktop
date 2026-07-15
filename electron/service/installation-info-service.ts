import { HasStorage } from "./concerns/has-storage";

export class InstallationInfo extends HasStorage {
  protected storageName: string = "install";

  isFirstInstall() {
    return !!this.storage.get().installedAt;
  }
  assignFistInstall() {
    this.storage.set({
      ...this.storage.get(),
      installedAt: new Date().toISOString(),
    });
  }
}
