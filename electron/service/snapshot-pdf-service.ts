import { BrowserWindow, dialog, ipcMain } from "electron";
import { randomUUID, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ConfigService } from "./config-service";
import { PDFDocument } from "pdf-lib";
import { Application } from "../main/application";
import { CategoryService } from "./category-service";
import { submissionService } from "./submission-service";

export class SnapshotPDFService {
  private get timeout() {
    const value = Number(ConfigService.get().export.exportTimeout);
    return Number.isFinite(value) && value > 0 ? value : 120000;
  }
  private assertSession(input: SnapshotPDFInput) {
    if (input.source.kind !== "submission") return;
    const context = submissionService.context();
    if (
      !context.ok ||
      context.data.sessionId !== input.source.session.sessionId
    )
      throw Error("session_changed");
  }
  async generate(input: SnapshotPDFInput) {
    if (
      !(input.file instanceof Uint8Array) ||
      input.file.byteLength > 64 * 1024 * 1024 ||
      !input.documentId ||
      input.documentId.length > 256
    )
      throw Error("invalid_archive");
    this.assertSession(input);
    const sha256 = createHash("sha256").update(input.file).digest("hex");
    if (input.source.kind === "submission") {
      const result = await submissionService.file({
        ...input.source,
        sessionId: input.source.session.sessionId,
      });
      if (!result.ok) throw Error(result.error.code);
      if (result.data.sha256 !== sha256 || input.source.sha256 !== sha256)
        throw Error("integrity_failed");
    }
    const request = randomUUID();
    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 2000,
      webPreferences: {
        preload: Application.instance.preloadEntry,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: (
      event: Electron.IpcMainEvent,
      nonce: string,
      payload: SnapshotPDFPayload,
    ) => void;
    let failed: (
      event: Electron.IpcMainEvent,
      nonce: string,
      code: string,
    ) => void;
    let renderError: (event: Electron.IpcMainEvent) => void;
    try {
      const categories = await CategoryService.getAll();
      const payload = await new Promise<SnapshotPDFPayload>(
        (resolve, reject) => {
          const belongs = (
            event: Pick<Electron.IpcMainEvent, "sender" | "senderFrame">,
            nonce: string,
          ) =>
            event.sender === win.webContents &&
            event.senderFrame?.processId ===
              win.webContents.mainFrame.processId &&
            event.senderFrame?.routingId ===
              win.webContents.mainFrame.routingId &&
            nonce === request;
          ipcMain.handle(`snapshot:pdf:init:${request}`, (event) => {
            if (!belongs(event, request)) throw Error("forbidden");
            this.assertSession(input);
            return { ...input, categories };
          });
          result = (event, nonce, value) => {
            if (belongs(event, nonce)) resolve(value);
          };
          failed = (event, nonce, code) => {
            if (belongs(event, nonce)) reject(Error(code));
          };
          renderError = (event) => {
            if (event.sender === win.webContents)
              reject(Error("preview_failed"));
          };
          ipcMain.on("snapshot:pdf:result", result);
          ipcMain.on("snapshot:pdf:error", failed);
          ipcMain.on(`page:error:${input.documentId}`, renderError);
          timer = setTimeout(() => reject(Error("pdf_timeout")), this.timeout);
          win.webContents.once("render-process-gone", () =>
            reject(Error("preview_failed")),
          );
          win.once("closed", () => reject(Error("preview_failed")));
          void win
            .loadURL(
              Application.instance.resolveRendererUrl(
                `/submission/print/${encodeURIComponent(input.documentId)}?pdf=1&request=${request}`,
              ),
            )
            .catch(reject);
        },
      );
      clearTimeout(timer);
      this.assertSession(input);
      if (
        payload.sha256 !== sha256 ||
        payload.documentId !== input.documentId ||
        typeof payload.author !== "string" ||
        typeof payload.title !== "string"
      )
        throw Error("integrity_failed");
      timer = setTimeout(() => {
        if (!win.isDestroyed()) win.destroy();
      }, this.timeout);
      const bytes = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: false,
        pageSize: "A4",
        displayHeaderFooter: false,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      const pdf = await PDFDocument.load(bytes);
      pdf.setTitle(payload.title.replace(/<[^>]*>/g, ""));
      pdf.setAuthor(payload.author);
      pdf.setCreator("HighTex");
      pdf.setProducer("HighTex");
      pdf.setKeywords(payload.keywords);
      pdf.setSubject(
        JSON.stringify({
          kind: "snapshot",
          documentId: input.documentId,
          sha256,
          incomplete: payload.incomplete,
          ...(input.source.kind === "submission"
            ? {
                submissionId: input.source.submissionId,
                serverDocumentId: input.source.documentId,
              }
            : {}),
        }),
      );
      this.assertSession(input);
      return pdf.save();
    } finally {
      clearTimeout(timer);
      ipcMain.removeHandler(`snapshot:pdf:init:${request}`);
      if (result!) ipcMain.removeListener("snapshot:pdf:result", result!);
      if (failed!) ipcMain.removeListener("snapshot:pdf:error", failed!);
      if (renderError!)
        ipcMain.removeListener(`page:error:${input.documentId}`, renderError!);
      if (!win.isDestroyed()) win.destroy();
    }
  }
  async export(input: SnapshotPDFInput) {
    const chosen = await dialog.showSaveDialog({
      title: "Export PDF snapshot",
      defaultPath: join(
        ConfigService.get().export.saveFolder,
        input.source.kind === "submission"
          ? `submission-${String(input.source.submissionId).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`
          : "snapshot.pdf",
      ),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (chosen.canceled || !chosen.filePath) return null;
    const bytes = await this.generate(input);
    this.assertSession(input);
    await writeFile(chosen.filePath, bytes);
    return { path: chosen.filePath };
  }
}
