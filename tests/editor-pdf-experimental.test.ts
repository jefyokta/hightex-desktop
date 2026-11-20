import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import * as path from "node:path";
import { PDFDocument } from "pdf-lib";
import { loadSource } from "./helpers/load-source";
import { editorPDFIdentity } from "../shared/editor-pdf-contract";
import { validateEditorPDFSnapshot, EditorPDFSnapshotError } from "../shared/editor-pdf-contract";
import { PDFPageAssembly } from "../electron/pdf/page-assembly";

function snapshot(): EditorPDFSnapshot {
  const input: EditorPDFSnapshot = {
    version: 3,
    documentId: "doc",
    sections: [{ id: "1", firstPage: 1, pages: 1, labels: ["1"] }],
    projection: {
      contexts: [{ pages: 1, width: 600, height: 800, stride: 800 }],
      views: [{ context: 0, page: 1 }], targets: [], links: [],
    },
    sourceHash: "a".repeat(64),
    planHash: "b".repeat(64),
    pages: 1,
    title: "Captured chapter",
    author: "Writer",
    html: "<!doctype html><html><body>Captured pages</body></html>",
    presentation: [[]],
    fingerprint: "",
  };
  input.fingerprint = createHash("sha256")
    .update(editorPDFIdentity(input))
    .digest("hex");
  return input;
}
const resign = (input: EditorPDFSnapshot) => ({
  ...input,
  fingerprint: createHash("sha256")
    .update(editorPDFIdentity(input))
    .digest("hex"),
});

function projectionSnapshot(): EditorPDFSnapshot {
  const original = snapshot();
  return resign({ ...original, version: 3, pages: 3, presentation: [[], []],
    sections: [{ id: "abstract", firstPage: 1, pages: 2, labels: ["i", "ii"] }, { id: "1", firstPage: 3, pages: 1, labels: ["1"] }],
    projection: { contexts: [{ pages: 2, width: 600, height: 800, stride: 824 }, { pages: 1, width: 600, height: 800, stride: 800 }],
      views: [{ context: 0, page: 1 }, { context: 0, page: 2 }, { context: 1, page: 1 }],
      targets: [{ id: "chapter", page: 3, x: 30, y: 40 }],
      links: [{ target: "chapter", page: 1, x: 30, y: 40, width: 60, height: 20 }] } });
}

test("bounded document transport binds each context view, geometry and destination to its identity", () => {
  const input = projectionSnapshot();validateEditorPDFSnapshot(input);
  for (const projection of [
    { ...input.projection, views: [input.projection.views[0], input.projection.views[0], input.projection.views[2]] },
    { ...input.projection, contexts: [{ ...input.projection.contexts[0], stride: 10 }, input.projection.contexts[1]] },
    { ...input.projection, links: [{ ...input.projection.links[0], width: 1000 }] },
  ]) expect(() => validateEditorPDFSnapshot({ ...input, projection })).toThrow("Invalid");
  expect(editorPDFIdentity(input)).not.toBe(editorPDFIdentity({ ...input, projection: { ...input.projection, links: [] } }));
});

