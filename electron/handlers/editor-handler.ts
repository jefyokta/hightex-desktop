import { EditorWindow } from "@main/windows/editor-window";
import { IPCMain } from "@main/utilities/ipc-main";
import { BrowserWindow } from "electron";
import { WorkspaceRuntime } from "../workspaces/runtime";
import type { Application } from "../main/application";

export class EditorHandler {
  static register(application: Application) {
    IPCMain.handle("editor:reload-source", async (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const state = window && EditorWindow.getFromWindow(window);
      if (state) await EditorWindow.reloadSource(state);
    });
    IPCMain.handle("editor:locate-source", async (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const state = window && EditorWindow.getFromWindow(window);
      if (state) return EditorWindow.locateSource(state);
    });
    IPCMain.handle("editor:source-file", (event, documentId: string, storedPath?: string) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const state = window && EditorWindow.getFromWindow(window);
      if (!state) return;
      if (
        event.senderFrame?.routingId !== event.sender.mainFrame.routingId ||
        event.senderFrame?.processId !== event.sender.mainFrame.processId ||
        state.document.id !== documentId
      ) throw Error("forbidden");
      if (storedPath !== undefined && typeof storedPath !== "string")
        throw Error("Invalid document file path");
      state.document.filePath ??= storedPath;
      return state.document.filePath;
    });
    IPCMain.handle("editor:open", async (_, docId: string, file?: string) => {
      if (WorkspaceRuntime.switching)
        throw Error("Workspace switch is in progress");
      await EditorWindow.open(docId, file);
    });
    IPCMain.handle("editor:has", (_, docId: string) => {
      return Boolean(EditorWindow.get(docId));
    });
    IPCMain.handle("editor:flush", async (_, docId: string) => {
      await EditorWindow.flush(docId);
    });
    IPCMain.handle("editor:open-profile", async (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window || !EditorWindow.getFromWindow(window))
        throw Error("Open the Profile page from an editor window.");
      await application.openProfile();
    });

    IPCMain.handle("editor:ready", async (event, buffer: Uint8Array, source?: Uint8Array) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const state = window && EditorWindow.getFromWindow(window);
      if (state) await EditorWindow.ready(state, buffer, source);
    });

    IPCMain.handle(
      "editor:save",
      (event, buffer: Uint8Array, fileName: string, mode: DocumentSaveMode = "save") => {
        if (mode !== "save" && mode !== "save-as")
          throw Error("Invalid document save mode");
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;
        const state = EditorWindow.getFromWindow(win);
        if (!state) return;
        return EditorWindow.save(state, buffer, fileName, mode);
      },
    );
  }
}
