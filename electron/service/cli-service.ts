import { app, BrowserWindow, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { PDFService } from "./pdf-service";
import type { IpcMainEvent } from "electron";

type CliDocument = {
  id: string;
  title: string;
  updatedAt?: Date | string;
};

export class CLIService {
  constructor(
    private readonly args: string[],
    private window: BrowserWindow | null,
  ) {}

  async handle() {
    const [command, ...args] = this.args;

    switch (command) {
      case "compile":
        await this.compile(args);
        break;

      case "document":
      case "documents":
      case "docs":
        await this.documents();
        break;

      case "version":
      case "-v":
      case "--version":
        console.log(app.getVersion());
        break;

      default:
        return;
    }
  }

   get unstrippedArgs(){
    return this.args.filter(s=>!s.startsWith("--"))
  }

   get strippedArgs(){
    return this.args.filter(s=>s.startsWith("--"))
  }

  private async documents() {
    const documents = await this.getDocuments();

    if (documents.length === 0) {
      console.log("No documents available.");
      return;
    }

    for (const document of documents) {
      const title = document.title || "Untitled";
      console.log(`${document.id}\t${title}`);
    }
  }

  private async compile([id, saveTo]: string[]) {
    if (!id) {
      console.error("Missing Document Id");
      process.exitCode = 1;
      return;
    }

    const documents = await this.getDocuments();
    const document = documents.find((item) => item.id === id);

    if (!document) {
      console.error(`Document not found: ${id}`);
      process.exitCode = 1;

      if (documents.length > 0) {
        console.error("Available documents:");
        for (const item of documents) {
          console.error(`- ${item.id}\t${item.title || "Untitled"}`);
        }
      }

      return;
    }

    const pdf = new PDFService();

    const buffer = await pdf.generate(id, (message, percent) => {
      console.log(`${percent}% ${message}`);
    });

    const output = saveTo ?? join(app.getPath("downloads"), `${id}.pdf`);

    writeFileSync(output, buffer);

    console.log(`Saved to ${output}`);
  }

  private async getDocuments(): Promise<CliDocument[]> {
    if (!this.window || this.window.isDestroyed()) {
      throw new Error("CLI document commands require a renderer window.");
    }

    const requestId = randomUUID();
    const responseChannel = `cli:documents:response:${requestId}`;

    return await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        ipcMain.removeListener(responseChannel, handleResponse);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out while reading documents from renderer."));
      }, 15000);

      const handleResponse = (_event: IpcMainEvent, payload: unknown) => {
        cleanup();
        const result = payload as
          | { documents?: CliDocument[]; error?: string }
          | undefined;

        if (result?.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(Array.isArray(result?.documents) ? result.documents : []);
      };

      ipcMain.once(responseChannel, handleResponse);

      this.window!.webContents.send("cli:documents:request", requestId);
    });
  }
}
