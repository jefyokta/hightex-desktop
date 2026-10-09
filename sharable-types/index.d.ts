import { BrowserWindow } from "electron";


declare global {

    interface EditorWindowState {
    
        window:BrowserWindow,
        document:{
            id:string,
            filePath?:string
        }
    }
}

export {}