test("invalid snapshot reports the exact field and reason without dumping document contents", () => {
  const input = projectionSnapshot();
  for (const [value, path, reason] of [
    [null, "snapshot", "expected an object"],
    [{ ...input, version: 4 }, "version", "expected canonical snapshot version 3"],
    [{ ...input, sections: [{ ...input.sections[0], firstPage: 2 }] }, "sections[0].firstPage", "expected 1"],
    [{ ...input, projection: { ...input.projection, links: [{ ...input.projection.links[0], target: 123 }] } }, "projection.links[0].target", "expected text"],
    [{ ...input, presentation: [[[, 0, 1, 2]], []] }, "presentation[0][0][0]", "finite number"],
    [{ ...input, title: "private-body ".repeat(400) }, "title", "exceeds"],
  ] as const) {
    let failure: unknown;
    try { validateEditorPDFSnapshot(value); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(EditorPDFSnapshotError);
    const error = failure as EditorPDFSnapshotError;
    expect(error.path).toBe(path);
    expect(error.message).toContain(path);
    expect(error.message).toContain(reason);
    expect(error.message).not.toContain("private-body");
  }
});

test("renderer page selection failures preserve their reason across the Electron boundary", async () => {
  const f = await fixture({ select: async () => "Context font failed to load: Times New Roman" });
  await expect(f.service.generate(projectionSnapshot(), new AbortController().signal))
    .rejects.toThrow("Editor PDF page 1/3: Context font failed to load: Times New Roman");
  expect(f.windows[0].printed).toBe(false);
  expect(f.windows[0].destroyed).toBe(true);
});

test("a deleted link destination does not prevent native PDF generation", async () => {
  const input = projectionSnapshot();
  input.projection.links[0].target = "deleted";
  validateEditorPDFSnapshot(input);
  const f = await fixture();
  const pdf = await PDFDocument.load(await f.service.generate(resign(input), new AbortController().signal));
  expect(pdf.getPageCount()).toBe(3);
  expect(pdf.getPages().every(page => !page.node.Annots()?.size())).toBe(true);
});

test("experimental host prints one native page per selected context view and assembles final links", async () => {
  const input = projectionSnapshot(), commands: string[] = [];
  const f = await fixture({ select: async command => { commands.push(command); } });
  const pdf = await PDFDocument.load(await f.service.generate(input, new AbortController().signal));
  expect(pdf.getPageCount()).toBe(3);expect(commands).toHaveLength(3);
  expect(commands[0]).toContain(`select(0,"${input.fingerprint}")`);expect(commands[2]).toContain("select(2,");
  expect(pdf.getPages()[0].node.Annots()?.size()).toBe(1);expect(f.windows.every(window => window.destroyed)).toBe(true);
});

test("batch printing groups consecutive views inside one context and retains final destinations", async () => {
  const commands: string[] = [];
  let prints = 0;
  const f = await fixture({ batchPages: 4,
    select: async command => { commands.push(command); },
    print: async () => {
      const document = await PDFDocument.create();
      document.addPage([450, prints++ === 0 ? 1218 : 600]);
      return document.save();
    },
  });
  const input = projectionSnapshot();
  const pdf = await PDFDocument.load(await f.service.generate(input, new AbortController().signal));
  expect(prints).toBe(2);
  expect(commands[0]).toContain(`select(0,"${input.fingerprint}",2)`);
  expect(commands[1]).toContain(`select(2,"${input.fingerprint}")`);
  expect(pdf.getPages().map(page => page.getSize())).toEqual(Array(3).fill({ width: 450, height: 600 }));
  expect(pdf.getPage(0).node.Annots()?.size()).toBe(1);
  expect(f.windows[0].destroyed).toBe(true);
});

test("cancel during a viewport selection prevents subsequent printing and releases the host", async () => {
  const task = new AbortController();let printed = false;
  const f = await fixture({ select: async () => { task.abort(); }, print: async () => { printed = true;throw Error("Unexpected print"); } });
  await expect(f.service.generate(projectionSnapshot(), task.signal)).rejects.toThrow();
  expect(printed).toBe(false);expect(f.windows[0].destroyed).toBe(true);expect(f.writes).toEqual([]);
});

test("whole document transport preserves ordered sections and rejects gaps or invalid labels", async () => {
  const input: EditorPDFSnapshot = resign({
    ...snapshot(),
    sections: [{ id: "cover", firstPage: 1, pages: 1, labels: [""] }],
  });
  validateEditorPDFSnapshot(input);
  const f = await fixture();
  const pdf = await PDFDocument.load(
    await f.service.generate(input, new AbortController().signal),
  );
  const metadata = JSON.parse(pdf.getSubject()!);
  expect(metadata.kind).toBe("editor-document-experimental");
  expect(metadata.sections).toEqual(input.sections);
  expect(metadata.chapterId).toBeUndefined();
  for (const sections of [
    [],
    [{ id: "cover", firstPage: 2, pages: 1, labels: [""] }],
    [{ id: "cover", firstPage: 1, pages: 2, labels: [""] }],
    [{ id: "cover", firstPage: 1, pages: 1, labels: [Infinity] }],
  ]) {
    expect(() =>
      validateEditorPDFSnapshot({ ...input, sections } as EditorPDFSnapshot),
    ).toThrow("Invalid");
  }
});

test("packaged applications reject HTML debugging before allocating a window or writing a file", async () => {
  const f = await fixture({ packaged: true });
  await expect(f.service.debug(snapshot(), new AbortController().signal)).rejects.toThrow("only in development");
  expect(f.windows).toHaveLength(0);
  expect(f.dialogs()).toBe(0);
  expect(f.writes).toEqual([]);
});

test("HTML debugging displays the validated snapshot without printing and releases its host when closed", async () => {
  const f = await fixture(), source = snapshot();
  const work = f.service.debug(source, new AbortController().signal);
  await until(() => f.windows[0]?.shown);
  expect(f.windows[0].url).toContain("debug=1");
  expect(f.input(f.windows[0])).toEqual(source);
  expect(f.windows[0].printed).toBe(false);
  expect(f.dialogs()).toBe(0);
  f.windows[0].destroy();
  await work;
  expect(f.handlers.size).toBe(0);
  expect(f.ipc.listenerCount("experimental:editor-pdf:ready")).toBe(0);
  expect(f.writes).toEqual([]);
});

test("debug inspection has no print timeout after readiness and cancellation still closes it", async () => {
  const f = await fixture({ timeout: 30 }), task = new AbortController();
  const work = f.service.debug(snapshot(), task.signal);
  await until(() => f.windows[0]?.shown);
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(f.windows[0].destroyed).toBe(false);
  task.abort();
  await expect(work).rejects.toThrow();
  expect(f.windows[0].destroyed).toBe(true);
  expect(f.handlers.size).toBe(0);
});

test("a debug renderer crash rejects inspection and releases the host", async () => {
  const f = await fixture();
  const work = f.service.debug(snapshot(), new AbortController().signal);
  await until(() => f.windows[0]?.shown);
  f.windows[0].webContents.emit("render-process-gone");
  await expect(work).rejects.toThrow("renderer failed");
  expect(f.windows[0].destroyed).toBe(true);
  expect(f.handlers.size).toBe(0);
  expect(f.ipc.listenerCount("editor:inspect-element")).toBe(0);
});

test("debug inspection routes context menu, IPC and shortcuts to its own window and removes handlers", async () => {
  const f = await fixture(), work = f.service.debug(snapshot(), new AbortController().signal);
  await until(() => f.windows[0]?.shown);
  const win = f.windows[0], contents = win.webContents;
  f.ipc.emit("editor:inspect-element", { sender: {}, senderFrame: contents.mainFrame }, 10, 20);
  f.ipc.emit("editor:inspect-element", f.event(win), NaN, 20);
  expect(f.inspections).toEqual([]);
  f.ipc.emit("editor:inspect-element", f.event(win), 10, 20);
  contents.emit("context-menu", {}, { x: 30, y: 40 });
  f.menus[0][0].click!();
  expect(f.inspections).toEqual([[10, 20], [30, 40]]);
  let prevented = false;
  contents.emit("before-input-event", { preventDefault() { prevented = true; } }, { type: "keyDown", key: "F12" });
  expect(prevented).toBe(true);
  expect(f.toggles()).toBe(1);
  win.destroy(); await work;
  expect(f.ipc.listenerCount("editor:inspect-element")).toBe(0);
  expect(contents.listenerCount("context-menu")).toBe(0);
  expect(contents.listenerCount("before-input-event")).toBe(0);
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => (resolve = yes));
  return { promise, resolve };
}
async function until(check: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw Error("Fixture did not settle");
}

type HostWindow = EventEmitter & {
  url: string;
  destroyed: boolean;
  printed: boolean;
  shown: boolean;
  destroy(): void;
  webContents: EventEmitter & {
    mainFrame: { processId: number; routingId: number };
  };
};
async function fixture(
  options: {
    batchPages?: number;
    canceled?: boolean;
    packaged?: boolean;
    timeout?: number;
    load?: (window: HostWindow) => Promise<void>;
    print?: () => Promise<Uint8Array>;
    select?: (command: string) => Promise<string | void>;
    write?: (signal: AbortSignal) => Promise<void>;
  } = {},
) {
  const handlers = new Map<string, (event: unknown) => EditorPDFSnapshot>();
  const ipc = Object.assign(new EventEmitter(), {
    handle: (name: string, handler: (event: unknown) => EditorPDFSnapshot) =>
      handlers.set(name, handler),
    removeHandler: (name: string) => handlers.delete(name),
  });
  const windows: HostWindow[] = [],
    writes: string[] = [];
  const inspections: [number, number][] = [];
  const menus: { label?: string; click?: () => void }[][] = [];
  let toggles = 0;
  const temporary = new Set<string>();
  let dialogs = 0;
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  class Window extends EventEmitter {
    url = "";
    destroyed = false;
    printed = false;
    shown = false;
    private contents = Object.assign(new EventEmitter(), {
      mainFrame: { processId: 1, routingId: windows.length + 1 },
      openDevTools: () => {},
      inspectElement: (x: number, y: number) => inspections.push([x, y]),
      toggleDevTools: () => toggles++,
      executeJavaScript: async (command: string) => options.select?.(command),
      printToPDF: async () => {
        this.printed = true;
        return options.print ? options.print() : bytes;
      },
    });
    get webContents() {
      if (this.destroyed) throw Error("Object has been destroyed");
      return this.contents;
    }
    constructor() {
      super();
      windows.push(this);
    }
    async loadURL(url: string) {
      this.url = url;
      if (options.load) return options.load(this);
      publish(this);
    }
    show() { this.shown = true; }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      this.emit("closed");
    }
  }
  const event = (window: HostWindow) => ({
    sender: window.webContents,
    senderFrame: window.webContents.mainFrame,
  });
  function input(window: HostWindow) {
    const request = new URL(window.url).searchParams.get("request")!;
    return handlers.get(`experimental:editor-pdf:init:${request}`)!(
      event(window),
    );
  }
  function publish(
    window: HostWindow,
    overrides: {
      sender?: HostWindow;
      fingerprint?: string;
      pages?: number;
    } = {},
  ) {
    const request = new URL(window.url).searchParams.get("request")!,
      snapshot = input(window);
    ipc.emit(
      "experimental:editor-pdf:ready",
      event(overrides.sender ?? window),
      request,
      overrides.fingerprint ?? snapshot.fingerprint,
      overrides.pages ?? snapshot.pages,
    );
  }
  const contract = await import("../shared/editor-pdf-contract");
  const dependencies = {
      electron: {
        Menu: { buildFromTemplate: (items: typeof menus[number]) => ({ popup: () => menus.push(items) }) },
        app: { isPackaged: options.packaged ?? false },
        BrowserWindow: Window,
        ipcMain: ipc,
        dialog: {
          showSaveDialog: async () => {
            dialogs++;
            return {
              canceled: options.canceled ?? false,
              filePath: "/tmp/chapter.pdf",
            };
          },
        },
      },
      "node:crypto": { createHash, randomUUID: () => crypto.randomUUID() },
      "node:fs/promises": {
        writeFile: async (
          file: string,
          _bytes: Uint8Array,
          config: { signal: AbortSignal },
        ) => {
          temporary.add(file);
          await options.write?.(config.signal);
        },
        rename: async (file: string, destination: string) => {
          expect(temporary.has(file)).toBe(true);
          temporary.delete(file);
          writes.push(destination);
        },
        rm: async (file: string) => {
          temporary.delete(file);
        },
      },
      "node:path": path,
      "pdf-lib": { PDFDocument },
      "../main/application": {
        Application: {
          instance: {
            preloadEntry: "",
            resolveRendererUrl: (route: string) =>
              new URL(route, "https://fixture.test").href,
          },
        },
      },
      "./config-service": {
        ConfigService: {
          get: () => ({
            export: {
              saveFolder: "/tmp",
              exportTimeout: options.timeout ?? 2000,
            },
          }),
        },
      },
      "../../shared/editor-pdf-contract": contract,
    };
  const host = loadSource<typeof import("../electron/windows/editor-pdf-host")>(
    new URL("../electron/windows/editor-pdf-host.ts", import.meta.url),
    { ...dependencies, "../service/config-service": dependencies["./config-service"] },
  );
  const { EditorPDFExperimentalService } = loadSource<typeof import("../electron/service/editor-pdf-experimental-service")>(
    new URL("../electron/service/editor-pdf-experimental-service.ts", import.meta.url),
    { ...dependencies, "../windows/editor-pdf-host": host, "../pdf/page-assembly": { PDFPageAssembly } },
  );
  return {
    service: new EditorPDFExperimentalService(options.batchPages ?? 1),
    windows,
    writes,
    temporary,
    ipc,
    handlers,
    publish,
    input,
    event,
    inspections, menus, toggles: () => toggles,
    dialogs: () => dialogs,
  };
}

