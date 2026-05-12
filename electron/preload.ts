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

contextBridge.exposeInMainWorld("hightex", {
  compile() {},
  document: () => {
    return ipcRenderer.invoke("hightex:document");
  },
  prefetch: () => {
    return ipcRenderer.invoke("hightex:prefetch");
  },

  onPrefetchProgress: (cb: (data: any) => void) => {
    progressCallback = cb;
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
});
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
