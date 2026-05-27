import { ipcMain } from "electron";
import {
  buildZoteroItemBibtexUrl,
  buildZoteroItemListUrl,
  buildZoteroTestUrl,
  parseZoteroItems,
} from "../service/zotero-service";

export class ZoteroHandler {
  static register() {
    ipcMain.handle(
      "zotero:test",
      async (_event, host: string, port: number) => {
        const url = buildZoteroTestUrl(host, port);
        try {
          const response = await fetch(url, { method: "GET" });
          if (!response.ok) {
            return {
              connected: false,
              message: `Zotero returned ${response.status} ${response.statusText}`,
              host,
              port,
            };
          }

          await response.json();

          return {
            connected: true,
            message: "Connected to Zotero local API.",
            host,
            port,
          };
        } catch (error) {
          return {
            connected: false,
            message:
              "Zotero connection failed. Please ensure Zotero Desktop is running and local API access is enabled in Settings.",
            host,
            port,
          };
        }
      },
    );

    ipcMain.handle(
      "zotero:list",
      async (_event, host: string, port: number, limit = 100) => {
        try {
          const url = buildZoteroItemListUrl(host, port, limit);
          const response = await fetch(url, { method: "GET" });
          if (!response.ok) {
            throw new Error(
              `Zotero returned ${response.status} ${response.statusText}`,
            );
          }

          const result = await response.json();
          return parseZoteroItems(result);
        } catch (error) {
          throw error instanceof Error
            ? error
            : new Error("Unable to load Zotero items.");
        }
      },
    );

    ipcMain.handle(
      "zotero:exportBibtex",
      async (_event, host: string, port: number, itemKey: string) => {
        try {
          const url = buildZoteroItemBibtexUrl(host, port, itemKey);
          const response = await fetch(url, { method: "GET" });
          if (!response.ok) {
            throw new Error(
              `Zotero returned ${response.status} ${response.statusText}`,
            );
          }

          return response.text();
        } catch (error) {
          throw error instanceof Error
            ? error
            : new Error("Unable to export Zotero item as BibTeX.");
        }
      },
    );
  }
}
