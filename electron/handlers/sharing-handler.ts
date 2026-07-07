import { PDFService } from "../service/pdf-service";
import { SharingServer } from "../server/sharing-server";
import { NetworkService } from "@main/service/network-service";
import { IPCMain } from "@main/utilities/ipc-main";
let activeServer: SharingServer | null = null;

export class SharingHandler {
  static register() {
    IPCMain.handle(
      "sharing:start",
      async (_e, { images, snapshot, type, document }: SharingPayload) => {
        try {
          if (!activeServer) {
            activeServer = new SharingServer(type, images, snapshot, document);
          }
          await activeServer.start();
          return {
            host: activeServer.lanUrl,
            port: String(activeServer.port),
            hostToken: activeServer.hostToken,
            guest: activeServer.invitationCodes,
            type: activeServer.type,
            publicInvitation: activeServer.publicInvitation,
          } satisfies Omit<SharingInformation, "document">;
        } catch (e) {
          return {
            message: e instanceof Error ? e.message : String(e),
          };
        }
      },
    );

    IPCMain.handle("sharing:info", () => {
      if (!activeServer) return undefined;

      return {
        document: activeServer.doc,
        host: activeServer.lanUrl,
        port: String(activeServer.port),
        hostToken: activeServer.hostToken,
        guest: activeServer.invitationCodes,
        type: activeServer.type,
        publicInvitation: activeServer.publicInvitation,
      } satisfies SharingInformation;
    });

    IPCMain.handle("sharing:stop", async () => {
      await activeServer?.stop();
      activeServer = null;
    });

    IPCMain.handle("sharing:html", async (_, docId: string) => {
      return await new PDFService().generateHtml(docId);
    });
    IPCMain.handle("sharing:getSnapshot", () => {
      return activeServer?.getSnapshot();
    });

    IPCMain.handle("sharing:wifi", async () => {
      return await NetworkService.scan();
    });
    IPCMain.handle("sharing:wifi.current", async () => {
      return await NetworkService.getCurrent();
    });
    IPCMain.handle(
      "sharing:wifi.connect",
      async (_, ssid: string, pass: string = "") => {
        return await NetworkService.ensureConnection(ssid, pass);
      },
    );
  }
}