test("editor snapshot identity rejects changed pages/HTML before opening a host", async () => {
  const f = await fixture();
  for (const input of [
    { ...snapshot(), pages: 2 },
    { ...snapshot(), html: "Changed" },
    { ...snapshot(), sections: [{ id: "changed", firstPage: 1, pages: 1, labels: ["1"] }] },
  ])
    await expect(
      f.service.generate(input, new AbortController().signal),
    ).rejects.toThrow();
  expect(f.windows).toEqual([]);
  expect(f.handlers.size).toBe(0);
});

test("captured page PDF carries its own metadata and owns independent transport bytes", async () => {
  const gate = deferred<void>();
  const f = await fixture({ load: () => gate.promise });
  const input = snapshot();
  const generated = f.service.generate(input, new AbortController().signal);
  await until(() => !!f.windows[0]?.url);
  input.html = "Live edit after capture";
  expect(f.input(f.windows[0]).html).not.toBe(input.html);
  f.publish(f.windows[0]);
  gate.resolve();
  const pdf = await PDFDocument.load(await generated),
    metadata = JSON.parse(pdf.getSubject()!);
  expect(metadata.kind).toBe("editor-document-experimental");
  expect(metadata.planHash).toBe("b".repeat(64));
  expect(pdf.getAuthor()).toBe("Writer");
  expect(f.windows[0].destroyed).toBe(true);
  expect(f.handlers.size).toBe(0);
  expect(f.ipc.eventNames()).toEqual([]);
});

