import { app, BrowserWindow } from "electron";
import { Application } from "./../main/application";
export class EditorWindow {
  private static windows = new Map<string, EditorWindowState>();

  static async open(documentId: string): Promise<BrowserWindow> {
    const existing = this.get(documentId);

    if (existing) {
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
        devTools: !app.isPackaged,
      },
    });

    this.windows.set(documentId, {
      window,
      document: { id: documentId },
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
    if (!app.isPackaged) window.webContents.openDevTools();

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

  static close(documentId: string): void {
    this.get(documentId)?.close();
  }
}
