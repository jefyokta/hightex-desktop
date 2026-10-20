import { BrowserWindow } from "electron";
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
      const user = res.message || false;

      if (user) {
        SessionService.setUser(user);
      } else {
        SessionService.clearUser();
      }

      if (currentUser?.id !== user?.id) {
        await this.broadcastSession();
      }

      return SessionService.getUser() ?? false;
    } catch (err) {
      if (token !== SessionService.getToken())
        return SessionService.getUser() ?? false;
      LoggerService.write(err, "session:user");
      SessionService.clearUser();
      if (previousUser) await this.broadcastSession();

      return false;
    }
  }
  public static async login(
    email: string,
    password: string,
  ): Promise<User | false> {
    try {
      // SessionService.login()
      const res = await ServerService.request<{
        data: { user: User; token: string };
      }>("/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          exp: 3600 * 24 * 30,
        }),
      });

      const { user, token } = res.data;

      if (!user || !token) return false;

      SessionService.setToken(token);
      SessionService.setUser(user);

      await this.broadcastSession();

      return user;
    } catch (err) {
      LoggerService.write(err, "session:login");
      return false;
    }
  }

  static register() {
    IPCMain.handle("session:user", () => SessionHandler.user());

    IPCMain.handle(
      "session:login",
      (_event, email: string, password: string) => {
        return SessionHandler.login(email, password);
      },
    );

    IPCMain.handle("session:logout", async () => {
      SessionService.clear();

      await SessionHandler.broadcastSession();

      return true;
    });
  }
}
