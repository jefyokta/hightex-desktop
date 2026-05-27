import fs from "fs";
import path from "path";
import vm from "vm";
import { PluginStorage } from "./plugin-storage";
import { PluginValidator } from "./plugin-validator";

export class PluginManager {
  static plugins = new Map<string, HightexPlugin>();
  static globalStates = new Map<string, any>();

  static loadAll() {
    const ids = PluginStorage.listPlugins();

    for (const id of ids) {
      const dir = path.join(PluginStorage.basePath, id);
      const codePath = path.join(dir, "index.js");
      const manifestPath = path.join(dir, "manifest.json");

      if (!fs.existsSync(codePath) || !fs.existsSync(manifestPath)) continue;

      try {
        const code = fs.readFileSync(codePath, "utf-8");
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

        if (!PluginValidator.verify(code, manifest)) {
          console.error(` Invalid plugin: ${id}`);
          continue;
        }

        const mod = this.safeLoad(code, id);
        this.validatePlugin(mod);
        this.plugins.set(id, mod);
      } catch (err) {
        console.error(` Error loading plugin [${id}]:`, err);
      }
    }
  }

  static safeLoad(code: string, pluginId: string): HightexPlugin {
    if (!this.globalStates.has(pluginId)) {
      this.globalStates.set(pluginId, {});
    }

    const sandbox = {
      __exports: {} as any,
      console,
      db: this.globalStates.get(pluginId),
    };

    const context = vm.createContext(sandbox);

    const transformedCode = code
      .replace(/export\s+default\s+/g, "__exports.default = ")
      .replace(/export\s+\{([\s\S]*?)\};?/g, (_, content: string) => {
        return content
          .split(",")
          .map((item) => {
            const parts = item.trim().split(/\s+as\s+/);
            const source = parts[0].trim();
            const target = (parts[1] || source).trim();
            return `__exports.${target} = ${source};`;
          })
          .join("\n");
      });

    const script = new vm.Script(transformedCode);
    script.runInContext(context);

    return sandbox.__exports.default || sandbox.__exports;
  }

  static validatePlugin(plugin: any): asserts plugin is HightexPlugin {
    if (!plugin || typeof plugin !== "object")
      throw new Error("Plugin must be object");
    if (typeof plugin.id !== "string") throw new Error("Plugin missing id");
  }

  static getPlugins() {
    return Array.from(this.plugins.values());
  }

  static getSerializablePlugins(): SerialableHightexPlugin[] {
    return Array.from(this.plugins.values()).map((plugin) => ({
      id: plugin.id,
      version: plugin.version,
      scanner: plugin.scanner
        ? {
            hasOnParagraph: typeof plugin.scanner.onParagraph === "function",
            hasOnNode: typeof plugin.scanner.onNode === "function",
          }
        : undefined,
    }));
  }

  static resetAllStates() {
    this.globalStates.clear();
  }
}
