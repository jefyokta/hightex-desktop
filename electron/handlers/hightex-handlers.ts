import fs from "fs";
import path from "path";
import { app, dialog, ipcMain } from "electron";
import Store from "electron-store";
import { ServerService } from "../service/server-service";
import { LoggerService } from "../service/logger-service";
import { DocumentProfileService } from "../service/document-profile-service";
import { PDFService } from "../service/pdf-service";
import { CategoryService } from "../service/category-service";

export class HighTexHandler {
  private static store = new Store();

  static register() {
    ipcMain.handle("hightex:document", async () => {
      try {
        return await ServerService.request("/document");
      } catch (err) {
        LoggerService.write(err, "hightex:document");
        return false;
      }
    });

    ipcMain.handle("hightex:readFile", async (_ev, filePath: string) => {
      return await fs.promises.readFile(filePath);
    });

    ipcMain.handle("hightex:pdf", async (event, id: string) => {
      if (!id) {
        throw new Error("Document id is required for PDF export.");
      }

      const progress = (status: string, value?: number) => {
        event.sender.send("hightex:pdf:progress", { status, progress: value });
      };

      try {
        progress("Opening print view...", 5);
        const pdf = new PDFService();
        const result = await pdf.exportPDF(id, progress);
        progress("Export complete", 100);
        return result;
      } catch (error) {
        LoggerService.write(error, "hightex:pdf");
        progress("PDF export failed", 0);
        throw error instanceof Error
          ? new Error(error.message)
          : new Error("Unable to export PDF.");
      }
    });

    ipcMain.handle("hightex:prefetch", async (event) => {
      const send = (status: string, progress: number) => {
        event.sender.send("hightex:prefetch:progress", {
          status,
          progress,
        });
      };

      try {
        send("Checking session", 10);
        await ServerService.request("/me").catch(() => null);
        send("Checking categories update", 50);
        const categories: { data: Category } =
          await ServerService.request("/categories");
        this.store.set("hightex.categories", JSON.stringify(categories));
        send("Loading documents", 65);
        await ServerService.request("/document").catch(() => null);

        send("Warming cache", 85);
        await new Promise((r) => setTimeout(r, 150));

        send("done", 100);
        return true;
      } catch (err) {
        LoggerService.write(err, "hightex:prefetch");
        send("error", 0);
        return false;
      }
    });

    ipcMain.handle("hightex:categories", async () => {
      return await CategoryService.getAll();
    });

    ipcMain.handle("hightex:version", () => {
      return app.getVersion();
    });

    ipcMain.handle(
      "hightex:report-error",
      async (_event, payload: { title: string; description: string }) => {
        try {
          return await ServerService.request("/issues", {
            method: "POST",
            body: JSON.stringify({
              title:` ${payload.title}. On desktop app version: ${app.getVersion()}`,
              description: `${payload.description}`,
            }),
          });
        } catch (err) {
          LoggerService.write(err, "hightex:report-error");
          throw err;
        }
      },
    );

    ipcMain.handle("dialog:select-folder", async () => {
      const result = await dialog.showOpenDialog({
        title: "Select default export folder",
        properties: ["openDirectory"],
      });

      if (result.canceled || !result.filePaths?.length) {
        return undefined;
      }

      return result.filePaths[0];
    });

    ipcMain.handle("hightex:profile", () => {
      return DocumentProfileService.get();
    });

    ipcMain.handle("hightex:document:pull", (_, up?: string) => {
      return ServerService.request(
        "/document/content".concat(up ? `?updated_at=${up}` : ""),
      );
    });

    ipcMain.handle(
      "hightex:export",
      async (
        _event,
        bytes: Uint8Array,
        suggestedName: string,
        options: { showDialog?: boolean; defaultFolder?: string } = {},
      ) => {
        const showDialogOption = options.showDialog ?? false;
        const defaultFolder = options.defaultFolder || app.getPath("downloads");
        const targetName = suggestedName;

        if (showDialogOption) {
          const result = await dialog.showSaveDialog({
            title: "Export HighTex package",
            defaultPath: path.join(defaultFolder, targetName),
            filters: [{ name: "HighTex Archive", extensions: ["hightex"] }],
          });

          if (result.canceled || !result.filePath) {
            return { canceled: true };
          }

          try {
            await fs.promises.writeFile(result.filePath, Buffer.from(bytes));
            return { canceled: false, filePath: result.filePath };
          } catch (err) {
            LoggerService.write(err, "hightex:export");
            throw err;
          }
        }

        try {
          const filePath = path.join(defaultFolder, targetName);
          await fs.promises.writeFile(filePath, Buffer.from(bytes));
          return { canceled: false, filePath };
        } catch (err) {
          LoggerService.write(err, "hightex:export");
          throw err;
        }
      },
    );

    ipcMain.handle("hightex:category", (_, id) => {
      return CategoryService.get(id);
    });
  }
}
