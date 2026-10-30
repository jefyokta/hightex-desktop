import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import * as importer from "@hightex/importer";
import { zipSync, strToU8 } from "fflate";

function loadSource<T>(
  file: string,
  modules: Record<string, unknown>,
  extra = {},
): T {
  const sandbox = {
    exports: {} as T,
    require: (name: string) => modules[name],
    URL,
    Response,
    Uint8Array,
    File,
    AbortSignal,
    queueMicrotask,
    ...extra,
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(new URL(file, import.meta.url), "utf8").replace(
        /import\.meta\.url/g,
        JSON.stringify(new URL(file, import.meta.url).href),
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      },
    ).outputText,
    sandbox,
  );
  return sandbox.exports;
}

const archive = zipSync({
  "manifest.json": strToU8(
    JSON.stringify({
      schema_version: 2,
      format: "json",
      document: {
        id: "linked-document",
        title: { id: "Linked document", en: "" },
      },
    }),
  ),
});

function routerFixture(
  request: (url: URL) => Promise<Response> = async () => new Response(archive),
) {
  const files = new Map<string, Uint8Array>();
  const opened: string[] = [];
  const requested: string[] = [];
  const { Router } = loadSource<
    typeof import("../electron/server/application-hosts/contract")
  >("../electron/server/application-hosts/contract.ts", {});
  const application = {
    openDocumentFile: async (file: string) => {
      opened.push(file);
    },
  };
  const { DocumentRouter } = loadSource<
    typeof import("../electron/server/application-hosts/document")
  >(
    "../electron/server/application-hosts/document.ts",
    {
      electron: { app: { getPath: () => "/user-data" } },
      "node:crypto": { randomUUID: () => "download-id" },
      "node:fs/promises": {
        mkdir: async () => {},
        writeFile: async (file: string, bytes: Uint8Array) => {
          files.set(file, bytes);
        },
        rm: async (file: string) => {
          files.delete(file);
        },
      },
      "node:path": path,
      "@hightex/importer": importer,
      "@main/main/application": { Application: { instance: application } },
      "@main/service/logger-service": { LoggerService: { write: () => {} } },
      "./contract": { Router },
    },
    {
      fetch: async (url: URL) => {
        requested.push(url.href);
        return request(url);
      },
    },
  );
  return {
    router: new DocumentRouter(),
    files,
    opened,
    requested,
    application,
  };
}

const deepLink = (source: string) =>
  new URL(`hightex://document?url=${encodeURIComponent(source)}`);

test("document deep link preserves signed query parameters, validates and saves before opening", async () => {
  const f = routerFixture();
  const source = "https://example.com/doc.hightex?token=a%2Bb%3Dc&version=2";
  const response = await f.router.handle(deepLink(source));
  expect(response.status).toBe(202);
  expect(f.requested).toEqual([source]);
  expect(f.opened).toEqual([
    "/user-data/imported-documents/download-id.hightex",
  ]);
  expect(importer.parseHighTexV2(f.files.get(f.opened[0])!).document.id).toBe(
    "linked-document",
  );
});

test("document URLs without a scheme use HTTPS", async () => {
  const f = routerFixture();
  expect(
    (await f.router.handle(deepLink("example.com/doc.hightex"))).status,
  ).toBe(202);
  expect(f.requested).toEqual(["https://example.com/doc.hightex"]);
});

test.each([
  "",
  "file:///tmp/doc.hightex",
  "javascript:alert(1)",
  "ftp://example.com/doc.hightex",
  "https://user:secret@example.com/doc.hightex",
  "https://",
])("invalid document URL %s cannot download or open a file", async (source) => {
  const f = routerFixture();
  expect((await f.router.handle(deepLink(source))).status).toBe(400);
  expect(f.requested).toEqual([]);
  expect(f.opened).toEqual([]);
});

test("unknown document paths do not download", async () => {
  const f = routerFixture();
  expect(
    (
      await f.router.handle(
        new URL("hightex://document/unknown?url=example.com"),
      )
    ).status,
  ).toBe(404);
  expect(f.requested).toEqual([]);
});

