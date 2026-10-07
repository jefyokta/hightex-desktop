import { EditorWindow } from "@main/main/editor-window";
import { IPCMain } from "@main/utilities/ipc-main";

export class EditorHandler {
  static register() {
    IPCMain.handle("editor:open", (_, docId: string) => {
      EditorWindow.open(docId);
    });
    IPCMain.handle("editor:has",(_,docId:string)=>{
      return Boolean(EditorWindow.get(docId))
    })
  }
}
