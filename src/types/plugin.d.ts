interface PluginManifest {
  id: string;
  name: string;
  hash: string;
  version: string;
  entry: string;
  type: "mjs" | "cjs";
  description?: string;
  author: string;
  codeUrl: string;
  signature: string;
}