test("same-document requests accept only their own host frame and ready identity", async () => {
  const f = await fixture({ load: async () => {} }),
    unrelated = () => {};
  f.ipc.on("unrelated", unrelated);
  const a = f.service.generate(snapshot(), new AbortController().signal),
    b = f.service.generate(
      resign({ ...snapshot(), planHash: "c".repeat(64) }),
      new AbortController().signal,
    );
  await until(
    () => f.windows.length === 2 && f.windows.every((window) => !!window.url),
  );
  const [first, second] = f.windows;
  f.publish(first, { sender: second });
  await Promise.resolve();
  expect(first.printed).toBe(false);
  const request = new URL(first.url).searchParams.get("request")!;
  expect(() =>
    f.handlers.get(`experimental:editor-pdf:init:${request}`)!(f.event(second)),
  ).toThrow("forbidden");
  f.publish(first);
  await a;
  expect(second.printed).toBe(false);
  f.publish(second);
  await b;
  expect(f.handlers.size).toBe(0);
  expect(f.ipc.eventNames()).toEqual(["unrelated"]);
});


test("save cancellation and pre-abort allocate no print window or file", async () => {
  const f = await fixture({ canceled: true });
  expect(
    await f.service.export(snapshot(), new AbortController().signal),
  ).toBeNull();
  const aborted = new AbortController();
  aborted.abort();
  await expect(
    f.service.generate(snapshot(), aborted.signal),
  ).rejects.toThrow();
  expect(f.windows).toEqual([]);
  expect(f.writes).toEqual([]);
  expect(f.dialogs()).toBe(1);
});

