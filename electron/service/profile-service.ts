import { app, BrowserWindow } from "electron";
import Store from "electron-store";
import path from "path";
import fs from "fs";

export class ProfileService {
  static store = new Store<{
    profile: Profile | LegacyProfile;
    cloudProfile?: Pick<Profile, "name" | "nim" | "cv">;
  }>();

  private static default(): Profile {
    return {
      name: "",
      nim: "",
      advisorName: "",
      advisorNip: "",
      cv: "",
      committee: {},
    };
  }
  static profilePicturePath: string = path.join(
    app.getPath("userData"),
    "images",
    "profile_picture.webp",
  );

  static get(): Profile {
    const profile = this.store.get("profile");
    if (!profile) {
      return this.default();
    }
    if ("cv" in profile) {
      return profile;
    }
    return { ...this.default(), ...profile };
  }

  static set(profile: Partial<Profile>) {
    const current = this.get();

    const updated: Profile = {
      ...current,
      ...profile,
    };

    this.store.set("profile", updated);
    this.broadcastIdentityChange();

    return updated;
  }

  /** Cache account identity in this Cloud workspace for offline document use. */
  static setCloudProfile(profile: Pick<Profile, "name" | "nim" | "cv">) {
    this.store.set("cloudProfile", profile);
    this.broadcastIdentityChange();
  }

  static getCloudProfile() {
    return this.store.get("cloudProfile");
  }

  static clear() {
    this.store.set("profile", this.default());
    this.broadcastIdentityChange();
  }
  static getProfilePicture() {
    if (!fs.existsSync(this.profilePicturePath)) {
      return false;
    }

    return fs.readFileSync(this.profilePicturePath);
  }

  static setProfilePicture(file: Uint8Array) {
    const directory = path.dirname(this.profilePicturePath);
    // if(!(fs.lstatSync(directory).isDirectory())){
    fs.mkdirSync(directory, { recursive: true });
    // }

    fs.writeFileSync(this.profilePicturePath, file);
    this.broadcastIdentityChange();
  }

  static clearProfilePicture() {
    fs.rmSync(this.profilePicturePath, { force: true });
    this.broadcastIdentityChange();
  }

  static broadcastIdentityChange() {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) window.webContents.send("profile:changed");
    });
  }
}
