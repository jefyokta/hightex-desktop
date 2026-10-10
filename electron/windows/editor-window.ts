import { app, BrowserWindow, dialog } from "electron";
import { Application } from "./../main/application";
import fs from "fs"
import path from "path";
export class EditorWindow {
  private static windows = new Map<string, EditorWindowState>();

  static async open(documentId: string,filePath?:string): Promise<BrowserWindow> {
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
      document: { id: documentId,filePath },
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
  static getFromWindow(window:BrowserWindow){
   return Array.from(this.windows).find(([_,state])=>state.window === window)?.[1]
   
  }

  static async save(state:EditorWindowState,buffer:Uint8Array,fileName:string){
    let filePath = state.document.filePath
    if(!filePath){
     const result =await dialog.showSaveDialog(state.window,{
      defaultPath:path.join(app.getPath("downloads"),fileName)
      
     });
     if(result.canceled) return
     filePath = result.filePath     
    }

    fs.writeFileSync(filePath,buffer)
    return filePath


  }

  static close(documentId: string): void {
    this.get(documentId)?.close();
  }
}
