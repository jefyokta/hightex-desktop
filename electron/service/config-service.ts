import { app } from "electron";
import Store from "electron-store";

const DEFAULT_CONFIG: ConfigShape = {
  language: "en",
  theme: "system",

  previewer: {
    autoUpdate: false,
    layoutIndicator: true,
    scope: "current",
  },

  editor: {
    spellCheck: false,
    preferCloudProfile: true,
    tableResizeGuides: true,
  },
  export: {
    saveDialog: false,
    saveFolder: app.getPath("downloads"),
  },
  zotero: {
    enabled: false,
    host: "127.0.0.1",
    port: 23119,
  },
};

export class ConfigService {
  static store = new Store<ConfigShape>();

  static get(): ConfigShape {
    const saved = this.store.get("app") as ConfigShape | undefined;

    return {
      ...DEFAULT_CONFIG,
      ...(saved || {}),
      editor: {
        ...DEFAULT_CONFIG.editor,
        ...(saved?.editor || {}),
      },
      previewer: {
        ...DEFAULT_CONFIG.previewer,
        ...(saved?.previewer || {}),
      },
      export: {
        ...DEFAULT_CONFIG.export,
        ...(saved?.export || {}),
      },
      zotero: {
        ...DEFAULT_CONFIG.zotero,
        ...(saved?.zotero || {}),
      },
    };
  }

  static getKey<K extends keyof ConfigShape>(key: K): ConfigShape[K] {
    return this.get()[key];
  }

  static set(patch: Partial<ConfigShape>) {
    const current = this.get();

    const next: ConfigShape = {
      ...current,
      ...patch,
      editor: {
        ...current.editor,
        ...(patch.editor || {}),
      },
      previewer: {
        ...current.previewer,
        ...(patch.previewer || {}),
      },
      export: {
        ...current.export,
        ...(patch.export || {}),
      },
      zotero: {
        ...current.zotero,
        ...(patch.zotero || {}),
      },
    };

    this.store.set("app", next);
    return next;
  }

  static updateKey<K extends keyof ConfigShape>(key: K, value: ConfigShape[K]) {
    return this.set({ [key]: value } as Partial<ConfigShape>);
  }

  static reset() {
    this.store.set("app", DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  static raw() {
    return this.store.get("app");
  }
}
