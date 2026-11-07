import { EditorWindow } from "@main/windows/editor-window";
import { IPCMain } from "@main/utilities/ipc-main";
import { BrowserWindow } from "electron";

export class EditorHandler {
  static register() {
    IPCMain.handle("editor:open", async (_, docId: string, file?: string) => {
      await EditorWindow.open(docId, file);
    });
    IPCMain.handle("editor:has", (_, docId: string) => {
      return Boolean(EditorWindow.get(docId));
    });
    IPCMain.handle("editor:flush", async (_, docId: string) => {
      await EditorWindow.flush(docId);
    });

    IPCMain.handle("editor:ready", async (event, buffer: Uint8Array) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const state = window && EditorWindow.getFromWindow(window);
      if (state) await EditorWindow.ready(state, buffer);
    });

    IPCMain.handle(
      "editor:save",
      (event, buffer: Uint8Array, fileName: string) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;
        const state = EditorWindow.getFromWindow(win);
        if (!state) return;
        return EditorWindow.save(state, buffer, fileName);
      },
    );
  }
}
