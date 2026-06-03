import fs from "node:fs/promises";
import path from "node:path";

import { BrowserWindow, ipcMain, dialog } from "electron";
import { PDFDocument } from "pdf-lib";

import { Application } from "../main/application";

export class PDFService {
  private window: BrowserWindow | null = null;

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
    });
  }

  async generate(docId: string, progress?: (s: string, v?: number) => void) {
    const win = this.createWindow();

    try {
      const url = Application.instance.resolveRendererUrl(
        `document/${docId}/print`,
      );

      progress?.("Loading print view...", 20);

      const exportPayloadPromise = this.waitForExport(docId, win);

      await new Promise<void>((resolve, reject) => {
        win.webContents.once("did-finish-load", () => resolve());
        win.webContents.once("did-fail-load", (_e, code, desc, url) => {
          reject(new Error(`Print failed: ${desc} (${code}) ${url}`));
        });

        win.loadURL(url).catch(reject);
      });

      progress?.("Rendering document...", 40);

      const exportPayload = await exportPayloadPromise;

      await win.webContents.executeJavaScript(`
        document.title = ${JSON.stringify(exportPayload.title ?? "Untitled")};

        const metaAuthor = document.createElement("meta");
        metaAuthor.name = "author";
        metaAuthor.content = ${JSON.stringify(exportPayload.author ?? "HighTeX")};
        document.head.appendChild(metaAuthor);

        const metaSubject = document.createElement("meta");
        metaSubject.name = "subject";
        metaSubject.content = JSON.stringify({
          producer: "HighTeX",
          docId: ${JSON.stringify(docId)},
          chapters: ${JSON.stringify(exportPayload.chapters ?? [])},
          hasWm: ${JSON.stringify(exportPayload.hasWm ?? false)}
        });
        document.head.appendChild(metaSubject);

        window.__hightex_meta = {
          producer: "HighTeX",
          docId: ${JSON.stringify(docId)},
          chapters: ${JSON.stringify(exportPayload.chapters ?? [])},
          hasWm: ${JSON.stringify(exportPayload.hasWm ?? false)}
        };
      `);

      progress?.("Generating PDF...", 70);

      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      });

      progress?.("Applying metadata (safe mode)...", 85);

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
        }),
      );

      pdfDoc.setCreator("HighTeX");
      pdfDoc.setProducer("HighTeX");
      pdfDoc.setKeywords(exportPayload.keywords || []);
      pdfDoc.setCreationDate(new Date());

      progress?.("Finalizing...", 95);

      const finalPdf = await pdfDoc.save();

      return finalPdf;
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
      defaultPath: `document-${docId}.pdf`,
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