test("failed downloads and invalid archives never persist or open", async () => {
  for (const [request, status] of [
    [async () => new Response("Not found", { status: 404 }), 502],
    [
      async () => {
        throw new Error("Network unavailable");
      },
      502,
    ],
    [async () => new Response("<html>Login required</html>"), 422],
  ] as const) {
    const f = routerFixture(request);
    expect(
      (await f.router.handle(deepLink("https://example.com/doc.hightex")))
        .status,
    ).toBe(status);
    expect(f.files.size).toBe(0);
    expect(f.opened).toEqual([]);
  }
});

test("oversized downloads are stopped even without content-length", async () => {
  for (const headers of [
    undefined,
    {
      "content-length": String(
        importer.DEFAULT_IMPORT_LIMITS.maxArchiveBytes + 1,
      ),
    },
  ]) {
    let cancelled = false;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new Uint8Array(importer.DEFAULT_IMPORT_LIMITS.maxArchiveBytes + 1),
        );
      },
      cancel() {
        cancelled = true;
      },
    });
    const f = routerFixture(async () => new Response(body, { headers }));
    expect(
      (await f.router.handle(deepLink("https://example.com/doc.hightex")))
        .status,
    ).toBe(502);
    expect(cancelled).toBe(true);
    expect(f.files.size).toBe(0);
  }
});

test("failure to open removes the downloaded working file", async () => {
  const f = routerFixture();
  f.application.openDocumentFile = async () => {
    throw new Error("Window closed");
  };
  expect(
    (await f.router.handle(deepLink("https://example.com/doc.hightex"))).status,
  ).toBe(500);
  expect(f.files.size).toBe(0);
});

test("preload buffers a cold-start file until the renderer subscribes, including React remount", async () => {
  const ipc = Object.assign(new EventEmitter(), {
    invoke: async () => undefined,
  });
  const apis: Record<string, unknown> = {};
  loadSource("../electron/preload/index.ts", {
    electron: {
      ipcRenderer: ipc,
      contextBridge: {
        exposeInMainWorld: (name: string, api: unknown) => {
          apis[name] = api;
        },
      },
    },
  });
  const hightex = apis.hightex as Window["hightex"];
  ipc.emit("file:open", {}, "/downloads/startup.hightex");
  const received: string[] = [];
  const off = hightex.onOpenFile((file: string) => {
    received.push(`obsolete:${file}`);
  });
  off();
  const stop = hightex.onOpenFile((file: string) => {
    received.push(file);
  });
  await Promise.resolve();
  expect(received).toEqual(["/downloads/startup.hightex"]);
  ipc.emit("file:open", {}, "/downloads/running.hightex");
  expect(received).toHaveLength(2);
  stop();
  ipc.emit("file:open", {}, "/downloads/remount.hightex");
  hightex.onOpenFile((file: string) => {
    received.push(file);
  });
  await Promise.resolve();
  expect(received).toEqual([
    "/downloads/startup.hightex",
    "/downloads/running.hightex",
    "/downloads/remount.hightex",
  ]);
});

test("second-instance deep links wait for core services, even after Electron is ready", async () => {
  const handled: string[] = [];
  const { FileOpenManager } = loadSource<
    typeof import("../electron/service/file-open-service")
  >(
    "../electron/service/file-open-service.ts",
    {
      "./deep-link-service": {
        DeepLinkService: class {
          constructor(private url: string) {}
          static isDeepLink(args: string[]) {
            const url = args.find((arg) => arg.startsWith("hightex://"));
            return url ? new this(url) : undefined;
          }
          toString() {
            return this.url;
          }
          async handle() {
            handled.push(this.url);
          }
        },
      },
    },
    { process: { argv: [] } },
  );
  const app = Object.assign(new EventEmitter(), {
    requestSingleInstanceLock: () => true,
    isReady: () => true,
  });
  const manager = new FileOpenManager(() => {});
  manager.bootstrap(app as unknown as Electron.App);
  app.emit("second-instance", {}, [
    "hightex://document?url=example.com/doc.hightex",
  ]);
  expect(handled).toEqual([]);
  manager.flush();
  expect(handled).toHaveLength(1);
  app.emit("second-instance", {}, [
    "hightex://document?url=example.com/other.hightex",
  ]);
  expect(handled).toHaveLength(2);
});

