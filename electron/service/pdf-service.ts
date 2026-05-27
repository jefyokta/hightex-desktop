import fs from "node:fs/promises";
import path from "node:path";

import { BrowserWindow, ipcMain, dialog } from "electron";
import { PDFDocument } from "pdf-lib";

import { Application } from "../main/application";

;

export class PDFService {
  private window: BrowserWindow | null = null;

  private createWindow() {
    this.window = new BrowserWindow({
    //   show: false,
      width: 1280,
      height: 2000,
      backgroundColor: "#fff",
      webPreferences: {
        preload: Application.instance.preloadEntry,
        // sandbox: false,
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

          if (payload) {
            resolve(payload as ExportPayload);
            return;
          }

          reject(
            new Error(
              `Render completed but no export payload available for docId: ${docId}`,
            ),
          );
        } catch (error) {
          cleanup();
          reject(error);
        }
      });
    });
  }

  async generate(
    docId: string,
    progress?: (status: string, value?: number) => void,
  ) {
    const win = this.createWindow();

    try {
      const url = Application.instance.resolveRendererUrl(
        `/document/${docId}/print`,
      );

      progress?.("Loading print view...", 20);
      const exportPayloadPromise = this.waitForExport(docId, win);

      await new Promise<void>((resolve, reject) => {
        win.webContents.once("did-finish-load", () => resolve());
        win.webContents.once("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
          reject(
            new Error(
              `Print view failed to load: ${errorDescription} (${errorCode}) ${validatedURL}`,
            ),
          );
        });

        win.loadURL(url).catch(reject);
      });

      progress?.("Rendering document...", 40);
      const exportPayload = await exportPayloadPromise;
      progress?.("Generating PDF...", 65);

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

      const pdf = await PDFDocument.load(pdfBuffer);

      if (exportPayload.author) {
        pdf.setAuthor(exportPayload.author);
      }

      pdf.setCreator("HighTeX");
      pdf.setProducer("HighTeX");

      if (exportPayload.title) {
        pdf.setTitle(exportPayload.title.replace(/<[^>]*>/g, ""));
      }

      pdf.attach(
        new TextEncoder().encode(
          JSON.stringify({
            chapters: exportPayload.chapters ?? [],
            hasWm: exportPayload.hasWm ?? false,
          }),
        ),
        "meta-data.json",
        { mimeType: "application/json" },
      );

      return await pdf.save();
    }
     finally {
      if (this.window && !this.window.isDestroyed()) {
        this.window.destroy();
      }
      this.window = null;
    }
  }

  async exportPDF(
    docId: string,
    progress?: (status: string, value?: number) => void,
  ) {
    const result = await dialog.showSaveDialog({
      title: "Export PDF",
      defaultPath: `document-${docId}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (result.canceled || !result.filePath) return null;

    const buffer = await this.generate(docId, progress);

    progress?.("Saving PDF file...", 95);
    await fs.writeFile(result.filePath, buffer);

    return {
      path: result.filePath,
      filename: path.basename(result.filePath),
    };
  }
}