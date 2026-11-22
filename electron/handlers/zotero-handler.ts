import { IPCMain } from "@main/utilities/ipc-main";
import { ZoteroService } from "../service/zotero-service";

export class ZoteroHandler {
  static register() {
    IPCMain.handle("zotero:search", (_event, host: string, port: number, query: string) =>
      new ZoteroService(host, port).searchItems(query),
    );
    IPCMain.handle("zotero:test", (_event, host: string, port: number) =>
      new ZoteroService(host, port).testConnection(),
    );
    IPCMain.handle("zotero:list", (_event, host: string, port: number, limit = 100) =>
      new ZoteroService(host, port).listItems(limit),
    );
    IPCMain.handle("zotero:exportBibtex", (_event, host: string, port: number, itemKey: string) =>
      new ZoteroService(host, port).exportBibtex(itemKey),
    );
  }
}
