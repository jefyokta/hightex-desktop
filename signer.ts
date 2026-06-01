import fs from "fs";
import path from "path";
import crypto from "crypto";
import "dotenv/config";
const PRIVATE_KEY = process.env.PLUGIN_PRIVATE_KEY;

export class PluginSigner {
  static hash(code: string) {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  static sign(code: string, privateKey: string) {
    return crypto
      .sign("sha256", Buffer.from(code), privateKey)
      .toString("base64");
  }
}

export function signDefaultPlugin(pluginDir: string, privateKey: string) {
  const codePath = path.join(pluginDir, "index.js");
  const manifestPath = path.join(pluginDir, "manifest.json");

  const code = fs.readFileSync(codePath, "utf-8");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  const signedManifest = {
    ...manifest,
    hash: PluginSigner.hash(code),
    signature: PluginSigner.sign(code, privateKey),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(signedManifest, null, 2));
}
signDefaultPlugin("electron/plugins/default/reference", PRIVATE_KEY!);

signDefaultPlugin("electron/plugins/default/text-lint", PRIVATE_KEY!);
