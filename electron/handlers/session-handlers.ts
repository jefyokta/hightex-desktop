import { BrowserWindow, ipcMain } from "electron";
import { ServerService } from "../service/server-service";
import { LoggerService } from "../service/logger-service";
import { SessionService } from "../service/session-service";

export class SessionHandler {
  private static async broadcastSession() {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;

    try {
      const res = await ServerService.request<{ message: User }>("/me");

      if (res.message) {
        SessionService.setUser(res.message);
      } else {
        SessionService.clearUser();
      }

      win.webContents.send("session:changed", res.message || false);
    } catch (err) {
      LoggerService.write(err, "broadcastSession");
      SessionService.clearUser();
      win.webContents.send("session:changed", false);
    }
  }

  static register() {
    ipcMain.handle("session:user", async () => {
      try {
        const res = await ServerService.request<{ message: User }>("/me");

        if (res.message) {
          SessionService.setUser(res.message);
        } else {
          SessionService.clearUser();
        }

        return res.message;
      } catch {
        return false;
      }
    });

    ipcMain.handle(
      "session:login",
      async (
        _event,
        email: string,
        password: string,
      ): Promise<User | false> => {
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
      },
    );

    ipcMain.handle("session:logout", async () => {
      SessionService.clear();

      await SessionHandler.broadcastSession();

      return true;
    });
  }
}
