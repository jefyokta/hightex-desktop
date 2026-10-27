import fs, { writeFileSync } from "fs";
import path from "path";
import { app, dialog } from "electron";
import Store from "electron-store";
import { ServerService } from "../service/server-service";
import { LoggerService } from "../service/logger-service";
import { DocumentProfileService } from "../service/document-profile-service";
import { PDFService } from "../service/pdf-service";
import { CategoryService } from "../service/category-service";
import { IPCMain } from "@main/utilities/ipc-main";
import { ShouldSilent } from "@main/exception/should-silent";
import { ExportTimeout } from "@main/exception/export-timeout";
import { ConfigService } from "@main/service/config-service";
import {
  documentService,
  cloudAcademicService,
} from "@main/service/document-service";
import { submissionService } from "@main/service/submission-service";
import { submissionWorkflow } from "@main/service/submission-workflow-service";
import { advisorService } from "@main/service/advisor-service";
import { SnapshotPDFService } from "@main/service/snapshot-pdf-service";

export class HighTexHandler {
  private static store = new Store();

  static register() {
    IPCMain.handle("hightex:snapshot:pdf", (_, input: SnapshotPDFInput) =>
      new SnapshotPDFService().export(input),
    );
    IPCMain.handle("hightex:submission:context", () =>
      submissionService.context(),
    );
    IPCMain.handle("hightex:submission:list", () => submissionService.list());
    IPCMain.handle(
      "hightex:submission:recipients",
      (_, input: { sessionId: string }) => submissionService.recipients(input),
    );
    IPCMain.handle("hightex:advisor:directory", () =>
      advisorService.directory(),
    );
    IPCMain.handle(
      "hightex:advisor:history",
      (
        _,
        input: { sessionId: string; studentId: string; documentId: string },
      ) => advisorService.history(input),
    );
    IPCMain.handle("hightex:advisor:state", (_, input: AdvisorReviewInput) =>
      advisorService.state(input),
    );
    IPCMain.handle("hightex:advisor:action", (_, input: AdvisorActionInput) =>
      advisorService.action(input),
    );
    IPCMain.handle(
      "hightex:submission:history",
      (_, input: { sessionId: string; documentId: string }) =>
        submissionService.history(input),
    );
    IPCMain.handle(
      "hightex:submission:detail",
      (
        _,
        input: { sessionId: string; documentId: string; submissionId: string },
      ) => submissionService.detail(input),
    );
    IPCMain.handle("hightex:submission:pending", (_, sessionId: string) =>
      submissionWorkflow.pending(sessionId),
    );
    IPCMain.handle(
      "hightex:submission:prepare",
      (_, input: SubmissionPrepareInput) => submissionWorkflow.prepare(input),
    );
    IPCMain.handle("hightex:submission:submit", (_, sessionId: string) =>
      submissionWorkflow.submit(sessionId),
    );
    IPCMain.handle("hightex:submission:reconcile", (_, sessionId: string) =>
      submissionWorkflow.reconcile(sessionId),
    );
    IPCMain.handle("hightex:submission:discard", (_, sessionId: string) =>
      submissionWorkflow.discard(sessionId),
    );
    IPCMain.handle(
      "hightex:submission:file",
      (
        _,
        input: { sessionId: string; submissionId: string; documentId: string },
      ) => submissionService.file(input),
    );
    IPCMain.handle("hightex:document", async () => {
      try {
        return await ServerService.request("/document");
      } catch (err) {
        LoggerService.write(err, "hightex:document");
        return false;
      }
    });

    IPCMain.handle("hightex:readFile", async (_ev, filePath: string) => {
      return await fs.promises.readFile(filePath);
    });
    IPCMain.handle(
      "hightex:pdf:silent",
      async (_event, id: string, wm = false) => {
        if (!id) {
          throw new ShouldSilent("Document id is required for PDF export.");
        }
        try {
          const pdf = new PDFService(wm);
          const result = await pdf.generateSilently(id);
          return result;
        } catch (error) {
          LoggerService.write(error, "hightex:pdf");
          throw error instanceof Error
            ? new ShouldSilent(error.message)
            : new ShouldSilent("Unable to export PDF.");
        }
      },
    );
    IPCMain.handle("file:save", (_, fileName: string, file: Uint8Array) => {
      const filePath = path.join(
        ConfigService.get().export.saveFolder,
        fileName,
      );
      writeFileSync(filePath, file);
      return filePath;
    });
    IPCMain.handle(
      "hightex:pdf",
      async (event, id: string, wm = false, requestId?: string) => {
        if (!id) {
          throw new Error("Document id is required for PDF export.");
        }

        const progress = (status: string, value?: number) => {
          event.sender.send("hightex:pdf:progress", {
            status,
            progress: value,
            requestId,
          });
        };

        try {
          progress("Opening print view...", 5);
          const pdf = new PDFService(wm);
          const result = await pdf.exportPDF(id, progress);
          progress(
            result === null ? "Export canceled" : "Export complete",
            result === null ? 0 : 100,
          );
          return result;
        } catch (error) {
          LoggerService.write(error, "hightex:pdf");
          progress("PDF export failed", 0);
          if (error instanceof ExportTimeout) {
            throw new Error(`${error.message}\nRender log: ${error.logFile}`);
          }
          throw error instanceof Error
            ? new Error(error.message)
            : new Error("Unable to export PDF.");
        }
      },
    );

    IPCMain.handle("hightex:prefetch", async (event) => {
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

    IPCMain.handle("hightex:categories", async () => {
      return await CategoryService.getAll();
    });

    IPCMain.handle("hightex:version", () => {
      return app.getVersion();
    });

    IPCMain.handle(
      "hightex:report-error",
      async (_event, payload: { title: string; description: string }) => {
        try {
          const description = `
  ## Description

  ${payload.description}

  ## Environment

  | Property | Value |
  | --- | --- |
  | HighTex Version | ${app.getVersion()} |
  | Platform | ${process.platform} |
  | Architecture | ${process.arch} |
  | Electron | ${process.versions.electron} |
  | Chrome | ${process.versions.chrome} |
  | Node.js | ${process.versions.node} |
  `;

          return await ServerService.request("/issues", {
            method: "POST",
            body: JSON.stringify({
              // API limits include the desktop suffix and environment details.
              title: [
                ...`${payload.title.trim()} - HighTex Desktop ${app.getVersion()}`,
              ]
                .slice(0, 100)
                .join(""),
              description: [...description].slice(0, 65535).join(""),
            }),
          });
        } catch (err) {
          LoggerService.write(err, "hightex:report-error");
          throw err;
        }
      },
    );
    IPCMain.handle("dialog:select-folder", async () => {
      const result = await dialog.showOpenDialog({
        title: "Select default export folder",
        properties: ["openDirectory"],
      });

      if (result.canceled || !result.filePaths?.length) {
        return undefined;
      }

      return result.filePaths[0];
    });

    IPCMain.handle("hightex:profile", () => {
      return DocumentProfileService.get();
    });

    IPCMain.handle("hightex:document:context", () => documentService.context());
    IPCMain.handle("hightex:academic:locked", (_, id: string) =>
      documentService.academicLocked(id),
    );
    IPCMain.handle(
      "hightex:academic:load",
      (_, input: { sessionId: string; serverDocumentId: string | null }) =>
        cloudAcademicService.load(input),
    );
    IPCMain.handle("hightex:document:pull", (_, input) =>
      documentService.pull(input),
    );
    IPCMain.handle("hightex:document:push", (_, input: CloudPushInput) =>
      documentService.push(input),
    );
    IPCMain.handle("hightex:document:commits", (_, sessionId: string) =>
      documentService.list(sessionId),
    );
    IPCMain.handle(
      "hightex:document:binding",
      (_, sessionId: string, localId: string) =>
        documentService.binding(sessionId, localId),
    );
    IPCMain.handle("hightex:document:accept", (_, input) =>
      documentService.accept(input),
    );
    IPCMain.handle(
      "hightex:document:backup",
      (_, sessionId: string, file: Uint8Array) =>
        documentService.backup(sessionId, file),
    );
    IPCMain.handle(
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

    IPCMain.handle("hightex:category", (_, id) => {
      return CategoryService.get(id);
    });
  }
}
