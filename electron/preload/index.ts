import { ipcRenderer, contextBridge, webUtils } from "electron";

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
  submission: {
    pdf: (input: SnapshotPDFInput) =>
      ipcRenderer.invoke("hightex:snapshot:pdf", input),
    advisor: {
      directory: () => ipcRenderer.invoke("hightex:advisor:directory"),
      history: (input) => ipcRenderer.invoke("hightex:advisor:history", input),
      state: (input) => ipcRenderer.invoke("hightex:advisor:state", input),
      action: (input) => ipcRenderer.invoke("hightex:advisor:action", input),
    },
    context: () => ipcRenderer.invoke("hightex:submission:context"),
    list: () => ipcRenderer.invoke("hightex:submission:list"),
    file: (input) => ipcRenderer.invoke("hightex:submission:file", input),
    history: (input) => ipcRenderer.invoke("hightex:submission:history", input),
    detail: (input) => ipcRenderer.invoke("hightex:submission:detail", input),
    workflow: {
      pending: (sessionId) =>
        ipcRenderer.invoke("hightex:submission:pending", sessionId),
      prepare: (input) =>
        ipcRenderer.invoke("hightex:submission:prepare", input),
      submit: (sessionId) =>
        ipcRenderer.invoke("hightex:submission:submit", sessionId),
      reconcile: (sessionId) =>
        ipcRenderer.invoke("hightex:submission:reconcile", sessionId),
      discard: (sessionId) =>
        ipcRenderer.invoke("hightex:submission:discard", sessionId),
    },
  },
  // compile() {},
  document: () => {
    return ipcRenderer.invoke("hightex:document");
  },
  prefetch: () => {
    return ipcRenderer.invoke("hightex:prefetch");
  },

  onPrefetchProgress: (
    cb: (data: { status: string; progress?: number }) => void,
  ) => {
    progressCallback = cb;
    return () => {
      if (progressCallback === cb) progressCallback = null;
    };
  },
  onPdfProgress: (
    cb: (data: {
      status: string;
      progress?: number;
      requestId?: string;
    }) => void,
  ) => {
    const handler = (
      _: any,
      data: { status: string; progress?: number; requestId?: string },
    ) => {
      cb(data);
    };

    ipcRenderer.on("hightex:pdf:progress", handler);
    return () => ipcRenderer.removeListener("hightex:pdf:progress", handler);
  },
  categories: async () => {
    return await ipcRenderer.invoke("hightex:categories");
  },
  category: async (id: string) => {
    return ipcRenderer.invoke("hightex:category", id);
  },
  profile: async () => {
    return await ipcRenderer.invoke("hightex:profile");
  },
  onOpenFile(cb) {
    const listenr = (_: any, path: string) => {
      cb(path);
    };
    ipcRenderer.on("file:open", listenr);
    return () => ipcRenderer.removeListener("file:open", listenr);
  },
  readFile: (filePath: string) =>
    ipcRenderer.invoke("hightex:readFile", filePath),
  version() {
    return ipcRenderer.invoke("hightex:version");
  },
  reportError(payload) {
    return ipcRenderer.invoke("hightex:report-error", payload);
  },
  async saveContentError(props) {
    ipcRenderer.invoke("content:error", props);
  },
  snapshot: {
    document(documentId) {
      return ipcRenderer.invoke("snapshots:document", documentId);
    },
    all() {
      return (ipcRenderer.invoke("snapshots") ?? []) as any;
    },
    get(snapId) {
      return ipcRenderer.invoke("snapshot", snapId);
    },
  },
  cloud: {
    academic: {
      locked: (id) => ipcRenderer.invoke("hightex:academic:locked", id),
      load: (input) => ipcRenderer.invoke("hightex:academic:load", input),
    },
    context: () => ipcRenderer.invoke("hightex:document:context"),
    list: (sessionId) =>
      ipcRenderer.invoke("hightex:document:commits", sessionId),
    binding: (sessionId, localId) =>
      ipcRenderer.invoke("hightex:document:binding", sessionId, localId),
    pull: (input) => ipcRenderer.invoke("hightex:document:pull", input),
    accept: (input) => ipcRenderer.invoke("hightex:document:accept", input),
    push: (input) => ipcRenderer.invoke("hightex:document:push", input),
    backup: (sessionId, file) =>
      ipcRenderer.invoke("hightex:document:backup", sessionId, file),
  },
} satisfies Window["hightex"]);
contextBridge.exposeInMainWorld("snapshotPrint", {
  init: (request: string) => ipcRenderer.invoke(`snapshot:pdf:init:${request}`),
  result: (request: string, payload: SnapshotPDFPayload) =>
    ipcRenderer.send("snapshot:pdf:result", request, payload),
  error: (request: string, code: string) =>
    ipcRenderer.send("snapshot:pdf:error", request, code),
} satisfies SnapshotPrintAPI);
contextBridge.exposeInMainWorld("session", {
  signIn: (email: string, password: string) =>
    ipcRenderer.invoke("session:sign-in", email, password),
  browser: {
    start: () => ipcRenderer.invoke("session:browser:start"),
    status: () => ipcRenderer.invoke("session:browser:status"),
    cancel: () => ipcRenderer.invoke("session:browser:cancel"),
  },
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

contextBridge.exposeInMainWorld("updater", {
  check: () => ipcRenderer.invoke("updater:check"),
  install: () => ipcRenderer.invoke("updater:install"),
  onStatus: (cb) => {
    const handler = (_: any, status: UpdaterStatus) => {
      cb(status);
    };

    ipcRenderer.on("updater:status", handler);
    ipcRenderer
      .invoke("updater:status")
      .then((status: UpdaterStatus | null) => {
        if (status) {
          cb(status);
        }
      })
      .catch(() => undefined);

    return () => ipcRenderer.removeListener("updater:status", handler);
  },
  download: () => ipcRenderer.invoke("updater:download"),
} satisfies Window["updater"]);

contextBridge.exposeInMainWorld("zotero", {
  testConnection: (host: string, port: number) =>
    ipcRenderer.invoke("zotero:test", host, port),
  listItems: (host: string, port: number, limit = 100) =>
    ipcRenderer.invoke("zotero:list", host, port, limit),
  exportBibtex: (host: string, port: number, itemKey: string) =>
    ipcRenderer.invoke("zotero:exportBibtex", host, port, itemKey),
} satisfies Window["zotero"]);

contextBridge.exposeInMainWorld("account", {
  settings: (sessionId: string) =>
    ipcRenderer.invoke("account:settings", sessionId),
  load: () => ipcRenderer.invoke("account:load"),
  update: (input: AccountProfileInput) =>
    ipcRenderer.invoke("account:update", input),
  picture: (sessionId: string) =>
    ipcRenderer.invoke("account:picture", sessionId),
});
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
  picture() {
    return ipcRenderer.invoke("profile:picture");
  },
  setPicture(blob) {
    return ipcRenderer.invoke("profile:picture.set", blob);
  },
} satisfies Window["profile"]);

