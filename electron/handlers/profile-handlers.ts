import { ipcMain } from "electron";
import { ProfileService } from "../service/profile-service";
import { DocumentProfileService } from "../service/document-profile-service";

export class ProfileHandler {
  static register() {
    ipcMain.handle("profile:set", (_event, profile: Partial<Profile>) => {
      return ProfileService.set(profile);
    });

    ipcMain.handle("profile:get", () => {
      return DocumentProfileService.get();
    });

    ipcMain.handle("profile:reset", () => {
      return ProfileService.clear();
    });
  }
}
