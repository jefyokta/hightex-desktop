import { shell } from "electron";
import { AuthClient } from "./auth-client";
import { accountRequest } from "./account-transport";
import { SessionService } from "./session-service";
import { ServerService } from "./server-service";
import { SessionHandler } from "../handlers/session-handlers";
export const desktopAuth = new AuthClient({
  serverUrl: () => ServerService.getServerUrl(),
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
