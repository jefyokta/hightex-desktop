import { Application } from "@main/main/application";
import {  app, BrowserWindow } from "electron";

export class ImportWindow {
  private _window!: BrowserWindow;
  
  private static _instance: ImportWindow|null = null;

  private pendingFiles: string[] = [];

  public static get instance() {
    if (!this._instance) {
      this._instance = new ImportWindow();
    }
    return this._instance;
  }
  private constructor(){
  }

  private get window(){

    if(app.isReady() && !this._window){
      this._window = this.createWindow()
    }

    return this._window;
  }

  private createWindow() {
    const parent = Application.instance.window;
    const win = new BrowserWindow({
      show: false,
      width: 520,
      height: 430,
      resizable: false,
      minimizable: false,
      maximizable: false,
      ...(parent && !parent.isDestroyed()
        ? { parent, modal: true }
        : {}),

      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,

      ...(process.platform !== "darwin"
        ? {
            titleBarOverlay: true,
          }
        : {}),

      webPreferences: {
        preload: Application.instance.preloadEntry,
        contextIsolation: true,
        devTools: true,
      },
    });
    win.once("ready-to-show", () => {
      win.center();
      win.show();
    });

    return win
  }

  async load() {
    if(!this.pendingFiles.length){
      console.info("no files ")
      return;
    }
    const payload = this.createPayload();

     await this.window.loadURL(
      Application.instance.resolveRendererUrl(`/import/${payload}`),
    );

  }

  private createPayload() {
    return Buffer.from(
      JSON.stringify({ files: this.pendingFiles }),
      "utf-8",
    ).toString("base64url");
  }

  static destroy(){
    this._instance = null
  }

  addFiles(...files:string[]){
    this.pendingFiles.push(...files)
  }
}
