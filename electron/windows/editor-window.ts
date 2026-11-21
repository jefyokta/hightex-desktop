import { BrowserWindow, dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { Application } from "./../main/application";
import fs from "fs";
import { archiveFingerprint } from "../utilities/archive-fingerprint";
import { EditorCloseGuard } from "../utilities/editor-close-guard";
import { ConfigService } from "../service/config-service";
import { LoggerService } from "../service/logger-service";
import en from "../../src/locales/en.json";
import id from "../../src/locales/id.json";
import { isEditorDocumentPath } from "../../src/workspaces/editor-navigation";
import { parseHighTexV2 } from "@hightex/importer";
import { DocumentFileService } from "../service/document-file-service";
export class EditorWindow {
  private static windows = new Map<string, EditorWindowState>();
  private static closeGuards = new Map<string, EditorCloseGuard>();

  static async open(
    documentId: string,
    filePath?: string,
  ): Promise<BrowserWindow> {
    const existing = this.get(documentId);

    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
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
        additionalArguments: [
          `--hightex-editor-document=${encodeURIComponent(documentId)}`,
          ...(Application.isDev ? ["--hightex-dev"] : []),
        ],
        preload: Application.instance.preloadEntry,
        contextIsolation: true,
        devTools: Application.isDev,
      },
    });

    const inspectElement = (
      event: Electron.IpcMainEvent,
      x: number,
      y: number,
    ) => {
      if (
        !Application.isDev ||
        event.sender !== window.webContents ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      )
        return;
      window.webContents.inspectElement(x, y);
    };
    ipcMain.on("editor:inspect-element", inspectElement);

    window.webContents.on("will-navigate", (event, target) => {
      const url = new URL(target);
      const editorUrl = new URL(Application.instance.resolveRendererUrl());
      if (
        url.protocol !== editorUrl.protocol ||
        url.host !== editorUrl.host ||
        !isEditorDocumentPath(url.pathname, documentId)
      )
        event.preventDefault();
    });

    const state: EditorWindowState = {
      window,
      document: { id: documentId, filePath },
    };
    this.windows.set(documentId, state);
    const guard = new EditorCloseGuard({
      lock: (locked) => {
        if (!window.isDestroyed())
          window.webContents.send("editor:close-state", locked);
      },
      dirty: async () => {
        if (!state.initialized) return true;
        const snapshot = await this.snapshot(documentId);
        const current = archiveFingerprint(snapshot.buffer);
        if (state.document.filePath) {
          try {
            const disk = archiveFingerprint(await fs.promises.readFile(state.document.filePath));
            // Imports normalize asset IDs and editor attributes without authored edits.
            return disk === state.fileBaseline
              ? current !== state.archiveBaseline
              : disk !== current;
          } catch {
            return true;
          }
        }
        return state.archiveBaseline !== current;
      },
      confirm: async () => {
        const messages = this.messages().editor.close;
        if (!state.initialized) {
          const { response } = await dialog.showMessageBox(window, {
            type: "question",
            title: messages.title,
            message: messages.loading,
            detail: messages.loadingDetail,
            buttons: [messages.discard, messages.cancel],
            defaultId: 1,
            cancelId: 1,
            noLink: true,
          });
          return response === 0 ? "discard" : "cancel";
        }
        const { response } = await dialog.showMessageBox(window, {
          type: "question",
          title: messages.title,
          message: messages.message,
          detail: messages.detail,
          buttons: [messages.save, messages.discard, messages.cancel],
          defaultId: 0,
          cancelId: 2,
          noLink: true,
        });
        return (["save", "discard", "cancel"] as const)[response] ?? "cancel";
      },
      save: async () => {
        const snapshot = await this.requestFlush(documentId, "save", 120000);
        return Boolean(snapshot?.filePath);
      },
      close: () => window.close(),
      error: async (error) => {
        LoggerService.write(error, "editor:close");
        const messages = this.messages().editor.close;
        if (!window.isDestroyed())
          await dialog.showMessageBox(window, {
            type: "error",
            message: messages.failed,
            detail: messages.kept,
          });
      },
    });
    this.closeGuards.set(documentId, guard);
    window.on("close", (event) => void guard.request(event));

    window.once("closed", () => {
      ipcMain.removeListener("editor:inspect-element", inspectElement);
      this.closeGuards.delete(documentId);
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
    if (Application.isDev) window.webContents.openDevTools();

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
  static getFromWindow(window: BrowserWindow) {
    return Array.from(this.windows).find(
      ([, state]) => state.window === window,
    )?.[1];
  }

  static async prepareForWorkspaceSwitch(): Promise<boolean> {
    const states = Array.from(this.windows.entries());
    const prepared: EditorCloseGuard[] = [];
    for (const [documentId, state] of states) {
      if (state.window.isDestroyed()) continue;
      const guard = this.closeGuards.get(documentId);
      if (!guard || !(await guard.prepareForWorkspaceSwitch())) {
        prepared.forEach((item) => item.cancelWorkspaceSwitchClose());
        return false;
      }
      prepared.push(guard);
    }

    const closing = states
      .filter(([, state]) => !state.window.isDestroyed())
      .map(([, state]) => this.waitForClosed(state.window));
    prepared.forEach((guard) => guard.commitWorkspaceSwitchClose());
    const results = await Promise.all(closing);
    return results.every(Boolean);
  }

  private static waitForClosed(window: BrowserWindow): Promise<boolean> {
    if (window.isDestroyed()) return Promise.resolve(true);
    return new Promise((resolve) => {
      let finished = false;
      let onClosed = () => {};
      const finish = (closed: boolean) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        window.removeListener("closed", onClosed);
        resolve(closed);
      };
      onClosed = () => finish(true);
      const timer = setTimeout(() => finish(false), 10000);
      window.once("closed", onClosed);
    });
  }

  static async flush(documentId: string, timeout = 30000): Promise<void> {
    if (!this.get(documentId)) return;
    await this.requestFlush(documentId, false, timeout);
  }

  private static async snapshot(
    documentId: string,
  ): Promise<EditorArchiveSnapshot> {
    const snapshot = await this.requestFlush(documentId, true, 30000);
    if (!snapshot?.buffer || typeof snapshot.fileName !== "string")
      throw new Error("Editor archive is unavailable");
    return snapshot;
  }

  private static messages() {
    return ConfigService.getKey("language") === "id" ? id : en;
  }

  static async ready(state: EditorWindowState, bytes: Uint8Array, source?: Uint8Array) {
    if (state.initialized) return;
    state.archiveBaseline = archiveFingerprint(bytes);
    state.fileBaseline = source ? archiveFingerprint(source) : undefined;
    state.initialized = true;
  }

  private static async requestFlush(
    documentId: string,
    archive: boolean | "save",
    timeout: number,
  ): Promise<EditorArchiveSnapshot | undefined> {
    const window = this.get(documentId);
    if (!window) throw new Error("Editor is closed");
    const request = randomUUID();
    const channel = `editor:flush:result:${request}`;
    return await new Promise<EditorArchiveSnapshot | undefined>(
      (resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          ipcMain.removeListener(channel, onResult);
          window.removeListener("closed", onClosed);
        };
        const onResult = (
          event: Electron.IpcMainEvent,
          error?: string,
          snapshot?: EditorArchiveSnapshot,
        ) => {
          if (event.sender !== window.webContents) return;
          cleanup();
          if (error) reject(new Error(error));
          else resolve(snapshot);
        };
        const onClosed = () => {
          cleanup();
          reject(new Error("Editor closed before pending changes were saved"));
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Timed out waiting for editor changes to be saved"));
        }, timeout);
        ipcMain.on(channel, onResult);
        window.once("closed", onClosed);
        try {
          window.webContents.send("editor:flush", request, documentId, archive);
        } catch (error) {
          cleanup();
          reject(error);
        }
      },
    );
  }

  static async save(
    state: EditorWindowState,
    buffer: Uint8Array,
    fileName: string,
    mode: DocumentSaveMode = "save",
  ) {
    const result = await DocumentFileService.save({
      window: state.window, filePath: state.document.filePath, baseline: state.fileBaseline,
    }, buffer, fileName, mode);
    if (result.status === "saved") {
      const fingerprint = archiveFingerprint(buffer);
      state.archiveBaseline = fingerprint;
      state.fileBaseline = fingerprint;
      state.initialized = true;
      state.document.filePath = result.filePath;
    }
    return result;
  }

  static async reloadSource(state: EditorWindowState): Promise<void> {
    const filePath = state.document.filePath;
    if (!filePath) return;
    const model = parseHighTexV2(await fs.promises.readFile(filePath));
    if (model.document.id !== state.document.id)
      throw Error(this.messages().open_file.source_identity_changed);
    // Close-save must finish its flush and unlock before replacing the renderer.
    void this.closeGuards.get(state.document.id)!.whenIdle().then(() => {
      if (state.window.isDestroyed()) return;
      state.initialized = false;
      state.archiveBaseline = undefined;
      state.fileBaseline = undefined;
      state.window.webContents.reload();
    });
  }

  /** Reconnect a moved archive without replacing live editor content. */
  static async locateSource(state: EditorWindowState): Promise<string | undefined> {
    const result = await dialog.showOpenDialog(state.window, {
      title: this.messages().open_file.locate_source,
      defaultPath: state.document.filePath,
      properties: ["openFile"],
      filters: [{ name: "HighTex", extensions: ["hightex"] }],
    });
    if (result.canceled || !result.filePaths[0]) return;
    const filePath = result.filePaths[0];
    const model = parseHighTexV2(await fs.promises.readFile(filePath));
    if (model.document.id !== state.document.id)
      throw Error(this.messages().open_file.source_identity_changed);
    state.document.filePath = filePath;
    return filePath;
  }

  static close(documentId: string): void {
    this.get(documentId)?.close();
  }
}
