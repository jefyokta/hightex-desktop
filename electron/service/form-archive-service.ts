import { BrowserWindow, dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync } from "fflate";
import { Application } from "../main/application";
import { ConfigService } from "./config-service";
import {
  buildFormFiles,
  validatePrintInput,
  type FormPrintInput,
} from "../../src/forms/model";

/** Render each HTML form independently, preserving its paper size, then ZIP it.
 * No PDF editing, template overlay, or combined document is used. */
export class FormArchiveService {
  async export(input: FormPrintInput) {
    if (!validatePrintInput(input) || !buildFormFiles(input).length)
      throw Error("invalid_forms");
    const chosen = await dialog.showSaveDialog({
      title: "Simpan paket formulir",
      defaultPath: join(
        ConfigService.get().export.saveFolder,
        `formulir-${input.stage === "proposal" ? "proposal" : "sidang"}.zip`,
      ),
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });
    if (chosen.canceled || !chosen.filePath) return null;
    const bytes = await this.generate(input);
    await writeFile(chosen.filePath, bytes);
    return { path: chosen.filePath };
  }
  async generate(input: FormPrintInput): Promise<Uint8Array> {
    if (!validatePrintInput(input)) throw Error("invalid_forms");
    const files = buildFormFiles(input);
    if (!files.length) throw Error("no_forms");
    const request = randomUUID();
    const win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 1500,
      webPreferences: {
        preload: Application.instance.preloadEntry,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });
    const timeout = Number(ConfigService.get().export.exportTimeout) || 120000;
    const belongs = (
      event: Pick<Electron.IpcMainEvent, "sender" | "senderFrame">,
      nonce: string,
    ) =>
      event.sender === win.webContents &&
      event.senderFrame?.processId === win.webContents.mainFrame.processId &&
      event.senderFrame?.routingId === win.webContents.mainFrame.routingId &&
      nonce === request;
    let expected = -1;
    let resolveReady: (() => void) | undefined;
    let rejectReady: ((reason: Error) => void) | undefined;
    const ready = (
      event: Electron.IpcMainEvent,
      nonce: string,
      index: number,
    ) => {
      if (belongs(event, nonce) && index === expected) resolveReady?.();
    };
    const failed = (
      event: Electron.IpcMainEvent,
      nonce: string,
      message: string,
    ) => {
      if (belongs(event, nonce)) rejectReady?.(Error(message));
    };
    const timer = setTimeout(() => {
      rejectReady?.(Error("forms_timeout"));
      if (!win.isDestroyed()) win.destroy();
    }, timeout);
    try {
      ipcMain.handle(`forms:init:${request}`, (event) => {
        if (!belongs(event, request)) throw Error("forbidden");
        return input;
      });
      ipcMain.on("forms:ready", ready);
      ipcMain.on("forms:error", failed);
      win.once("closed", () => rejectReady?.(Error("forms_closed")));
      win.webContents.once("render-process-gone", () =>
        rejectReady?.(Error("forms_render_failed")),
      );
      const output: Record<string, Uint8Array> = {};
      for (let index = 0; index < files.length; index++) {
        await new Promise<void>((resolve, reject) => {
          expected = index;
          resolveReady = resolve;
          rejectReady = reject;
          void win
            .loadURL(
              Application.instance.resolveRendererUrl(
                `/forms/print?pdf=1&request=${request}&file=${index}`,
              ),
            )
            .catch(reject);
        });
        output[files[index].filename] = await win.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: false,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });
      }
      return zipSync(output, { level: 6 });
    } finally {
      clearTimeout(timer);
      ipcMain.removeHandler(`forms:init:${request}`);
      ipcMain.removeListener("forms:ready", ready);
      ipcMain.removeListener("forms:error", failed);
      if (!win.isDestroyed()) win.destroy();
    }
  }
}
