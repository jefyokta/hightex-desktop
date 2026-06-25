import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { app } from "electron";

export class KeyManagerService {
  static readonly corePluginKeyId = "hightex-core";

  static ensure() {
    const target = path.join(app.getPath("userData"), "public.key");

    let publicKeyPath = target;

    if (!fs.existsSync(target)) {
      const source = this.getSourcePath();

      if (!source) {
        throw new Error("public.key missing in app resources");
      }

      fs.copyFileSync(source, target);
      publicKeyPath = target;
    }

    this.ensurePluginKey(this.corePluginKeyId, fs.readFileSync(publicKeyPath));
  }

  static pluginKeyPath(keyId: string): string {
    const safeKeyId = this.normalizeKeyId(keyId);
    return path.join(
      app.getPath("userData"),
      "plugin-keys",
      `${safeKeyId}.pem`,
    );
  }

  static ensurePluginKey(keyId: string, publicKey: string | Buffer) {
    const file = this.pluginKeyPath(keyId);
    fs.mkdirSync(path.dirname(file), { recursive: true });

    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, publicKey);
      return;
    }

    const current = fs.readFileSync(file, "utf-8").trim();
    const next = publicKey.toString("utf-8").trim();

    if (current !== next) {
      throw new Error(`plugin key mismatch for ${keyId}`);
    }
  }

  static readPluginKey(keyId: string): string | null {
    const file = this.pluginKeyPath(keyId);
    if (!fs.existsSync(file)) return null;

    return fs.readFileSync(file, "utf-8");
  }

  private static normalizeKeyId(keyId: string): string {
    const normalized = keyId.trim();

    if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
      throw new Error(`invalid plugin key id: ${keyId}`);
    }

    return normalized;
  }

  private static getSourcePath(): string | null {
    const candidates = [] as string[];

    if (app.isPackaged) {
      candidates.push(path.join(process.resourcesPath, "public.key"));
    }

    // Common app paths
    candidates.push(path.join(app.getAppPath(), "public.key"));
    candidates.push(path.join(app.getAppPath(), "..", "public.key"));

    // Current working directory and upward search (helps when running via npx electron)
    let dir = process.cwd();
    for (let i = 0; i < 6; i++) {
      candidates.push(path.join(dir, "public.key"));
      dir = path.dirname(dir);
    }

    // Location relative to this source file (covers many bundle layouts)
    try {
      const moduleDir = path.dirname(fileURLToPath(import.meta.url));
      candidates.push(path.join(moduleDir, "..", "..", "public.key"));
      candidates.push(path.join(moduleDir, "..", "public.key"));
      candidates.push(path.join(moduleDir, "public.key"));
    } catch (e) {
      // ignore if import.meta.url is not available in this runtime
    }

    // Electron exec path (where the electron binary lives)
    candidates.push(path.join(path.dirname(process.execPath), "public.key"));

    // Normalize and return the first existing candidate
    const found = candidates
      .map((p) => path.resolve(p))
      .find((candidate) => fs.existsSync(candidate));

    return found ?? null;
  }
}
