import { IPCMain } from "@main/utilities/ipc-main";
import { PluginManager } from "../plugins/plugin-manager";

export class PluginHandler {
  static register() {
    IPCMain.handle("plugin:list", () => {
      return PluginManager.getSerializablePlugins();
    });

    IPCMain.handle("plugin:start", () => {
      PluginManager.resetAllStates();
    });
  }
}
