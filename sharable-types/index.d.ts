import { BrowserWindow } from "electron";

declare global {
  interface EditorWindowState {
    window: BrowserWindow;
    archiveBaseline?: string;
    fileBaseline?: string;
    initialized?: boolean;
    document: {
      id: string;
      filePath?: string;
    };
  }
}

export {};
