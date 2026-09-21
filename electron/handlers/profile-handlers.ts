import { ProfileService } from "../service/profile-service";
import { DocumentProfileService } from "../service/document-profile-service";
import { IPCMain } from "@main/utilities/ipc-main";

export class ProfileHandler {
  static register() {
    IPCMain.handle("profile:set", (_event, profile: Partial<Profile>) => {
      return ProfileService.set(profile);
    });

    IPCMain.handle("profile:get", () => {
      return DocumentProfileService.get();
    });

    IPCMain.handle("profile:reset", () => {
      return ProfileService.clear();
    });
    IPCMain.handle("profile:picture",()=>{
      return ProfileService.getProfilePicture()
    })
    IPCMain.handle("profile:picture.set",(_,file:Uint8Array)=>{
      return ProfileService.setProfilePicture(file)
    })
  }
}
