import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { ServerUrl } from "../electron/url/server-url";

const fixture = () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const server = new ServerUrl("http://configured.test:9000");
  let response = () =>
    new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  class HttpException extends Error {}
  const modules: Record<string, unknown> = {
    "../url/server-url": {
      ServerUrl: class extends ServerUrl {
        static get instance() {
          return server;
        }
      },
    },
    "./logger-service": { LoggerService: { write() {} } },
    "./session-service": {
      SessionService: { getToken: () => "fixture-token" },
    },
    path,
    electron: { app: { getPath: () => "/tmp" } },
    "@main/exception/http/http-exception": { HttpException },
    "@main/exception/http/factory": {
      HttpExceptionFactory: { create: (error: unknown) => error },
    },
  };
  const load = <T>(file: string) => {
    const sandbox = {
      exports: {} as T,
      require: (name: string) => modules[name],
      Headers,
      FormData,
      AbortSignal,
      Uint8Array,
      console: { log() {} },
      fetch: async (url: URL, options: RequestInit) => {
        calls.push({ url: url.href, options });
        return response();
      },
    };
    vm.runInNewContext(
      ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      }).outputText,
      sandbox,
    );
    return sandbox.exports;
  };
  return {
    calls,
    server: load<typeof import("../electron/service/server-service")>(
      "../electron/service/server-service.ts",
    ).ServerService,
    account: load<typeof import("../electron/service/account-transport")>(
      "../electron/service/account-transport.ts",
    ).accountRequest,
    respond: (next: typeof response) => {
      response = next;
    },
  };
};

test("legacy and document-sync requests resolve through the configured ServerUrl", async () => {
  const f = fixture();
  await f.server.request("/categories");
  await f.server.documentSyncRequest("/v2/documents/current?include=author");
  expect(f.calls.map((call) => call.url)).toEqual([
    "http://configured.test:9000/api/categories",
    "http://configured.test:9000/api/v2/documents/current?include=author",
  ]);
  for (const call of f.calls)
    expect(new Headers(call.options.headers).get("Authorization")).toBe(
      "Bearer fixture-token",
    );
});

test("account transport uses its captured server and preserves authentication options", async () => {
  const f = fixture();
  await f.account("https://captured.test/api/", "/auth/desktop/exchange", {
    method: "POST",
    headers: { Authorization: "Bearer captured-token" },
    body: JSON.stringify({ code: "fixture-code" }),
  });
  expect(f.calls[0].url).toBe(
    "https://captured.test/api/auth/desktop/exchange",
  );
  expect(f.calls[0].options.redirect).toBe("error");
  expect(new Headers(f.calls[0].options.headers).get("Authorization")).toBe(
    "Bearer captured-token",
  );
  await expect(
    f.account("https://captured.test", "https://other.test/api/login"),
  ).rejects.toThrow();
  expect(f.calls).toHaveLength(1);
});

test("document-sync multipart uploads and binary downloads keep their transport behavior", async () => {
  const f = fixture();
  const body = new FormData();
  body.set("file", new Blob(["fixture"]));
  await f.server.documentSyncRequest("/v2/documents/push", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-hightex" },
  });
  expect(f.calls[0].options.body).toBe(body);
  expect(new Headers(f.calls[0].options.headers).has("Content-Type")).toBe(
    false,
  );
  f.respond(
    () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "application/x-hightex" },
      }),
  );
  const downloaded = await f.server.documentSyncRequest<Uint8Array>(
    "/v2/documents/current/download",
  );
  expect(Array.from(downloaded.data)).toEqual([1, 2, 3]);
  expect(f.calls[1].url).toBe(
    "http://configured.test:9000/api/v2/documents/current/download",
  );
});
