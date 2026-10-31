import { app } from "electron";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_IMPORT_LIMITS, parseHighTexV2 } from "@hightex/importer";
import { Application } from "@main/main/application";
import { LoggerService } from "@main/service/logger-service";
import { Router } from "./contract";
import { ServerUrl } from "@main/url/server-url";
import { SessionService } from "@main/service/session-service";

export class DocumentRouter extends Router {
  async handle(url: URL): Promise<Response> {
    if (url.pathname !== "" && url.pathname !== "/") return this.notFound();

    let source: URL;
    try {
      const value = url.searchParams.get("url")?.trim();
      if (!value) throw new Error("Missing URL");
      source = new URL(
        /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`,
      );
      if (
        !["https:", "http:"].includes(source.protocol) ||
        source.username ||
        source.password
      ) {
        throw new Error("Invalid URL");
      }
    } catch {
      return new Response("Provide a valid HTTP or HTTPS document URL.", {
        status: 400,
      });
    }

    let bytes: Uint8Array;
    try {
      const headers = new Headers();
      const server = ServerUrl.instance;

      if (server.compare(source)) {
        const token = SessionService.getToken();
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetch(source, {
        signal: AbortSignal.timeout(60000),
        headers

      });
      if (!response.ok || !response.body) {
        throw new Error(`Download failed (HTTP ${response.status}).`);
      }
      const limit = DEFAULT_IMPORT_LIMITS.maxArchiveBytes;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        if (Number(response.headers.get("content-length")) > limit) {
          throw new Error("Document download is too large.");
        }
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > limit)
            throw new Error("Document download is too large.");
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
    } catch (error) {
      LoggerService.write(error, "document:download");
      return new Response("Could not download the HighTex document.", {
        status: 502,
      });
    }

    try {
      parseHighTexV2(bytes);
    } catch (error) {
      LoggerService.write(error, "document:validate");
      return new Response(
        "The downloaded file is not a valid HighTex document.",
        {
          status: 422,
        },
      );
    }
    const directory = path.join(app.getPath("userData"), "imported-documents");
    const filePath = path.join(directory, `${randomUUID()}.hightex`);
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(filePath, bytes, { flag: "wx" });
      await Application.instance.openDocumentFile(filePath);
      return new Response("Document queued for import in HighTex.", {
        status: 202,
      });
    } catch (error) {
      await rm(filePath, { force: true }).catch(() => {});
      LoggerService.write(error, "document:open");
      return new Response("Could not open the HighTex document.", {
        status: 500,
      });
    }
  }
}