test("cancellation during render readiness removes its host and IPC handlers", async () => {
  const f = await fixture({ load: async () => {} }),
    task = new AbortController();
  const generated = f.service.generate(snapshot(), task.signal);
  await until(() => !!f.windows[0]?.url);
  task.abort();
  await expect(generated).rejects.toThrow("cancelled");
  expect(f.windows[0].destroyed).toBe(true);
  expect(f.handlers.size).toBe(0);
  expect(f.ipc.eventNames()).toEqual([]);
});

test("cancellation and timeout cover native printing and prevent file writes", async () => {
  const never = () => new Promise<Uint8Array>(() => {});
  const f = await fixture({ print: never }),
    task = new AbortController();
  const output = f.service.export(snapshot(), task.signal);
  await until(() => !!f.windows[0]?.printed);
  task.abort();
  await expect(output).rejects.toThrow("cancelled");
  expect(f.writes).toEqual([]);
  const timed = await fixture({ print: never, timeout: 20 });
  await expect(
    timed.service.export(projectionSnapshot(), new AbortController().signal),
  ).rejects.toThrow("timeout after 20 ms while printing page 1/3 (section abstract, context 0, local page 1)");
  expect(timed.writes).toEqual([]);
  expect(timed.handlers.size).toBe(0);
});

