import { BrowserWindow } from "electron";
import { ServerService } from "../service/server-service";
import { LoggerService } from "../service/logger-service";
import { SessionService } from "../service/session-service";
import { IPCMain } from "@main/utilities/ipc-main";

export class SessionHandler {
  private static async broadcastSession() {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;

    try {
      const user = await this.user();

      win.webContents.send("session:changed", user || false);
    } catch (err) {
      LoggerService.write(err, "broadcastSession");
      SessionService.clearUser();
      win.webContents.send("session:changed", false);
    }
  }

public static async user(): Promise<User | false> {
  try {
    const res = await ServerService.request<{ message: User }>("/me");

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

    return user;
  } catch (err) {
    LoggerService.write(err, "session:user");
    SessionService.clearUser();

    return false;
  }
}
  public static async login(
    email: string,
    password: string,
  ): Promise<User | false> {
    try {
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
      (_event, email: string, password: string) =>
        SessionHandler.login(email, password),
    );

    IPCMain.handle("session:logout", async () => {
      SessionService.clear();

      await SessionHandler.broadcastSession();

      return true;
    });
  }
}