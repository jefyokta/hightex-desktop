import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PDFDocument } from "pdf-lib";
import type { Engine } from "../src/compiler/engine";

function loadSource<T>(file: string, modules: Record<string, unknown>): T {
  const sandbox = {
    exports: {} as T,
    require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
      return modules[name];
    },
    setTimeout,
    clearTimeout,
    Date,
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
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function serviceFixture(
  options: {
    timeout?: number;
    canceled?: boolean;
    load?: (win: FakeWindow) => Promise<void>;
    print?: () => Promise<Uint8Array>;
    flush?: () => Promise<void>;
  } = {},
) {
  const ipc = new EventEmitter();
  const windows: FakeWindow[] = [];
  const writes: string[] = [];
  const emptyPdf = await PDFDocument.create().then((pdf) => {
    pdf.addPage();
    return pdf.save();
  });
  class Window extends EventEmitter {
    destroyed = false;
    url = "";
    printed = false;
    webContents = Object.assign(new EventEmitter(), {
      mainFrame: { processId: 1, routingId: windows.length + 1 },
      printToPDF: async () => {
        this.printed = true;
        return options.print ? options.print() : emptyPdf;
      },
    });
    constructor() {
      super();
      windows.push(this);
    }
    async loadURL(url: string) {
      this.url = url;
      if (options.load) return options.load(this);
      publish(this);
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      this.emit("closed");
    }
  }
  function publish(win: FakeWindow, error?: string, sender = win) {
    const url = new URL(win.url);
    const request = url.searchParams.get("printRequest");
    const id = decodeURIComponent(url.pathname.split("/")[2]);
    ipc.emit(
      `page:${error ? "error" : "payload"}:${id}:${request}`,
      {
        sender: sender.webContents,
        senderFrame: sender.webContents.mainFrame,
      },
      error ?? {
        title: "Fixture title",
        author: "Fixture author",
        keywords: ["fixture"],
        chapters: [],
        detail: {},
        hasWm: url.pathname.endsWith("/true"),
      },
    );
  }
  class Timeout extends Error {
    constructor({ timeout }: { timeout: number }) {
      super(`Export timeout ${timeout}ms`);
    }
  }
  const { PDFService } = loadSource<
    typeof import("../electron/service/pdf-service")
  >("../electron/service/pdf-service.ts", {
    "node:fs/promises": {
      mkdir: async () => {},
      writeFile: async (file: string) => {
        writes.push(file);
      },
    },
    "node:path": await import("node:path"),
    "node:crypto": await import("node:crypto"),
    electron: {
      BrowserWindow: Window,
      ipcMain: ipc,
      app: { getPath: () => "/tmp" },
      dialog: {
        showSaveDialog: async () => ({
          canceled: options.canceled ?? false,
          filePath: "/tmp/fixture.pdf",
        }),
      },
    },
    "pdf-lib": { PDFDocument },
    "../main/application": {
      Application: {
        instance: {
          preloadEntry: "",
          resolveRendererUrl: (route: string) =>
            `https://fixture.test/${route}`,
        },
      },
    },
    "./logger-service": { LoggerService: { writeAsync: async () => {} } },
    "./config-service": {
      ConfigService: {
        get: () => ({
          export: {
            exportTimeout: options.timeout ?? 2000,
            saveFolder: "/tmp",
          },
        }),
      },
    },
    "@main/exception/export-timeout": { ExportTimeout: Timeout },
    "../windows/editor-window": {
      EditorWindow: { flush: options.flush ?? (async () => {}) },
    },
  });
  return {
    service: new PDFService(),
    PDFService,
    ipc,
    windows,
    writes,
    publish,
  };
}

type FakeWindow = EventEmitter & {
  url: string;
  printed: boolean;
  destroyed: boolean;
  webContents: EventEmitter & {
    mainFrame: { processId: number; routingId: number };
  };
  destroy(): void;
};

async function until(check: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("Fixture did not reach expected state");
}

test("same-document exports accept only their own request and renderer, preserving unrelated listeners", async () => {
  const f = await serviceFixture({ load: async () => {} });
  const other = () => {};
  f.ipc.on("page:payload:doc", other);
  const a = f.service.generate("doc");
  const b = new f.PDFService(true).generate("doc");
  await until(
    () => f.windows.length === 2 && f.windows.every((win) => Boolean(win.url)),
  );
  const [first, second] = f.windows;
  expect(first.url).not.toBe(second.url);
  f.publish(first, undefined, second);
  await Promise.resolve();
  expect(first.printed).toBe(false);
  expect(second.printed).toBe(false);
  f.publish(first);
  const pdfA = await PDFDocument.load(await a);
  expect(pdfA.getAuthor()).toBe("Fixture author");
  expect(JSON.parse(pdfA.getSubject()!).hasWm).toBe(false);
  expect(second.printed).toBe(false);
  f.publish(second);
  const pdfB = await PDFDocument.load(await b);
  expect(JSON.parse(pdfB.getSubject()!).hasWm).toBe(true);
  expect(f.ipc.eventNames()).toEqual(["page:payload:doc"]);
  expect(
    f.windows.every(
      (win) =>
        win.destroyed && win.webContents.listenerCount("console-message") === 0,
    ),
  ).toBe(true);
});

test("renderer errors reject immediately even when page loading has not completed", async () => {
  const f = await serviceFixture({ load: () => new Promise(() => {}) });
  const generated = f.service.generate("doc");
  await until(() => Boolean(f.windows[0]?.url));
  f.publish(f.windows[0], "Unable to read aliases");
  await expect(generated).rejects.toThrow("Unable to read aliases");
  expect(f.windows[0].destroyed).toBe(true);
  expect(f.ipc.eventNames()).toEqual([]);
});

test("a failed print-view load cleans up its window and request listeners", async () => {
  const f = await serviceFixture({
    load: async () => {
      throw new Error("Navigation failed");
    },
  });
  await expect(f.service.generate("doc")).rejects.toThrow("Navigation failed");
  expect(f.windows[0].destroyed).toBe(true);
  expect(f.ipc.eventNames()).toEqual([]);
});

test("timeout also covers native printing and rejects export instead of returning cancellation", async () => {
  const f = await serviceFixture({
    timeout: 20,
    print: () => new Promise(() => {}),
  });
  await expect(f.service.exportPDF("doc")).rejects.toThrow("Export timeout");
  expect(f.windows[0].destroyed).toBe(true);
  expect(f.writes.filter((file) => file.endsWith(".pdf"))).toEqual([]);
  expect(f.ipc.eventNames()).toEqual([]);
});

test("canceling the save dialog creates no print window and does not flush or write a PDF", async () => {
  let flushed = false;
  const f = await serviceFixture({
    canceled: true,
    flush: async () => {
      flushed = true;
    },
  });
  expect(await f.service.exportPDF("doc")).toBeNull();
  expect(flushed).toBe(false);
  expect(f.windows).toEqual([]);
  expect(f.writes).toEqual([]);
});

test("generation waits for pending editor saves before opening the print view", async () => {
  const gate = deferred<void>();
  const f = await serviceFixture({ flush: () => gate.promise });
  const generated = f.service.generate("doc");
  await Promise.resolve();
  expect(f.windows).toEqual([]);
  gate.resolve();
  await generated;
  expect(f.windows).toHaveLength(1);
});

test("failed editor flush prevents generation", async () => {
  const f = await serviceFixture({
    flush: async () => {
      throw new Error("Editor is still loading");
    },
  });
  await expect(f.service.generate("doc")).rejects.toThrow(
    "Editor is still loading",
  );
  expect(f.windows).toEqual([]);
});

test("closing a print window before readiness rejects its request", async () => {
  const f = await serviceFixture({ load: async () => {} });
  const generated = f.service.generate("doc");
  await until(() => Boolean(f.windows[0]?.url));
  f.windows[0].destroy();
  await expect(generated).rejects.toThrow("Print window closed");
  expect(f.ipc.eventNames()).toEqual([]);
});

test("tree-builder errors reject the resolver rather than leaving its promise pending", async () => {
  const { TreeResolver } = loadSource<
    typeof import("../src/compiler/resolver/tree-resolver")
  >("../src/compiler/resolver/tree-resolver.ts", {
    "../builder/toa-builder": {
      TOABuilder: class {
        async create() {
          throw new Error("Alias read failed");
        }
      },
    },
    "../builder/tof-builder": {
      TOFBuilder: class {
        create() {
          return {};
        }
      },
    },
    "../builder/toc-builder": {},
  });
  await expect(
    new TreeResolver().resolve({
      config: { parser: { mode: "full" } },
      root: { parentElement: {} },
    } as unknown as Engine),
  ).rejects.toThrow("Alias read failed");
});

test("print image readiness waits for decode and reports failed images", async () => {
  const { waitForPrintImages } =
    await import("../src/compiler/print-resources");
  const gate = deferred<void>();
  let ready = false;
  const root = {
    querySelectorAll: () => [
      { getAttribute: () => "blob:fixture", decode: () => gate.promise },
    ],
  } as unknown as ParentNode;
  const waiting = waitForPrintImages(root).then(() => {
    ready = true;
  });
  await Promise.resolve();
  expect(ready).toBe(false);
  gate.resolve();
  await waiting;
  expect(ready).toBe(true);
  const failed = {
    querySelectorAll: () => [
      {
        getAttribute: () => "blob:missing",
        decode: async () => {
          throw new Error("Decode failed");
        },
      },
    ],
  } as unknown as ParentNode;
  await expect(waitForPrintImages(failed)).rejects.toThrow(
    "Unable to load print image",
  );
});
