import {  BrowserWindow } from "electron";
import { ConfigService } from "../service/config-service";
import { IPCMain } from "@main/utilities/ipc-main";

export class ConfigHandler {
  private static broadcastConfig() {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;

    win.webContents.send("config:changed", ConfigService.get());
  }

  static register() {
    IPCMain.handle("config:get", () => {
      return ConfigService.get();
    });

    IPCMain.handle("config:raw", () => {
      return ConfigService.raw();
    });

    IPCMain.handle("config:reset", () => {
      const res = ConfigService.reset();
      this.broadcastConfig();
      return res;
    });

    IPCMain.handle("config:set", (_event, patch) => {
      const res = ConfigService.set(patch);
      this.broadcastConfig();
      return res;
    });

    IPCMain.handle("config:key", (_event, key) => {
      return ConfigService.getKey(key);
    });
  }
}
