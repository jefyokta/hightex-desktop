import { accountService } from "../service/account-service";
import { ProfileService } from "../service/profile-service";
import { DocumentProfileService } from "../service/document-profile-service";
import { IPCMain } from "@main/utilities/ipc-main";
import { BrowserWindow, type IpcMainInvokeEvent } from "electron";
import type { Application } from "../main/application";
import { WorkspaceRuntime } from "../workspaces/runtime";

export class ProfileHandler {
  static register(application: Application) {
    IPCMain.handle("profile:draft-state", (event, busy: boolean) => {
      if (
        BrowserWindow.fromWebContents(event.sender) !== application.window ||
        typeof busy !== "boolean"
      )
        throw Error("Only the main window can report profile draft state.");
      application.profileDraftBusy = busy;
    });
    const requireProfilePage = (event: IpcMainInvokeEvent) => {
      if (
        BrowserWindow.fromWebContents(event.sender) !== application.window ||
        !["/profile", "/profile/cv"].includes(
          new URL(event.senderFrame?.url ?? "about:blank").pathname,
        )
      )
        throw Error("Edit profile details in the main window's Profile page.");
    };
    const requireLocalProfile = (event: IpcMainInvokeEvent) => {
      requireProfilePage(event);
      if (WorkspaceRuntime.profile?.type !== "local")
        throw Error(
          "Cloud profiles must be saved to the bound HighTex account.",
        );
    };
    IPCMain.handle("account:settings", (_, sessionId: string) =>
      accountService.settings(sessionId),
    );
    IPCMain.handle("account:load", () => accountService.load());
    IPCMain.handle("account:update", (event, input: AccountProfileInput) => {
      requireProfilePage(event);
      return accountService.update(input);
    });
    IPCMain.handle("account:picture", (_, sessionId: string) =>
      accountService.picture(sessionId),
    );
    IPCMain.handle("profile:set", (_event, profile: Partial<Profile>) => {
      requireLocalProfile(_event);
      return ProfileService.set(profile);
    });

    IPCMain.handle("profile:get", () => {
      return DocumentProfileService.get();
    });
    IPCMain.handle("profile:cloud-cache", () =>
      WorkspaceRuntime.profile?.type === "cloud"
        ? (ProfileService.getCloudProfile() ?? null)
        : null,
    );

    IPCMain.handle("profile:reset", (event) => {
      requireLocalProfile(event);
      return ProfileService.clear();
    });
    IPCMain.handle("profile:picture", () => {
      return ProfileService.getProfilePicture();
    });
    IPCMain.handle("profile:picture.set", (event, file: Uint8Array | null) => {
      requireLocalProfile(event);
      if (file === null) return ProfileService.clearProfilePicture();
      return ProfileService.setProfilePicture(file);
    });
  }
}
