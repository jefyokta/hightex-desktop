import crypto from "crypto";
import fs from "fs";
import path from "path";
import { app } from "electron";
import { KeyManagerService } from "@main/service/key-manager-service";

export class PluginValidator {
  static readonly alg = "sha256";

  static hash(content: string): string {
    return crypto.createHash(this.alg).update(content).digest("hex");
  }

  static formatHash(hash: string): string {
    return `${this.alg}:${hash}`;
  }

  static getPublicKey(): string {
    const file = path.join(app.getPath("userData"), "public.key");
    return fs.readFileSync(file, "utf-8");
  }

  static getManifestPublicKey(manifest: PluginManifest): string {
    if (manifest.keyId) {
      const trustedKey = KeyManagerService.readPluginKey(manifest.keyId);
      if (trustedKey) return trustedKey;
    }

    if (manifest.publicKey) {
      return manifest.publicKey;
    }

    const pluginKey = this.getPluginPublicKey(manifest.id);
    if (pluginKey) return pluginKey;

    return this.getPublicKey();
  }

  static trustManifestKey(manifest: PluginManifest): void {
    if (!manifest.keyId || !manifest.publicKey) return;

    KeyManagerService.ensurePluginKey(manifest.keyId, manifest.publicKey);
  }

  static verify(content: string, manifest: PluginManifest): boolean {
    if (!this.verifyHash(content, manifest)) return false;

    const publicKey = this.getManifestPublicKey(manifest);

    return (
      this.verifySignature(content, manifest.signature, publicKey) ||
      this.verifySignature(this.hash(content), manifest.signature, publicKey)
    );
  }

  private static verifyHash(
    content: string,
    manifest: PluginManifest,
  ): boolean {
    if (!manifest.hash) return false;

    const computed = this.hash(content);
    const expected = this.normalizeHash(manifest.hash);

    return computed === expected;
  }

  private static normalizeHash(hash: string): string {
    const prefix = `${this.alg}:`;
    return hash.startsWith(prefix) ? hash.slice(prefix.length) : hash;
  }

  private static verifySignature(
    payload: string,
    signature: string,
    publicKey: string,
  ): boolean {
    try {
      const verifier = crypto.createVerify(this.alg);
      verifier.update(payload);
      verifier.end();

      return verifier.verify(publicKey, signature, "base64");
    } catch (err) {
      console.error("Plugin signature verification failed:", err);
      return false;
    }
  }

  private static getPluginPublicKey(pluginId: string): string | null {
    if (!/^[a-zA-Z0-9._-]+$/.test(pluginId)) return null;

    const file = path.join(
      app.getPath("userData"),
      "plugins",
      pluginId,
      "public.key",
    );

    if (!fs.existsSync(file)) return null;

    return fs.readFileSync(file, "utf-8");
  }
  // static verify(content: string, manifest: PluginManifest): boolean {
  //   const computedRaw = this.hash(content);
  //   const expectedRaw = manifest.hash.slice(this.alg.length + 1);

  //   if (computedRaw !== expectedRaw) return false;

  //   const verifier = crypto.createVerify(this.alg);
  //   verifier.update(computedRaw);
  //   verifier.end();

  //   return verifier.verify(this.getPublicKey(), manifest.signature, "base64");
  // }
}
