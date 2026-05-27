import { ipcMain } from "electron";
import { PluginManager } from "../plugins/plugin-manager";

export class PluginHandler {
  static register() {
    ipcMain.handle("plugin:list", () => {
      return PluginManager.getSerializablePlugins();
    });

    ipcMain.handle("plugin:start", () => {
      PluginManager.resetAllStates();
    });
  }
}
