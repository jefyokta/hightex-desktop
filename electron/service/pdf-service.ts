import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { BrowserWindow, ipcMain, dialog, app } from "electron";
import { PDFDocument } from "pdf-lib";
import { Application } from "../main/application";
import { LoggerService } from "./logger-service";
import { ConfigService } from "./config-service";
import { ExportTimeout } from "@main/exception/export-timeout";
import { EditorWindow } from "../windows/editor-window";

type Progress = (message: string, value?: number) => void;

export class PDFService {
  static DEFAULT_EXPORT_TIME_OUT = 120000;
  private static readonly loggerDir = path.join(
    app.getPath("userData"),
    "render-logs",
  );

  constructor(private waterMark = false) {}

  private createWindow() {
    return new BrowserWindow({
      show: false,
      width: 1280,
      height: 2000,
      backgroundColor: "#fff",
      webPreferences: {
        preload: Application.instance.preloadEntry,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });
  }

  private async prepareLogger(
    win: BrowserWindow,
    docId: string,
    request: string,
  ) {
    await fs.mkdir(PDFService.loggerDir, { recursive: true });
    const name = `${docId.replace(/[^a-zA-Z0-9_-]/g, "_")}_${request}.log`;
    const loggerFile = path.join(PDFService.loggerDir, name);
    await fs.writeFile(loggerFile, "", "utf8");
    const listener = (
      event: Electron.Event<Electron.WebContentsConsoleMessageEventParams>,
    ) => {
      void LoggerService.writeAsync(
        loggerFile,
        `[${event.level}] ${event.message}\n  at ${event.sourceId}:${event.lineNumber}\n\n`,
      );
    };
    win.webContents.on("console-message", listener);
    return {
      loggerFile,
      detachLogger: () =>
        win.webContents.removeListener("console-message", listener),
    };
  }

  private get timeout(): number {
    const value = Number(ConfigService.get().export.exportTimeout);
    return Number.isFinite(value) && value > 0
      ? value
      : PDFService.DEFAULT_EXPORT_TIME_OUT;
  }

  private waitForExport(docId: string, win: BrowserWindow, request: string) {
    const payloadChannel = `page:payload:${docId}:${request}`;
    const errorChannel = `page:error:${docId}:${request}`;
    const belongs = (event: Electron.IpcMainEvent) =>
      event.sender === win.webContents &&
      event.senderFrame?.processId === win.webContents.mainFrame.processId &&
      event.senderFrame?.routingId === win.webContents.mainFrame.routingId;
    let dispose = () => {};
    const promise = new Promise<ExportPayload>((resolve, reject) => {
      const onPayload = (
        event: Electron.IpcMainEvent,
        payload: ExportPayload,
      ) => {
        if (!belongs(event)) return;
        dispose();
        resolve(payload);
      };
      const onError = (event: Electron.IpcMainEvent, message: string) => {
        if (!belongs(event)) return;
        dispose();
        reject(new Error(String(message)));
      };
      dispose = () => {
        ipcMain.removeListener(payloadChannel, onPayload);
        ipcMain.removeListener(errorChannel, onError);
      };
      ipcMain.on(payloadChannel, onPayload);
      ipcMain.on(errorChannel, onError);
    });
    // An error can arrive before loadURL resolves; keep it handled until awaited.
    void promise.catch(() => {});
    return { promise, dispose: () => dispose() };
  }

  private async withPrintView<T>(
    docId: string,
    progress: Progress | undefined,
    render: (win: BrowserWindow, payload: ExportPayload) => Promise<T>,
  ): Promise<T> {
    const timeout = this.timeout;
    await EditorWindow.flush(docId, timeout);
    const request = randomUUID();
    const win = this.createWindow();
    let detachLogger: () => void = () => {};
    let dispose: () => void = () => {};
    let cleanupGuard: () => void = () => {};
    try {
      const logger = await this.prepareLogger(win, docId, request);
      detachLogger = logger.detachLogger;
      const waiting = this.waitForExport(docId, win, request);
      dispose = waiting.dispose;
      const guard = new Promise<never>((_resolve, reject) => {
        const onGone = (
          _event: Electron.Event,
          details: Electron.RenderProcessGoneDetails,
        ) => reject(new Error(`Renderer process crashed: ${details.reason}`));
        const onClosed = () =>
          reject(new Error("Print window closed before export completed"));
        const timer = setTimeout(
          () =>
            reject(
              new ExportTimeout({
                docId,
                timeout,
                logFile: logger.loggerFile,
              }),
            ),
          timeout,
        );
        win.webContents.once("render-process-gone", onGone);
        win.once("closed", onClosed);
        cleanupGuard = () => {
          clearTimeout(timer);
          win.webContents.removeListener("render-process-gone", onGone);
          win.removeListener("closed", onClosed);
        };
      });
      const work = async () => {
        progress?.("Loading print view...", 20);
        const route = `document/${encodeURIComponent(docId)}/print${this.waterMark ? "/true" : ""}?printRequest=${request}`;
        const [payload] = await Promise.all([
          waiting.promise,
          win
            .loadURL(Application.instance.resolveRendererUrl(route))
            .then(() => {
              progress?.("Rendering document...", 40);
            }),
        ]);
        return render(win, payload);
      };
      return await Promise.race([work(), guard]);
    } finally {
      cleanupGuard();
      dispose();
      detachLogger();
      if (!win.isDestroyed()) win.destroy();
    }
  }

  private applyMetadata(
    pdfDoc: PDFDocument,
    payload: ExportPayload,
    docId: string,
  ) {
    pdfDoc.setTitle(payload.title?.replace(/<[^>]*>/g, "") ?? "Untitled");
    pdfDoc.setAuthor(payload.author ?? "HighTeX");
    pdfDoc.setSubject(
      JSON.stringify({
        producer: "HighTex",
        docId,
        chapters: payload.chapters ?? [],
        hasWm: payload.hasWm ?? false,
        detail: payload.detail,
      }),
    );
    pdfDoc.setCreator("HighTex");
    pdfDoc.setProducer("HighTex");
    pdfDoc.setKeywords(payload.keywords || []);
    pdfDoc.setCreationDate(new Date());
  }

  private async createPdf(
    win: BrowserWindow,
    payload: ExportPayload,
    docId: string,
    progress?: Progress,
  ) {
    progress?.("Generating PDF...", 70);
    const bytes = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: false,
      pageSize: "A4",
      displayHeaderFooter: false,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    progress?.("Applying metadata...", 85);
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    this.applyMetadata(pdf, payload, docId);
    progress?.("Finalizing...", 95);
    return pdf.save();
  }

  async generateHtml(docId: string): Promise<{ html: string; css: string }> {
    return this.withPrintView(docId, undefined, (win) =>
      win.webContents.executeJavaScript(
        `
      (() => ({
        html: document.querySelector(".pagedjs_pages")?.outerHTML ?? "",
        css: Array.from(document.querySelectorAll("style")).map(s => s.innerHTML).join("\\n"),
      }))()
    `,
        true,
      ),
    );
  }

  async generateSilently(docId: string) {
    return this.generate(docId);
  }

  async generate(docId: string, progress?: Progress) {
    return this.withPrintView(docId, progress, (win, payload) =>
      this.createPdf(win, payload, docId, progress),
    );
  }

  async exportPDF(docId: string, progress?: Progress) {
    const result = await dialog.showSaveDialog({
      title: "Export PDF",
      defaultPath: path.join(
        ConfigService.get().export.saveFolder,
        `document-${docId}.pdf`,
      ),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return null;
    const buffer = await this.generate(docId, progress);
    await fs.writeFile(result.filePath, buffer);
    progress?.("Saving PDF file...", 100);
    return { path: result.filePath, filename: path.basename(result.filePath) };
  }
}
