import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import mime from "mime-types";

export class LocalServer {
  private server: http.Server;

  public port = 0;

  constructor(
    private readonly dist: string,
  ) {
    this.server = http.createServer(
      async (req, res) => {
        const url = new URL(
          req.url || "/",
          "http://127.0.0.1",
        );

        let pathname = decodeURIComponent(
          url.pathname,
        );

        if (pathname === "/") {
          pathname = "/index.html";
        }

        const filePath = path.join(
          this.dist,
          pathname,
        );

        if (fs.existsSync(filePath)) {
          res.setHeader(
            "Content-Type",
            mime.lookup(filePath) ||
              "application/octet-stream",
          );

          fs.createReadStream(filePath).pipe(
            res,
          );

          return;
        }

        res.setHeader(
          "Content-Type",
          "text/html",
        );

        fs.createReadStream(
          path.join(this.dist, "index.html"),
        ).pipe(res);
      },
    );
  }

  public async start() {
    return new Promise<void>((resolve) => {
      this.server.listen(0, "127.0.0.1", () => {
        const address = this.server.address();

        if (
          address &&
          typeof address !== "string"
        ) {
          this.port = address.port;
        }

        resolve();
      });
    });
  }

  public get url() {
    return `http://127.0.0.1:${this.port}`;
  }
}