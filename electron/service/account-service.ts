import { shell } from "electron";
import { AccountClient } from "../clients/account-client";
import { accountRequest } from "../transports/account-transport";
import { submissionService } from "./submission-service";
import { SessionService } from "./session-service";
import { ServerUrl } from "../url/server-url";
import { SessionHandler } from "../handlers/session-handlers";
import { ProfileService } from "./profile-service";
import { WorkspaceRuntime } from "../workspaces/runtime";
export const accountService = new AccountClient({
  open: (url) => shell.openExternal(url),
  context: () => submissionService.context(),
  request: (endpoint, options = {}) =>
    accountRequest(ServerUrl.instance.api.href, endpoint, {
      ...options,
      headers: {
        ...Object.fromEntries(new Headers(options.headers)),
        Authorization: `Bearer ${SessionService.getToken()}`,
      },
    }),
  image: async (url) => {
    const headers = new Headers();
    const token = SessionService.getToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
      headers,
    });
    if (Number(response.headers.get("content-length")) > 2 * 1024 * 1024)
      throw Error("Image too large");
    return {
      ok: response.ok,
      type: response.headers.get("content-type")?.split(";")[0] ?? "",
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  },
  accept: async (user) => {
    SessionService.setUser(user);
    await SessionHandler.broadcastSession();
  },
  cachePicture: (session, picture) => {
    const workspace = WorkspaceRuntime.profile;
    if (
      workspace?.type !== "cloud" ||
      workspace.accountId !== session.accountId
    )
      return;
    if (picture) ProfileService.setProfilePicture(picture);
    else ProfileService.clearProfilePicture();
  },
});
