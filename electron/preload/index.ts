import { ipcRenderer, contextBridge } from "electron";
// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args),
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  // You can expose other APTs you need here.
  // ...
});
let progressCallback: ((data: any) => void) | null = null;
let cachedConfigPromise: Promise<any> | null = null;
let cachedConfig: any = null;

const loadConfig = async () => {
  if (!cachedConfigPromise) {
    cachedConfigPromise = ipcRenderer.invoke("config:get").then((cfg) => {
      cachedConfig = cfg;
      return cfg;
    });
  }

  return cachedConfigPromise;
};

loadConfig();
contextBridge.exposeInMainWorld("hightex", {
  // compile() {},
  document: () => {
    return ipcRenderer.invoke("hightex:document");
  },
  prefetch: () => {
    return ipcRenderer.invoke("hightex:prefetch");
  },

  onPrefetchProgress: (cb: (data: any) => void) => {
    progressCallback = cb;
  },
  onPdfProgress: (cb: (data: { status: string; progress?: number }) => void) => {
    const handler = (_: any, data: { status: string; progress?: number }) => {
      cb(data);
    };

    ipcRenderer.on("hightex:pdf:progress", handler);
    return () => ipcRenderer.removeListener("hightex:pdf:progress", handler);
  },
  categories: async () => {
    const r: false | any = await ipcRenderer.invoke("hightex:categories");
    if (!r) {
      return [];
    }
    const { data } = JSON.parse(r) as { data: RawCategory[] };
    let tmp: Category[] = [];
    data.forEach((d) => {
      tmp.push({ name: d.name, chapters: JSON.parse(d.chapters), id: d.id });
    });
    return tmp;
  },
  profile: async () => {
    return await ipcRenderer.invoke("hightex:profile");
  },
} satisfies Window["hightex"]);
contextBridge.exposeInMainWorld("session", {
  user: () => {
    return ipcRenderer.invoke("session:user");
  },
  login: (email: string, password: string) => {
    return ipcRenderer.invoke("session:login", email, password);
  },
  logout: () => {
    return ipcRenderer.invoke("session:logout");
  },
  onChange: (cb: (user: User | false) => void) => {
    const handler = (_: any, user: User | false) => {
      cb(user);
    };

    ipcRenderer.on("session:changed", handler);

    return () => {
      ipcRenderer.removeListener("session:changed", handler);
    };
  },
});

ipcRenderer.on("hightex:prefetch:progress", (_event, data) => {
  if (progressCallback) {
    progressCallback(data);
  }
});

contextBridge.exposeInMainWorld("config", {
  get: () => cachedConfig,
  ready: () => loadConfig(),

  set: async (patch: any) => {
    const cfg = await ipcRenderer.invoke("config:set", patch);
    cachedConfig = cfg;
    return cfg;
  },

  reset: async () => {
    const cfg = await ipcRenderer.invoke("config:reset");
    cachedConfig = cfg;
    return cfg;
  },

  key: async (key: string) => {
    return ipcRenderer.invoke("config:key", key);
  },

  onChange: (cb: (c: any) => void) => {
    const handler = (_: any, cfg: any) => {
      cachedConfig = cfg;
      cb(cfg);
    };

    ipcRenderer.on("config:changed", handler);

    return () => ipcRenderer.removeListener("config:changed", handler);
  },
} satisfies Window["config"]);

contextBridge.exposeInMainWorld("dialog", {
  selectFolder: async () => {
    const result = await ipcRenderer.invoke("dialog:select-folder");
    return result as string | undefined;
  },
} satisfies Window["dialog"]);

contextBridge.exposeInMainWorld("plugin", {
  scanner: {
    all: () => ipcRenderer.invoke("plugin:list"),
    paragraph: (plugin: string, text: string, context: ScannerContext) =>
      ipcRenderer.invoke("plugin:scanner.text", plugin, text, context),
    node(pluginId, node, context) {
      return ipcRenderer.invoke("plugin:scanner.node", pluginId, node, context);
    },
  },
} satisfies Window["plugin"]);

contextBridge.exposeInMainWorld("zotero", {
  testConnection: (host: string, port: number) =>
    ipcRenderer.invoke("zotero:test", host, port),
  listItems: (host: string, port: number, limit = 100) =>
    ipcRenderer.invoke("zotero:list", host, port, limit),
  exportBibtex: (host: string, port: number, itemKey: string) =>
    ipcRenderer.invoke("zotero:exportBibtex", host, port, itemKey),
} satisfies Window["zotero"]);

contextBridge.exposeInMainWorld("profile", {
  get: () => {
    return ipcRenderer.invoke("profile:get");
  },
  set(profile) {
    return ipcRenderer.invoke("profile:set", profile);
  },
  reset() {
    return ipcRenderer.invoke("profile:reset");
  },
} satisfies Window["profile"]);
