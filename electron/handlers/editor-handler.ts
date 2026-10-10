import { EditorWindow } from "@main/windows/editor-window";
import { IPCMain } from "@main/utilities/ipc-main";
import { BrowserWindow } from "electron";

export class EditorHandler {
  static register() {
    IPCMain.handle("editor:open", (_, docId: string) => {
      EditorWindow.open(docId);
    });
    IPCMain.handle("editor:has", (_, docId: string) => {
      return Boolean(EditorWindow.get(docId));
    });

    IPCMain.handle("editor:save",(event,buffer:Uint8Array,fileName:string)=>{
      const win = BrowserWindow.fromWebContents(event.sender);
      if(!win) return
      const state = EditorWindow.getFromWindow(win);
      if(!state) return
      return EditorWindow.save(state,buffer,fileName)
    })
  }
}
