import fs from "node:fs/promises";
import path from "node:path";

import { BrowserWindow, ipcMain, dialog } from "electron";
import { PDFDocument } from "pdf-lib";

import { Application } from "../main/application";
import { LoggerService } from "./logger-service";
import { ShouldSilent } from "@main/exception/should-silent";
import { ConfigService } from "./config-service";

export class PDFService {
  private window: BrowserWindow | null = null;

  constructor(private waterMark = false) {}

  private createWindow() {
    this.window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 2000,
      backgroundColor: "#fff",
      webPreferences: {
        preload: Application.instance.preloadEntry,
        contextIsolation: true,
      },
    });

    return this.window;
  }

  private channel(docId: string) {
    return `page:payload:${docId}`;
  }

  private waitForExport(
    docId: string,
    win: BrowserWindow,
  ): Promise<ExportPayload> {
    const channel = this.channel(docId);
    const renderedChannel = `page:rendered:${docId}`;
    const errorChannel = `page:error:${docId}`;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        ipcMain.removeAllListeners(channel);
        ipcMain.removeAllListeners(renderedChannel);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Export timeout for docId: ${docId}`));
      }, 120000);

      ipcMain.once(channel, (_event, payload) => {
        cleanup();
        resolve(payload);
      });

      ipcMain.once(renderedChannel, async () => {
        try {
          const payload = await win.webContents.executeJavaScript(
            `window.__hightexExportPayload || null`,
            true,
          );

          cleanup();

          if (payload) resolve(payload as ExportPayload);
          else reject(new Error(`No export payload for docId: ${docId}`));
        } catch (err) {
          cleanup();
          reject(err);
        }
      });
      ipcMain.once(errorChannel, (_e, message: string) => {
        cleanup();
        reject(new Error(message));
      });
      win.webContents.once("render-process-gone", (_event, details) => {
        cleanup();
        reject(new Error(`Renderer process crashed: ${details.reason}`));
      });
    });
  }

  async generateHtml(docId: string): Promise<{ html: string; css: string }> {
    const win = this.createWindow();
    try {
      const url = Application.instance.resolveRendererUrl(
        `document/${docId}/print`,
      );

      const exportPayloadPromise = this.waitForExport(docId, win);

      await new Promise<void>((resolve, reject) => {
        win.webContents.once("did-finish-load", () => resolve());
        win.webContents.once("did-fail-load", (_e, code, desc, url) => {
          reject(new Error(`Print failed: ${desc} (${code}) ${url}`));
        });
        win.loadURL(url).catch(reject);
      });

      await exportPayloadPromise;

      const snapshot = await win.webContents.executeJavaScript(
        `
  (() => {
    const html = document.querySelector('.pagedjs_pages')?.outerHTML ?? "";

    const css = Array.from(document.querySelectorAll('style'))
      .map(s => s.innerHTML)
      .join("\\n");

    return { html, css };
  })()
  `,
        true,
      );

      return snapshot as { html: string; css: string };
    } catch (e) {
      LoggerService.write(e, "generate:html");
      throw e;
    } finally {
      if (!win.isDestroyed()) win.destroy();
    }
  }

  async generateSilently(docId: string) {
    const win = this.createWindow();
    try {
      const url = Application.instance.resolveRendererUrl(
        `document/${docId}/print${this.waterMark ? "/true" : ""}`,
      );

      const exportPayloadPromise = this.waitForExport(docId, win);
      await new Promise<void>(async (resolve, reject) => {
        win.webContents.once("did-finish-load", () => resolve());
        win.webContents.once("did-fail-load", (_e, code, desc, url) => {
          reject(new Error(`Print failed: ${desc} (${code}) ${url}`));
        });

        win.loadURL(url).catch(reject);
        await win.webContents.executeJavaScript(`
          window.sharingMode = true;
          
          `);
      });
      const exportPayload = await exportPayloadPromise;
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: false,
        pageSize: "A4",
        displayHeaderFooter: false,
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      });

      const pdfDoc = await PDFDocument.load(pdfBuffer, {
        ignoreEncryption: true,
      });

      const safeTitle =
        exportPayload.title?.replace(/<[^>]*>/g, "") ?? "Untitled";

      pdfDoc.setTitle(safeTitle);
      pdfDoc.setAuthor(exportPayload.author ?? "HighTeX");

      pdfDoc.setSubject(
        JSON.stringify({
          producer: "HighTeX",
          docId,
          chapters: exportPayload.chapters ?? [],
          hasWm: exportPayload.hasWm ?? false,
          detail: exportPayload.detail,
        }),
      );

      pdfDoc.setCreator("HighTeX");
      pdfDoc.setProducer("HighTeX");
      pdfDoc.setKeywords(exportPayload.keywords || []);
      pdfDoc.setCreationDate(new Date());

      return await pdfDoc.save();
    } catch (error) {
      throw new ShouldSilent(String(error));
    }
  }
  async generate(docId: string, progress?: (s: string, v?: number) => void) {
    const win = this.createWindow();
    try {
      const url = Application.instance.resolveRendererUrl(
        `document/${docId}/print${this.waterMark ? "/true" : ""}`,
      );

      progress?.("Loading print view...", 20);

      const exportPayloadPromise = this.waitForExport(docId, win);

      await new Promise<void>(async (resolve, reject) => {
        win.webContents.once("did-finish-load", () => resolve());
        win.webContents.once("did-fail-load", (_e, code, desc, url) => {
          reject(new Error(`Print failed: ${desc} (${code}) ${url}`));
        });

        win.loadURL(url).catch(reject);
        await win.webContents.executeJavaScript(`
          window.sharingMode = true;
          
          `);
      });

      progress?.("Rendering document...", 40);

      const exportPayload = await exportPayloadPromise;

      progress?.("Generating PDF...", 70);

      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: false,
        pageSize: "A4",
        displayHeaderFooter: false,
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      });

      progress?.("Applying metadata...", 85);

      const pdfDoc = await PDFDocument.load(pdfBuffer, {
        ignoreEncryption: true,
      });

      const safeTitle =
        exportPayload.title?.replace(/<[^>]*>/g, "") ?? "Untitled";

      pdfDoc.setTitle(safeTitle);
      pdfDoc.setAuthor(exportPayload.author ?? "HighTeX");

      pdfDoc.setSubject(
        JSON.stringify({
          producer: "HighTeX",
          docId,
          chapters: exportPayload.chapters ?? [],
          hasWm: exportPayload.hasWm ?? false,
          detail: exportPayload.detail,
        }),
      );

      pdfDoc.setCreator("HighTeX");
      pdfDoc.setProducer("HighTeX");
      pdfDoc.setKeywords(exportPayload.keywords || []);
      pdfDoc.setCreationDate(new Date());

      progress?.("Finalizing...", 95);

      const finalPdf = await pdfDoc.save();

      return finalPdf;
    } catch (e) {
      throw e;
    } finally {
      if (this.window && !this.window.isDestroyed()) {
        this.window.destroy();
      }
      this.window = null;
    }
  }

  async exportPDF(docId: string, progress?: (s: string, v?: number) => void) {
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

    progress?.("Saving PDF file...", 100);

    await fs.writeFile(result.filePath, buffer);

    return {
      path: result.filePath,
      filename: path.basename(result.filePath),
    };
  }
}
