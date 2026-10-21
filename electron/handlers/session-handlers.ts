import { BrowserWindow } from "electron";
import { parseAccountUser } from "../service/auth-client";
import { desktopAuth } from "../service/auth-service";
import { ServerService } from "../service/server-service";
import { LoggerService } from "../service/logger-service";
import { SessionService } from "../service/session-service";
import { IPCMain } from "@main/utilities/ipc-main";

export class SessionHandler {
  private static pendingUser?: Promise<User | false>;

  public static async broadcastSession() {
    const windows = BrowserWindow.getAllWindows();
    const user = SessionService.getUser();
    for (const win of windows) {
      if (win.isDestroyed()) continue;
      try {
        win.webContents.send("session:changed", user || false);
      } catch (err) {
        LoggerService.write(err, "broadcastSession");
      }
    }
  }

  public static async user(): Promise<User | false> {
    if (this.pendingUser) return this.pendingUser;
    this.pendingUser = this.loadUser().finally(() => {
      this.pendingUser = undefined;
    });
    return this.pendingUser;
  }

  private static async loadUser(): Promise<User | false> {
    const token = SessionService.getToken();
    const previousUser = SessionService.getUser();
    if (!token) {
      SessionService.clearUser();
      if (previousUser) await this.broadcastSession();
      return false;
    }
    try {
      const res = await ServerService.request<{ message: RawUser }>("/me");
      if (token !== SessionService.getToken())
        return SessionService.getUser() ?? false;

      const currentUser = SessionService.getUser();
      const user = parseAccountUser(res.message);

      if (user) {
        SessionService.setUser(user);
      } else {
        SessionService.clearUser();
      }

      if (JSON.stringify(currentUser) !== JSON.stringify(user)) {
        await this.broadcastSession();
      }

      return SessionService.getUser() ?? false;
    } catch (err) {
      if (token !== SessionService.getToken())
        return SessionService.getUser() ?? false;
      LoggerService.write(err, "session:user");
      const status = (err as { response?: { status?: number } } | null)
        ?.response?.status;
      // Offline/permission failures do not prove that the cached token is invalid.
      if (status !== 401) return SessionService.getUser() ?? false;
      desktopAuth.cancel();
      SessionService.clear();
      if (previousUser) await this.broadcastSession();
      return false;
    }
  }
  public static async login(
    email: string,
    password: string,
  ): Promise<User | false> {
    const result = await desktopAuth.login(email, password);
    return result.ok ? result.data : false;
  }

  static register() {
    SessionService.onExpired = () => {
      desktopAuth.cancel();
      void this.broadcastSession();
    };
    IPCMain.handle("session:browser:start", () => desktopAuth.start());
    IPCMain.handle("session:browser:status", () => desktopAuth.status());
    IPCMain.handle("session:browser:cancel", () => desktopAuth.cancel());
    IPCMain.handle("session:sign-in", (_, email: string, password: string) =>
      desktopAuth.login(email, password),
    );
    IPCMain.handle("session:user", () => SessionHandler.user());

    IPCMain.handle(
      "session:login",
      (_event, email: string, password: string) => {
        return SessionHandler.login(email, password);
      },
    );

    IPCMain.handle("session:logout", () => desktopAuth.logout());
  }
}
