import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { Application } from "./../main/application";
import fs from "fs";
import path from "path";
import { archiveFingerprint } from "../utilities/archive-fingerprint";
import { EditorCloseGuard } from "../utilities/editor-close-guard";
import { ConfigService } from "../service/config-service";
import { LoggerService } from "../service/logger-service";
import en from "../../src/locales/en.json";
import id from "../../src/locales/id.json";
import { isEditorDocumentPath } from "../../src/workspaces/editor-navigation";
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
        if (state.document.filePath) {
          try {
            return (
              archiveFingerprint(
                await fs.promises.readFile(state.document.filePath),
              ) !== archiveFingerprint(snapshot.buffer)
            );
          } catch {
            return true;
          }
        }
        return state.archiveBaseline !== archiveFingerprint(snapshot.buffer);
      },
      confirm: async () => {
        const messages = this.closeMessages();
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
        const messages = this.closeMessages();
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

  private static closeMessages() {
    return (ConfigService.getKey("language") === "id" ? id : en).editor.close;
  }

  static async ready(state: EditorWindowState, bytes: Uint8Array) {
    if (state.initialized) return;
    state.archiveBaseline = archiveFingerprint(bytes);
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
  ) {
    let filePath = state.document.filePath;
    if (!filePath) {
      const result = await dialog.showSaveDialog(state.window, {
        defaultPath: path.join(
          app.getPath("downloads"),
          path.basename(fileName),
        ),
        filters: [{ name: "HighTex", extensions: ["hightex"] }],
      });
      if (result.canceled || !result.filePath) return;
      filePath = result.filePath;
    }

    const fingerprint = archiveFingerprint(buffer);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = path.join(
      path.dirname(filePath),
      `.${path.basename(filePath)}.${randomUUID()}.tmp`,
    );
    try {
      await fs.promises.writeFile(temporary, buffer, { flag: "wx" });
      await fs.promises.rename(temporary, filePath);
    } finally {
      await fs.promises.rm(temporary, { force: true }).catch(() => {});
    }
    state.archiveBaseline = fingerprint;
    state.initialized = true;
    state.document.filePath = filePath;
    return filePath;
  }

  static close(documentId: string): void {
    this.get(documentId)?.close();
  }
}
