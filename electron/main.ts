import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Server } from "./service/server";
import Store from "electron-store";
import { Logger } from "./service/logger";
//@ts-ignore
if (process.env.NODE_ENV !== "production") {
  //@ts-ignore
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

//@ts-ignore
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
const store = new Store();
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
    ...(process.platform !== "darwin" ? { titleBarOverlay: true } : {}),
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),

    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  if (process.env.APP_ENV !== "production") {
    win.webContents.openDevTools();
  }

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  win.on("maximize", () => {
    win?.webContents.send("win:maximize", true);
  });

  win.on("unmaximize", () => {
    win?.webContents.send("win:maximize", false);
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.on("open-file", () => {});
app.whenReady().then(createWindow);

const broadcastSession = async () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;

  try {
    const res = await Server.request<{ message: User }>("/me");
    win.webContents.send("session:changed", res.message || false);
  } catch (err) {
    Logger.write(err, "broadcastSession");
    win.webContents.send("session:changed", false);
  }
};

ipcMain.handle("session:user", async () => {
  try {
    const res = await Server.request<{ message: User }>("/me");
    return res.message;
  } catch {
    return false;
  }
});

ipcMain.handle(
  "session:login",
  async (_event, email: string, password: string): Promise<User | false> => {
    try {
      const res = await Server.request<{
        data: { user: User; token: string };
      }>("/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          exp: 3600 * 24 * 30,
        }),
      });

      const { user, token } = res.data;

      if (!user || !token) return false;

      store.set("session.token", token);

      await broadcastSession();

      return user;
    } catch (err) {
      Logger.write(err, "session:login");
      return false;
    }
  },
);

ipcMain.handle("session:logout", async () => {
  store.delete("session.token");

  await broadcastSession();

  return true;
});

ipcMain.handle("hightex:document", async () => {
  try {
    return await Server.request("/document");
  } catch (err) {
    Logger.write(err, "hightex:document");
    return false;
  }
});
ipcMain.handle("hightex:prefetch", async (event) => {
  const send = (status: string, progress: number) => {
    event.sender.send("hightex:prefetch:progress", {
      status,
      progress,
    });
  };

  try {
    send("Checking session", 10);
    await Server.request("/me").catch(() => null);
    send("Checking categories update", 50);
    const categories: { data: Category } = await Server.request("/categories");
    store.set("hightex.categories", JSON.stringify(categories));
    send("Loading documents", 65);
    await Server.request("/document").catch(() => null);

    send("Warming cache", 85);

    await new Promise((r) => setTimeout(r, 150));

    send("done", 100);

    return true;
  } catch (err) {
    Logger.write(err, "hightex:prefetch");
    send("error", 0);
    return false;
  }
});

ipcMain.handle("hightex:categories", async () => {
  try {
    const cached = store.get("hightex.categories");
    if (cached) return cached;

    const res = await Server.request("/categories");

    store.set("hightex.categories", res);

    return res;
  } catch (err) {
    Logger.write(err, "hightex:categories");
    return [];
  }
});
