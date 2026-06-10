import { PDFService } from "../service/pdf-service";
import { SharingServer } from "../server/sharing-server";
import { ipcMain } from "electron";
let activeServer: SharingServer | null = null;

export class SharingHandler {
  static register() {
    ipcMain.handle(
      "sharing:start",
      async (_e, { images, snapshot, type, document }: SharingPayload) => {
        if (!activeServer) {
         

          activeServer = new SharingServer(type, images, snapshot, document);
        }
        await activeServer.start();
        return {
          host: activeServer.lanUrl,
          port: String(activeServer.port),
          guest: activeServer.invitationCodes,
          type: activeServer.type,
        } satisfies Omit<SharingInformation, "document">;
      },
    );

    ipcMain.handle("sharing:info", () => {
      if (!activeServer) return undefined;

      return {
        document: activeServer.doc,
        host: activeServer.lanUrl,
        port: String(activeServer.port),
        guest: activeServer.invitationCodes,
        type: activeServer.type,
      } satisfies SharingInformation;
    });

    ipcMain.handle("sharing:stop", async () => {
      await activeServer?.stop();
      activeServer = null;
    });

    ipcMain.handle("sharing:html", async (_, docId: string) => {
      return await new PDFService().generateHtml(docId);
    });
    ipcMain.handle("sharing:getSnapshot",()=>{
      return activeServer?.getSnapshot()
    })
  }
}
