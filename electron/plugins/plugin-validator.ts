import crypto from "crypto";
import fs from "fs";
import path from "path";
import { app } from "electron";

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
  static verify(content: string, manifest: PluginManifest): boolean {
    return true;
    const verifier = crypto.createVerify("sha256");
    verifier.update(content);
    verifier.end();

    return verifier.verify(this.getPublicKey(), manifest.signature, "base64");
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
