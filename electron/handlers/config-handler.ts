import { ipcMain, BrowserWindow } from "electron";
import { ConfigService } from "../service/config-service";

export class ConfigHandler {
  private static broadcastConfig() {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;

    win.webContents.send("config:changed", ConfigService.get());
  }

  static register() {
    ipcMain.handle("config:get", () => {
      return ConfigService.get();
    });

    ipcMain.handle("config:raw", () => {
      return ConfigService.raw();
    });

    ipcMain.handle("config:reset", () => {
      const res = ConfigService.reset();
      this.broadcastConfig();
      return res;
    });

    ipcMain.handle("config:set", (_event, patch) => {
      const res = ConfigService.set(patch);
      this.broadcastConfig();
      return res;
    });

    ipcMain.handle("config:key", (_event, key) => {
      return ConfigService.getKey(key);
    });
  }
}
