import { app } from "electron";
import Store from "electron-store";
import path from "path";
import fs from "fs"

export class ProfileService {
  static store = new Store<{ profile: Profile | LegacyProfile }>();

  private static default(): Profile {
    return {
      name: "Guest",
      nim: "12250xxxx",
      advisorName: "Advisor",
      advisorNip: "1111",
      cv:""
    };
  }
  static profilePicturePath:string = path.join(app.getPath("userData"),"images","profile_picture.webp");

  static get(): Profile {
    const profile = this.store.get("profile");
    if(!profile){
      return this.default()
    }
    if("cv" in profile){
     return profile
    }
    return {...this.default(),...profile};
  }

  static set(profile: Partial<Profile>) {
    const current = this.get();

    const updated: Profile = {
      ...current,
      ...profile,
    };

    this.store.set("profile", updated);

    return updated;
  }

  static clear() {
    this.store.set("profile", this.default());
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

  }

}
