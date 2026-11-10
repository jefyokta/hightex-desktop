import { ProfileService } from "./profile-service";
import { SessionService } from "./session-service";
import { WorkspaceRuntime } from "../workspaces/runtime";
import { cloudProfileFromUser } from "../clients/cloud-profile";

export class DocumentProfileService {
  static get(): DocumentProfile {
    const workspace = WorkspaceRuntime.profile;
    if (workspace?.type !== "cloud")
      return { ...ProfileService.get(), isCloud: false };
    const user = SessionService.getUser();
    const cached = ProfileService.getCloudProfile();
    const profile =
      user && String(user.id) === workspace.accountId
        ? cloudProfileFromUser(user, cached)
        : {
            name: "",
            nim: "",
            advisorName: "",
            advisorNip: "",
            cv: "",
            committee: {},
            ...cached,
          };
    return { ...profile, isCloud: true };
  }
}