contextBridge.exposeInMainWorld("sharing", {
  start(payload) {
    return ipcRenderer.invoke("sharing:start", payload);
  },
  info() {
    return ipcRenderer.invoke("sharing:info");
  },
  stop() {
    return ipcRenderer.invoke("sharing:stop");
  },
  html(docId: string) {
    return ipcRenderer.invoke("sharing:html", docId);
  },
  async getSnapshot() {
    return ipcRenderer.invoke("sharing:getSnapshot");
  },
  wifi: {
    async connect(s, p) {
      return await ipcRenderer.invoke("sharing:wifi.connect", s, p);
    },
    async current() {
      return await ipcRenderer.invoke("sharing:wifi.current");
    },
    async scan() {
      return await ipcRenderer.invoke("sharing:wifi");
    },
  },
} satisfies SharingAPI);

contextBridge.exposeInMainWorld("file", {
  async save(fileName: string, file: Uint8Array) {
    return ipcRenderer.invoke("file:save", fileName, file);
  },
  showInFolder(path) {
    return ipcRenderer.invoke("fs:open.in_folder", path);
  },
  openPath(path) {
    return ipcRenderer.invoke("fs:open", path);
  },
  openFolder(folderPath) {
    return ipcRenderer.invoke("fs:folder", folderPath);
  },
  async getPath(file) {
    return webUtils.getPathForFile(file);
  },
  async getUserDataPath() {
    return ipcRenderer.invoke("fs:userData");
  },
} satisfies Window["file"]);

contextBridge.exposeInMainWorld("editor", {
  onFlush(callback: (request: string, documentId: string) => void) {
    const listener = (
      _event: Electron.IpcRendererEvent,
      request: string,
      documentId: string,
    ) => callback(request, documentId);
    ipcRenderer.on("editor:flush", listener);
    return () => ipcRenderer.removeListener("editor:flush", listener);
  },
  completeFlush(request: string, error?: string) {
    ipcRenderer.send(`editor:flush:result:${request}`, error);
  },
  open(documentId: string, file?: string) {
    return ipcRenderer.invoke("editor:open", documentId, file);
  },
  has(documentId) {
    return ipcRenderer.invoke("editor:has", documentId);
  },
  save(buffer, fileName) {
    return ipcRenderer.invoke("editor:save", buffer, fileName);
  },
} satisfies Window["editor"]);