test("closed or crashed renderers fail promptly even after ready", async () => {
  const f = await fixture({ print: () => new Promise<Uint8Array>(() => {}) });
  const generated = f.service.generate(
    snapshot(),
    new AbortController().signal,
  );
  await until(() => !!f.windows[0]?.printed);
  f.windows[0].webContents.emit("render-process-gone");
  await expect(generated).rejects.toThrow("renderer failed");
  expect(f.windows[0].destroyed).toBe(true);
  expect(f.handlers.size).toBe(0);
});

test("only a completed PDF replaces the chosen file, including cancellation during writing", async () => {
  const success = await fixture();
  expect(
    await success.service.export(snapshot(), new AbortController().signal),
  ).toEqual({ path: "/tmp/chapter.pdf", filename: "chapter.pdf" });
  expect(success.writes).toEqual(["/tmp/chapter.pdf"]);
  expect(success.temporary.size).toBe(0);
  const task = new AbortController();
  const canceled = await fixture({
    write: async () => {
      task.abort();
    },
  });
  await expect(
    canceled.service.export(snapshot(), task.signal),
  ).rejects.toThrow();
  expect(canceled.writes).toEqual([]);
  expect(canceled.temporary.size).toBe(0);
  const failed = await fixture({
    write: async () => {
      throw Error("Disk full");
    },
  });
  await expect(
    failed.service.export(snapshot(), new AbortController().signal),
  ).rejects.toThrow("Disk full");
  expect(failed.writes).toEqual([]);
  expect(failed.temporary.size).toBe(0);
});


test("duplicate snapshot destination IDs retain the first recorded owner", () => {
  const input = projectionSnapshot();
  input.projection.targets.push({ ...input.projection.targets[0], page: 999, x: -100 });
  expect(() => validateEditorPDFSnapshot(input)).not.toThrow();
});
