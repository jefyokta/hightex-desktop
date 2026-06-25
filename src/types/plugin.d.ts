interface PluginManifest {
  id: string;
  name: string;
  hash: string;
  version: string;
  entry: string;
  type: "mjs" | "cjs" | "esm";
  description?: string;
  author: string;
  codeUrl: string;
  keyId?: string;
  publicKey?: string;
  signature: string;
}
