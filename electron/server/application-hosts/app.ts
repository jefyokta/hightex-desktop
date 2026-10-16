import { Application } from "@main/main/application";
import { Router } from "./contract";
import path from "path";
import fs from "fs";
import { net } from "electron";
import { pathToFileURL } from "url";
export class AppHost extends Router {
  async handle(url: URL): Promise<Response> {
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "" || pathname === "/") {
      pathname = "/index.html";
    }

    const filePath = path.normalize(
      path.join(Application.instance.rendererDist, pathname),
    );
    const distRoot =
      path.normalize(Application.instance.rendererDist) + path.sep;

    if (!filePath.startsWith(distRoot)) {
      return new Response("Forbidden", { status: 403 });
    }

    const isExistingFile =
      fs.existsSync(filePath) && fs.statSync(filePath).isFile();

    const targetPath = isExistingFile
      ? filePath
      : path.join(Application.instance.rendererDist, "index.html");

    return net.fetch(pathToFileURL(targetPath).toString());
  }
}