test.each(["overwrite", "copy", null] as const)(
  "renderer awaits import choice (%s) before importing and opening",
  async (mode) => {
    let receive!: (path: string) => Promise<void>;
    let decide!: (mode: "overwrite" | "copy" | null) => void;
    const confirmation = new Promise<"overwrite" | "copy" | null>((resolve) => {
      decide = resolve;
    });
    const imported: string[] = [];
    const opened: string[] = [];
    const { OpenFileSlave } = loadSource<
      typeof import("../src/slaves/open-file")
    >(
      "../src/slaves/open-file.tsx",
      {
        react: { useEffect: (setup: () => void) => setup() },
        "@/utils/import-v2": {
          HighTexImporter: {
            create: async () => ({
              exists: true,
              import: async (selectedMode: string) => {
                imported.push(selectedMode);
                return selectedMode === "copy"
                  ? { id: "copy", file: undefined }
                  : { id: "doc", file: "/doc.hightex" };
              },
            }),
          },
        },
        "@/utils/import-conflict": { resolveImportMode: () => confirmation },
        "@/utils/lang": { t: (key: string) => key },
        sonner: {
          toast: { loading: () => "toast", error: () => {}, dismiss: () => {} },
        },
      },
      {
        window: {
          hightex: {
            onOpenFile: (cb: typeof receive) => {
              receive = cb;
              return () => {};
            },
            readFile: async () => archive,
          },
          editor: {
            open: async (id: string) => {
              opened.push(id);
            },
          },
        },
      },
    );
    OpenFileSlave();
    const pending = receive("/doc.hightex");
    await Promise.resolve();
    expect(imported).toEqual([]);
    decide(mode);
    await pending;
    expect(imported).toEqual(mode ? [mode] : []);
    expect(opened).toEqual(mode ? [mode === "copy" ? "copy" : "doc"] : []);
  },
);

test("a startup document deep link is never also treated as a local .hightex path", () => {
  const link = "hightex://document?url=https%3A%2F%2Fexample.com%2Fdoc.hightex";
  const opened: string[] = [];
  let handled = 0;
  const { FileOpenManager } = loadSource<
    typeof import("../electron/service/file-open-service")
  >(
    "../electron/service/file-open-service.ts",
    {
      "./deep-link-service": {
        DeepLinkService: {
          isDeepLink: () => ({
            handle: async () => {
              handled++;
            },
          }),
        },
      },
    },
    { process: { argv: ["hightex", link] } },
  );
  const manager = new FileOpenManager((file) => {
    opened.push(file);
  });
  manager.flush();
  expect(handled).toBe(1);
  expect(opened).toEqual([]);
});

test("opening documents recreates a closed main window once and waits for its preload", async () => {
  const { Application } = loadSource<
    typeof import("../electron/main/application")
  >("../electron/main/application.ts", {
    "node:path": path,
    "node:url": { fileURLToPath },
  });
  const calls: string[] = [];
  const window = {
    isDestroyed: () => false,
    isMinimized: () => true,
    restore: () => {
      calls.push("restore");
    },
    show: () => {
      calls.push("show");
    },
    focus: () => {
      calls.push("focus");
    },
    webContents: {
      send: (channel: string, file: string) => {
        calls.push(`${channel}:${file}`);
      },
    },
  };
  const application = new Application();
  const state = application as unknown as {
    win: typeof window | null;
    createWindow: () => Promise<void>;
  };
  let loaded!: () => void;
  let created = 0;
  state.createWindow = async () => {
    created++;
    state.win = window;
    await new Promise<void>((resolve) => {
      loaded = resolve;
    });
  };
  const first = application.openDocumentFile("/first.hightex");
  const second = application.openDocumentFile("/second.hightex");
  expect(created).toBe(1);
  expect(calls).toEqual([]);
  loaded();
  await Promise.all([first, second]);
  expect(calls.filter((call) => call.startsWith("file:open:"))).toEqual([
    "file:open:/first.hightex",
    "file:open:/second.hightex",
  ]);
  expect(calls.filter((call) => call === "restore")).toHaveLength(2);
});
