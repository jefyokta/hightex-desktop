import fs from "fs";
import path from "path";
import { app } from "electron";

export class PluginStorage {
  static basePath = path.join(app.getPath("userData"), "plugins");

  static ensure() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  static writePlugin(id: string, code: string, manifest: PluginManifest) {
    this.ensure();

    const dir = path.join(this.basePath, id);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    fs.writeFileSync(path.join(dir, "index.js"), code);
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
  }

  static listPlugins() {
    return fs.readdirSync(this.basePath).filter((id) => {
      const full = path.join(this.basePath, id);

      return (
        fs.existsSync(full) &&
        fs.statSync(full).isDirectory() &&
        !id.startsWith(".")
      );
    });
  }
}
