import { protocol } from "electron";
import { LoggerService } from "@main/service/logger-service";
import { Controller } from "./application-hosts/controller";

export class HightexProtocol {
  static readonly SCHEME = "hightex";
  static readonly HOST = "app";

  private started = false;

  static registerSchemesAsPrivileged() {
    protocol.registerSchemesAsPrivileged([
      {
        scheme: HightexProtocol.SCHEME,
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: true,
        },
      },
    ]);
  }

  public get url() {
    return `${HightexProtocol.SCHEME}://${HightexProtocol.HOST}`;
  }

  public start() {
    if (this.started) {
      return;
    }

    this.started = true;

    protocol.handle(HightexProtocol.SCHEME, async (req) => {
      try {
        const url = new URL(req.url);
        return await Controller.handle(url);
      } catch (error) {
        LoggerService.write(error, "hightex-protocol");
        return new Response("Internal Server Error", { status: 500 });
      }
    });
  }

  public stop() {
    if (!this.started) {
      return;
    }

    protocol.unhandle(HightexProtocol.SCHEME);
    this.started = false;
  }
}
