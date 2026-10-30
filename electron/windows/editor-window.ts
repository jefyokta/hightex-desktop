import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { Application } from "./../main/application";
import fs from "fs";
import path from "path";
export class EditorWindow {
  private static windows = new Map<string, EditorWindowState>();

  static async open(
    documentId: string,
    filePath?: string,
  ): Promise<BrowserWindow> {
    const existing = this.get(documentId);

    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return existing;
    }

    const window = new BrowserWindow({
      show: false,
      width: 1400,
      height: 900,

      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,

      ...(process.platform !== "darwin"
        ? {
            titleBarOverlay: true,
          }
        : {}),

      webPreferences: {
        preload: Application.instance.preloadEntry,
        contextIsolation: true,
        devTools: Application.isDev,
      },
    });

    this.windows.set(documentId, {
      window,
      document: { id: documentId, filePath },
    });

    window.once("closed", () => {
      if (this.windows.get(documentId)?.window === window) {
        this.windows.delete(documentId);
      }
    });

    window.webContents.once("did-finish-load", () => {
      window.show();
    });

    await window.loadURL(
      Application.instance.resolveRendererUrl(`document/${documentId}`),
    );
    if (Application.isDev) window.webContents.openDevTools();

    return window;
  }

  static get(documentId: string): BrowserWindow | undefined {
    const window = this.windows.get(documentId)?.window;

    if (!window || window.isDestroyed()) {
      this.windows.delete(documentId);
      return undefined;
    }

    return window;
  }
  static getFromWindow(window: BrowserWindow) {
    return Array.from(this.windows).find(
      ([, state]) => state.window === window,
    )?.[1];
  }

  static async flush(documentId: string, timeout = 30000): Promise<void> {
    const window = this.get(documentId);
    if (!window) return;
    const request = randomUUID();
    const channel = `editor:flush:result:${request}`;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        ipcMain.removeListener(channel, onResult);
        window.removeListener("closed", onClosed);
      };
      const onResult = (event: Electron.IpcMainEvent, error?: string) => {
        if (event.sender !== window.webContents) return;
        cleanup();
        if (error) reject(new Error(error));
        else resolve();
      };
      const onClosed = () => {
        cleanup();
        reject(new Error("Editor closed before pending changes were saved"));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for editor changes to be saved"));
      }, timeout);
      ipcMain.on(channel, onResult);
      window.once("closed", onClosed);
      try {
        window.webContents.send("editor:flush", request, documentId);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  static async save(
    state: EditorWindowState,
    buffer: Uint8Array,
    fileName: string,
  ) {
    let filePath = state.document.filePath;
    if (!filePath) {
      const result = await dialog.showSaveDialog(state.window, {
        defaultPath: path.join(app.getPath("downloads"), fileName),
      });
      if (result.canceled) return;
      filePath = result.filePath;
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    state.document.filePath = filePath;
    return filePath;
  }

  static close(documentId: string): void {
    this.get(documentId)?.close();
  }
}
