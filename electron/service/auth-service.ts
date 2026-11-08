import { shell } from "electron";
import { AuthClient } from "../clients/auth-client";
import { accountRequest } from "../transports/account-transport";
import { SessionService } from "./session-service";
import { ServerUrl } from "../url/server-url";
import { SessionHandler } from "../handlers/session-handlers";
import { WorkspaceRuntime } from "../workspaces/runtime";
import { WorkspaceRegistry } from "../workspaces/registry";
export const desktopAuth = new AuthClient({
  serverUrl: () => {
    if (
      WorkspaceRuntime.profile &&
      !WorkspaceRuntime.migrating &&
      !WorkspaceRuntime.profile.serverUrl
    )
      throw Error("Create or switch to a cloud profile to sign in.");
    return ServerUrl.instance.api.href;
  },
  request: accountRequest,
  session: () => ({
    token: SessionService.getToken(),
    user: SessionService.getUser(),
  }),
  save: (user, token, expiresAt) => {
    if (WorkspaceRuntime.root && !WorkspaceRuntime.migrating) {
      WorkspaceRuntime.profile = new WorkspaceRegistry(
        WorkspaceRuntime.root,
      ).bindAccount(String(user.id));
    }
    SessionService.setToken(token);
    SessionService.setExpiry(expiresAt);
    SessionService.setUser(user);
  },
  clear: () => SessionService.clear(),
  pending: () => SessionService.pendingBrowser(),
  setPending: (value) => SessionService.setPendingBrowser(value),
  broadcast: () => SessionHandler.broadcastSession(),
  open: (url) => shell.openExternal(url),
});
