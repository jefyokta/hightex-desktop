import { shell } from "electron";
import { AuthClient } from "./auth-client";
import { accountRequest } from "./account-transport";
import { SessionService } from "./session-service";
import { ServerUrl } from "../url/server-url";
import { SessionHandler } from "../handlers/session-handlers";
export const desktopAuth = new AuthClient({
  serverUrl: () => ServerUrl.instance.api.href,
  request: accountRequest,
  session: () => ({
    token: SessionService.getToken(),
    user: SessionService.getUser(),
  }),
  save: (user, token, expiresAt) => {
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
