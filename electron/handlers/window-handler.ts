import { BrowserWindow, ipcMain } from "electron";

export class WindowHandler {

    static register(){
        ipcMain.on("window:close",(e)=>{
            const win = BrowserWindow.fromWebContents(e.sender)
            win?.close()
        })
    }
}