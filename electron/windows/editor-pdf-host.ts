import { BrowserWindow, ipcMain, Menu, type WebContents } from "electron";
import { randomUUID } from "node:crypto";
import { Application } from "../main/application";
import { ConfigService } from "../service/config-service";

/** Own one captured-HTML window, its handshake, cancellation and cleanup. */
export class EditorPDFHost {
  readonly window: BrowserWindow;
  private readonly contents: WebContents;
  private readonly request = randomUUID();
  private readonly ready: Promise<void>;
  private readonly failure: Promise<never>;
  private readonly closed: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (error: Error) => void;
  private rejectFailure!: (error: Error) => void;
  private resolveClosed!: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private signal?: AbortSignal;
  private opened = false;
  private inspecting = false;
  private disposed = false;
  private activity = "loading captured HTML";

  constructor(private readonly snapshot: EditorPDFSnapshot, private readonly debug = false) {
    this.window = new BrowserWindow({
      show: false, width: 1100, height: 1300,
      webPreferences: {
        preload: Application.instance.preloadEntry,
        contextIsolation: true, sandbox: true, backgroundThrottling: false,
      },
    });
    this.contents = this.window.webContents;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve; this.rejectReady = reject;
    });
    this.failure = new Promise((_, reject) => { this.rejectFailure = reject; });
    this.closed = new Promise(resolve => { this.resolveClosed = resolve; });
    void this.ready.catch(() => {});
    void this.failure.catch(() => {});
    ipcMain.handle(`experimental:editor-pdf:init:${this.request}`, event => {
      if (!this.belongs(event, this.request)) throw Error("forbidden");
      return this.snapshot;
    });
    ipcMain.on("experimental:editor-pdf:ready", this.onReady);
    ipcMain.on("experimental:editor-pdf:error", this.onError);
    this.window.once("closed", this.onClosed);
    this.contents.once("render-process-gone", this.onGone);
    if (debug) {
      this.contents.on("context-menu", this.onContextMenu);
      this.contents.on("before-input-event", this.onShortcut);
      ipcMain.on("editor:inspect-element", this.onInspect);
    }
  }

  async open(signal: AbortSignal) {
    if (this.opened || this.disposed) throw Error("Editor PDF host is single-use");
    this.opened = true;
    this.signal = signal;
    signal.addEventListener("abort", this.onAbort, { once: true });
    const value = Number(ConfigService.get().export.exportTimeout);
    const timeout = Number.isFinite(value) && value > 0 ? value : 120000;
    this.timer = setTimeout(() => this.stop(
      `Editor PDF timeout after ${timeout} ms while ${this.activity} (document ${this.snapshot.documentId}, ${this.snapshot.pages} pages)`), timeout);
    signal.throwIfAborted();
    await this.run(async () => {
      await Promise.all([
        this.ready,
        this.window.loadURL(Application.instance.resolveRendererUrl(
          `/experimental/editor-pdf/print?request=${this.request}${this.debug ? "&debug=1" : ""}`,
        )),
      ]);
      signal.throwIfAborted();
    });
  }

  /** Keep renderer/window failures observable while native printing is pending. */
  run<T>(work: () => Promise<T>, activity?: string): Promise<T> {
    if (activity) this.activity = activity;
    return Promise.race([work(), this.failure]);
  }

  async inspect(signal: AbortSignal) {
    await this.open(signal);
    clearTimeout(this.timer);
    this.inspecting = true;
    this.window.show();
    this.contents.openDevTools({ mode: "detach" });
    await this.run(() => this.closed, "inspecting captured HTML");
    signal.throwIfAborted();
  }

  private belongs(event: Pick<Electron.IpcMainEvent, "sender" | "senderFrame">, request: string) {
    if (this.disposed) return false;
    const contents = this.contents;
    return request === this.request && event.sender === contents &&
      event.senderFrame?.processId === contents.mainFrame.processId &&
      event.senderFrame?.routingId === contents.mainFrame.routingId;
  }

  private onReady = (event: Electron.IpcMainEvent, request: string, fingerprint: string, pages: number) => {
    if (!this.belongs(event, request)) return;
    if (fingerprint !== this.snapshot.fingerprint || pages !== this.snapshot.pages)
      this.stop("Editor PDF ready identity changed");
    else this.resolveReady();
  };
  private onError = (event: Electron.IpcMainEvent, request: string, message: string) => {
    if (this.belongs(event, request)) this.stop(String(message));
  };
  private onClosed = () => {
    if (this.inspecting) this.resolveClosed();
    else this.stop("Editor PDF window closed");
  };
  private onGone = () => this.stop("Editor PDF renderer failed");
  private onAbort = () => this.stop("Editor PDF cancelled");

  private onInspect = (event: Electron.IpcMainEvent, x: number, y: number) => {
    if (this.debug && this.belongs(event, this.request) && Number.isFinite(x) && Number.isFinite(y))
      this.contents.inspectElement(x, y);
  };
  private onContextMenu = (_event: Electron.Event, params: Electron.ContextMenuParams) => {
    Menu.buildFromTemplate([
      { label: "Inspect Element", click: () => this.contents.inspectElement(params.x, params.y) },
      { label: "Buka DevTools", click: () => this.contents.openDevTools({ mode: "detach" }) },
    ]).popup({ window: this.window });
  };
  private onShortcut = (event: Electron.Event, input: Electron.Input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F12" || (input.key.toLowerCase() === "i" &&
      ((input.meta && input.alt) || (input.control && input.shift)))) {
      event.preventDefault();
      this.contents.toggleDevTools();
    }
  };

  private stop(message: string) {
    const error = Error(message);
    this.rejectReady(error);
    this.rejectFailure(error);
    this.destroy();
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.timer);
    this.signal?.removeEventListener("abort", this.onAbort);
    ipcMain.removeHandler(`experimental:editor-pdf:init:${this.request}`);
    ipcMain.removeListener("experimental:editor-pdf:ready", this.onReady);
    ipcMain.removeListener("experimental:editor-pdf:error", this.onError);
    this.window.removeListener("closed", this.onClosed);
    this.contents.removeListener("render-process-gone", this.onGone);
    this.contents.removeListener("context-menu", this.onContextMenu);
    this.contents.removeListener("before-input-event", this.onShortcut);
    ipcMain.removeListener("editor:inspect-element", this.onInspect);
    if (!this.window.isDestroyed()) this.window.destroy();
  }
}
