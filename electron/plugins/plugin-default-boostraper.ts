import fs from "fs";
import path from "path";
import { app } from "electron";

import reference from "./default/reference/index.js?raw";
import referenceManifest from "./default/reference/manifest.json?raw";

import textLint from "./default/text-lint/index.js?raw";
import textLintManifest from "./default/text-lint/manifest.json?raw";
import abstract from "./default/abstract/index.js?raw";
import abstractManifest from "./default/abstract/manifest.json?raw";

export class DefaultPluginsBootstrapper {
  static flagFile = path.join(
    app.getPath("userData"),
    ".default_plugins_installed",
  );

  static plugins = [
    {
      id: "reference",
      code: reference,
      manifest: referenceManifest,
    },
    {
      id: "text-lint",
      code: textLint,
      manifest: textLintManifest,
    },
    {
      id: "abstract",
      code: abstract,
      manifest: abstractManifest,
    },
  ];

  static runOnce() {
    if (fs.existsSync(this.flagFile)) return;

    this.installAll();

    fs.writeFileSync(this.flagFile, "ok");
  }

  static installAll() {
    const base = path.join(app.getPath("userData"), "plugins");

    fs.mkdirSync(base, { recursive: true });

    for (const plugin of this.plugins) {
      const dir = path.join(base, plugin.id);

      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(path.join(dir, "index.js"), plugin.code, "utf-8");

      fs.writeFileSync(
        path.join(dir, "manifest.json"),
        typeof plugin.manifest === "string"
          ? plugin.manifest
          : JSON.stringify(plugin.manifest, null, 2),
        "utf-8",
      );
    }
  }
}
