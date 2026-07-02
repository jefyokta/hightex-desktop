import { protocol, net } from "electron";
import fs from "fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { LoggerService } from "@main/service/logger-service";

export class HightexProtocol {
  static readonly SCHEME = "hightex";
  static readonly HOST = "app";

  private started = false;

  constructor(private readonly dist: string) {}

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
        let pathname = decodeURIComponent(url.pathname);

        if (pathname === "" || pathname === "/") {
          pathname = "/index.html";
        }

        const filePath = path.normalize(path.join(this.dist, pathname));
        const distRoot = path.normalize(this.dist) + path.sep;

        if (!filePath.startsWith(distRoot)) {
          return new Response("Forbidden", { status: 403 });
        }

        const isExistingFile =
          fs.existsSync(filePath) && fs.statSync(filePath).isFile();

        const targetPath = isExistingFile
          ? filePath
          : path.join(this.dist, "index.html");

        return await net.fetch(pathToFileURL(targetPath).toString());
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