import { PluginStorage } from "./plugin-storage";
import { PluginValidator } from "./plugin-validator";

export class PluginRegistry {
  static async fetchManifest(url: string): Promise<PluginManifest> {
    const res = await fetch(url);
    return res.json();
  }

  static async fetchPluginCode(url: string) {
    const res = await fetch(url);
    return res.text();
  }

  static async installFromRemote(manifestUrl: string) {
    const manifest = await this.fetchManifest(manifestUrl);
    const code = await this.fetchPluginCode(manifest.codeUrl);

    const ok = PluginValidator.verify(code, manifest);

    if (!ok) {
      throw new Error("INVALID_PLUGIN");
    }

    PluginValidator.trustManifestKey(manifest);
    PluginStorage.writePlugin(manifest.id, code, manifest);

    return manifest;
  }
}
