import fs from "node:fs/promises";
import path from "node:path";

import { BrowserWindow, ipcMain, dialog, app } from "electron";
import { PDFDocument } from "pdf-lib";

import { Application } from "../main/application";
import { LoggerService } from "./logger-service";
import { ShouldSilent } from "@main/exception/should-silent";
import { ConfigService } from "./config-service";
import { ExportTimeout } from "@main/exception/export-timeout";

export class PDFService {
  private window: BrowserWindow | null = null;

  static DEFAULT_EXPORT_TIME_OUT = 120000;

  private static readonly loggerDir = path.join(
    app.getPath("userData"),
    "render-logs",
  );

  private logFile = "";

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
        backgroundThrottling: false,
      },
    });

    return this.window;
  }

  private destroyWindow(win: BrowserWindow) {
    if (!win.isDestroyed()) {
      win.destroy();
    }

    this.window = null;
  }

  private channel(docId: string) {
    return `page:payload:${docId}`;
  }

  private async createLoggerFile(docId: string) {
    await fs.mkdir(PDFService.loggerDir, {
      recursive: true,
    });

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    const loggerFile = path.join(
      PDFService.loggerDir,
      `${docId}_${timestamp}.log`,
    );

    this.logFile = loggerFile;

    await fs.writeFile(loggerFile, "", "utf8");

    return loggerFile;
  }

  private get timeout(): number {
    const usrTimeOut = Number(
      ConfigService.get().export.exportTimeout,
    );

    return isNaN(usrTimeOut) ||
      usrTimeOut === 0 ||
      usrTimeOut === Infinity
      ? PDFService.DEFAULT_EXPORT_TIME_OUT
      : usrTimeOut;
  }

  private attachConsoleLogger(
    win: BrowserWindow,
    loggerFile: string,
  ) {
    const listener = (
      _event: Electron.Event,
      level: number,
      message: string,
      line: number,
      sourceId: string,
    ) => {
      const levelName =
        level === 0
          ? "log"
          : level === 1
            ? "warn"
            : level === 2
              ? "error"
              : level === 3
                ? "debug"
                : "info";

      void LoggerService.writeAsync(
        loggerFile,
        `[${levelName}] ${message}\n` +
          `  at ${sourceId}:${line}\n\n`,
      );
    };

    win.webContents.on("console-message", listener);

    return () => {
      win.webContents.removeListener(
        "console-message",
        listener,
      );
    };
  }

  private async prepareLogger(
    win: BrowserWindow,
    docId: string,
  ) {
    const loggerFile =
      await this.createLoggerFile(docId);

    const detachLogger =
      this.attachConsoleLogger(
        win,
        loggerFile,
      );

    return {
      loggerFile,
      detachLogger,
    };
  }

  private async loadPrintView(
    win: BrowserWindow,
    docId: string,
  ) {
    const url =
      Application.instance.resolveRendererUrl(
        `document/${docId}/print${
          this.waterMark ? "/true" : ""
        }`,
      );

    await new Promise<void>(
      (resolve, reject) => {
        win.webContents.once(
          "did-finish-load",
          () => resolve(),
        );

        win.webContents.once(
          "did-fail-load",
          (
            _event,
            code,
            desc,
            failedUrl,
          ) => {
            reject(
              new Error(
                `Print failed: ${desc} (${code}) ${failedUrl}`,
              ),
            );
          },
        );

        win.loadURL(url).catch(reject);
      },
    );
  }

  private applyMetadata(
    pdfDoc: PDFDocument,
    exportPayload: ExportPayload,
    docId: string,
  ) {
    const safeTitle =
      exportPayload.title?.replace(
        /<[^>]*>/g,
        "",
      ) ?? "Untitled";

    pdfDoc.setTitle(safeTitle);

    pdfDoc.setAuthor(
      exportPayload.author ?? "HighTeX",
    );

    pdfDoc.setSubject(
      JSON.stringify({
        producer: "HighTex",
        docId,
        chapters:
          exportPayload.chapters ?? [],
        hasWm:
          exportPayload.hasWm ?? false,
        detail: exportPayload.detail,
      }),
    );

    pdfDoc.setCreator("HighTex");
    pdfDoc.setProducer("HighTex");

    pdfDoc.setKeywords(
      exportPayload.keywords || [],
    );

    pdfDoc.setCreationDate(new Date());
  }

  private async createPdf(
    win: BrowserWindow,
    exportPayload: ExportPayload,
    docId: string,
    progress?: (
      message: string,
      value?: number,
    ) => void,
  ) {
    progress?.(
      "Generating PDF...",
      70,
    );

    const pdfBuffer =
      await win.webContents.printToPDF({
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

    progress?.(
      "Applying metadata...",
      85,
    );

    const pdfDoc =
      await PDFDocument.load(
        pdfBuffer,
        {
          ignoreEncryption: true,
        },
      );

    this.applyMetadata(
      pdfDoc,
      exportPayload,
      docId,
    );

    progress?.(
      "Finalizing...",
      95,
    );

    const finalPdf =
      await pdfDoc.save();

    progress?.(
      "Finalizing...",
      100,
    );

    return finalPdf;
  }

  private waitForExport(
    docId: string,
    win: BrowserWindow,
  ): Promise<ExportPayload> {
    const channel =
      this.channel(docId);

    const renderedChannel =
      `page:rendered:${docId}`;

    const errorChannel =
      `page:error:${docId}`;

    return new Promise(
      (resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);

          ipcMain.removeAllListeners(
            channel,
          );

          ipcMain.removeAllListeners(
            renderedChannel,
          );

          ipcMain.removeAllListeners(
            errorChannel,
          );
        };

        const timeout = setTimeout(
          () => {
            cleanup();

            reject(
              new ExportTimeout({
                docId,
                timeout: this.timeout,
                logFile: this.logFile,
              }),
            );
          },
          this.timeout,
        );

        ipcMain.once(
          channel,
          (_event, payload) => {
            cleanup();
            resolve(payload);
          },
        );

        ipcMain.once(
          renderedChannel,
          async () => {
            try {
              const payload =
                await win.webContents.executeJavaScript(
                  `window.__hightexExportPayload || null`,
                  true,
                );

              cleanup();

              if (payload) {
                resolve(
                  payload as ExportPayload,
                );
              } else {
                reject(
                  new Error(
                    `No export payload for docId: ${docId}`,
                  ),
                );
              }
            } catch (err) {
              cleanup();
              reject(err);
            }
          },
        );

        ipcMain.once(
          errorChannel,
          (_event, message: string) => {
            cleanup();
            reject(
              new Error(message),
            );
          },
        );

        win.webContents.once(
          "render-process-gone",
          (_event, details) => {
            cleanup();

            reject(
              new Error(
                `Renderer process crashed: ${details.reason}`,
              ),
            );
          },
        );
      },
    );
  }

  async generateHtml(
    docId: string,
  ): Promise<{
    html: string;
    css: string;
  }> {
    const win = this.createWindow();

    const {
      detachLogger,
    } = await this.prepareLogger(
      win,
      docId,
    );

    try {
      const exportPayloadPromise =
        this.waitForExport(
          docId,
          win,
        );

      await this.loadPrintView(
        win,
        docId,
      );

      await exportPayloadPromise;

      const snapshot =
        await win.webContents.executeJavaScript(
          `
          (() => {
            const html =
              document.querySelector(".pagedjs_pages")
                ?.outerHTML ?? "";

            const css =
              Array.from(
                document.querySelectorAll("style")
              )
                .map((s) => s.innerHTML)
                .join("\\n");

            return { html, css };
          })()
          `,
          true,
        );

      return snapshot as {
        html: string;
        css: string;
      };
    } catch (error) {
      LoggerService.write(
        error,
        "generate:html",
      );

      throw error;
    } finally {
      detachLogger();
      this.destroyWindow(win);
    }
  }

  async generateSilently(
    docId: string,
  ) {
    const win = this.createWindow();

    const {
      detachLogger,
    } = await this.prepareLogger(
      win,
      docId,
    );

    try {
      const url =
        Application.instance.resolveRendererUrl(
          `document/${docId}/print${
            this.waterMark
              ? "/true"
              : ""
          }`,
        );

      const exportPayloadPromise =
        this.waitForExport(
          docId,
          win,
        );

      await new Promise<void>(
        async (resolve, reject) => {
          win.webContents.once(
            "did-finish-load",
            () => resolve(),
          );

          win.webContents.once(
            "did-fail-load",
            (
              _event,
              code,
              desc,
              failedUrl,
            ) => {
              reject(
                new Error(
                  `Print failed: ${desc} (${code}) ${failedUrl}`,
                ),
              );
            },
          );

          win.loadURL(url).catch(reject);

          await win.webContents.executeJavaScript(`
            window.sharingMode = true;
          `);
        },
      );

      const exportPayload =
        await exportPayloadPromise;

      return await this.createPdf(
        win,
        exportPayload,
        docId,
      );
    } catch (error) {
      if (
        error instanceof ExportTimeout
      ) {
        return this.window?.webContents.send(
          "error",
          {
            error,
            name: "export-timeout",
          },
        );
      }

      throw new ShouldSilent(
        String(error),
      );
    } finally {
      detachLogger();
      this.destroyWindow(win);
    }
  }

  async generate(
    docId: string,
    progress?: (
      message: string,
      value?: number,
    ) => void,
  ) {
    const win = this.createWindow();

    const {
      detachLogger,
    } = await this.prepareLogger(
      win,
      docId,
    );

    try {
      const url =
        Application.instance.resolveRendererUrl(
          `document/${docId}/print${
            this.waterMark
              ? "/true"
              : ""
          }`,
        );

      progress?.(
        "Loading print view...",
        20,
      );

      const exportPayloadPromise =
        this.waitForExport(
          docId,
          win,
        );

      await new Promise<void>(
        async (resolve, reject) => {
          win.webContents.once(
            "did-finish-load",
            () => resolve(),
          );

          win.webContents.once(
            "did-fail-load",
            (
              _event,
              code,
              desc,
              failedUrl,
            ) => {
              reject(
                new Error(
                  `Print failed: ${desc} (${code}) ${failedUrl}`,
                ),
              );
            },
          );

          win.loadURL(url).catch(reject);

          await win.webContents.executeJavaScript(`
            window.sharingMode = true;
          `);
        },
      );

      progress?.(
        "Rendering document...",
        40,
      );

      const exportPayload =
        await exportPayloadPromise;

      return await this.createPdf(
        win,
        exportPayload,
        docId,
        progress,
      );
    } finally {
      detachLogger();
      this.destroyWindow(win);
    }
  }

  async exportPDF(
    docId: string,
    progress?: (
      message: string,
      value?: number,
    ) => void,
  ) {
    const result =
      await dialog.showSaveDialog({
        title: "Export PDF",
        defaultPath: path.join(
          ConfigService.get()
            .export.saveFolder,
          `document-${docId}.pdf`,
        ),
        filters: [
          {
            name: "PDF",
            extensions: ["pdf"],
          },
        ],
      });

    if (
      result.canceled ||
      !result.filePath
    ) {
      return null;
    }

    try {
      const buffer =
        await this.generate(
          docId,
          progress,
        );

      await fs.writeFile(
        result.filePath,
        buffer,
      );

      progress?.(
        "Saving PDF file...",
        100,
      );

      return {
        path: result.filePath,
        filename:
          path.basename(
            result.filePath,
          ),
      };
    } catch (error) {
      if (
        error instanceof ExportTimeout
      ) {
        return Application.instance?.window?.webContents.send(
          "error",
          {
            error:{
              desc:String(error),
              logFile:error.logFile,
              
            },
            name: "export-timeout",
          },
        );
      }

      throw new Error(
        String(error),
      );
    }
  }
}