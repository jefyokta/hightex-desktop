// import { ConfigService } from "./config-service";
import { ProfileService } from "./profile-service";
import { SessionService } from "./session-service";
import { WorkspaceRuntime } from "../workspaces/runtime";

export class DocumentProfileService {
  static get(): DocumentProfile {
    const workspace = WorkspaceRuntime.profile;
    const user =
      workspace?.type === "cloud" ? SessionService.getUser() : undefined;
    const belongsToWorkspace = user && String(user.id) === workspace?.accountId;
    const saved = ProfileService.get();
    const cachedCloud = ProfileService.getCloudProfile();
    const cloudProfile = user as (User & { cv?: unknown }) | undefined;
    return {
      ...saved,
      ...(workspace?.type === "cloud"
        ? { name: "", nim: "", cv: "", ...cachedCloud }
        : {}),
      ...(belongsToWorkspace
        ? {
            name: user.name,
            nim: user.identity_number ?? cachedCloud?.nim ?? "",
            cv:
              typeof cloudProfile?.cv === "string"
                ? cloudProfile.cv
                : cloudProfile?.cv === null
                  ? ""
                  : (cachedCloud?.cv ?? ""),
          }
        : {}),
      isCloud: workspace?.type === "cloud",
    };
  }
}
