import fs from "fs";
import http from "node:http";
import path from "node:path";
import mime from "mime-types";
/**
 * @deprecated
 */
export class LocalServer {
  private server: http.Server | null = null;

  private _port = 0;

  constructor(private readonly dist: string) {}

  public get port() {
    if (!this._port) {
      throw new Error("Local server has not started yet");
    }

    return this._port;
  }

  public get url() {
    return `http://127.0.0.1:${this.port}`;
  }

  public async start() {
    if (this.server) {
      return;
    }

    this.server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || "/", "http://127.0.0.1");

        let pathname = decodeURIComponent(url.pathname);

        if (pathname === "/") {
          pathname = "/index.html";
        }

        const filePath = path.join(this.dist, pathname);

        const isExistingFile =
          fs.existsSync(filePath) && fs.statSync(filePath).isFile();

        if (isExistingFile) {
          const mimeType = mime.lookup(filePath) || "application/octet-stream";

          res.setHeader("Content-Type", mimeType);

          fs.createReadStream(filePath).pipe(res);

          return;
        }

        res.setHeader("Content-Type", "text/html");

        fs.createReadStream(path.join(this.dist, "index.html")).pipe(res);
      } catch (error) {
        console.error(error);

        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(55432, "127.0.0.1", () => {
        const address = this.server!.address();

        if (address && typeof address !== "string") {
          this._port = address.port;
        }

        // console.log("[local-server]", this.url);

        resolve();
      });
    });
  }

  public async stop() {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server!.close(() => resolve());
    });

    this.server = null;
    this._port = 0;
  }
}
