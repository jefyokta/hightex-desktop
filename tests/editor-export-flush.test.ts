import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadSource<T>(
  file: string,
  modules: Record<string, unknown>,
  extra = {},
): T {
  const sandbox = {
    exports: {} as T,
    require: (name: string) => modules[name],
    setTimeout,
    clearTimeout,
    ...extra,
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

function mainFixture() {
  const ipc = new EventEmitter();
  let request = "";
  const window = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    webContents: {
      send: (_channel: string, id: string) => {
        request = id;
      },
    },
  });
  const { EditorWindow } = loadSource<
    typeof import("../electron/windows/editor-window")
  >("../electron/windows/editor-window.ts", {
    electron: { ipcMain: ipc },
    "node:crypto": { randomUUID: () => "fixture-request" },
    "./../main/application": {},
    fs: {},
    path: {},
  });
  (EditorWindow as unknown as { windows: Map<string, unknown> }).windows.set(
    "doc",
    { window, document: { id: "doc" } },
  );
  const acknowledge = (error?: string, sender: unknown = window.webContents) =>
    ipc.emit(`editor:flush:result:${request}`, { sender }, error);
  return { EditorWindow, ipc, window, acknowledge };
}

test("cross-window flush waits for the target editor and ignores other senders", async () => {
  const f = mainFixture();
  let flushed = false;
  const waiting = f.EditorWindow.flush("doc").then(() => {
    flushed = true;
  });
  f.acknowledge(undefined, {});
  await Promise.resolve();
  expect(flushed).toBe(false);
  f.acknowledge();
  await waiting;
  expect(flushed).toBe(true);
  expect(f.ipc.eventNames()).toEqual([]);
  expect(f.window.listenerCount("closed")).toBe(0);
});

test("editor flush failures, closure and timeout reject without leaving listeners", async () => {
  const failed = mainFixture();
  const waiting = failed.EditorWindow.flush("doc");
  failed.acknowledge("Write failed");
  await expect(waiting).rejects.toThrow("Write failed");
  expect(failed.ipc.eventNames()).toEqual([]);
  const closed = mainFixture();
  const closing = closed.EditorWindow.flush("doc");
  closed.window.emit("closed");
  await expect(closing).rejects.toThrow("Editor closed");
  expect(closed.ipc.eventNames()).toEqual([]);
  const timeout = mainFixture();
  await expect(timeout.EditorWindow.flush("doc", 5)).rejects.toThrow(
    "Timed out",
  );
  expect(timeout.ipc.eventNames()).toEqual([]);
});

test("documents without an open editor need no flush handshake", async () => {
  const f = mainFixture();
  await f.EditorWindow.flush("other");
  expect(f.ipc.eventNames()).toEqual([]);
});

function rendererFixture(ready: boolean) {
  let receive!: (request: string, documentId: string) => void;
  const replies: Array<{ request: string; error?: string }> = [];
  let resolveSave!: () => void;
  const saved = new Promise<void>((resolve) => {
    resolveSave = resolve;
  });
  const chapter = { getDocumentId: () => "doc" };
  const { EditorFlushSlave } = loadSource<
    typeof import("../src/slaves/editor-flush")
  >(
    "../src/slaves/editor-flush.tsx",
    {
      react: { useEffect: (setup: () => void) => setup() },
      "react-router-dom": { useParams: () => ({ id: "doc" }) },
      "@/hooks/use-editor": {
        useCurrentEditor: () => ({
          editor: ready ? { isEditable: true } : null,
        }),
      },
      "@/hooks/use-chapter": { useChapterStore: () => ({ chapter }) },
      "@/editor/event": {
        getEditorChapter: () => (ready ? chapter : undefined),
      },
      "@/editor/manager": { Manager: { emit: () => saved } },
      "@/editor/storage": {
        Storage: { instance: { waitForDocument: async () => {} } },
      },
    },
    {
      window: {
        editor: {
          onFlush: (listener: typeof receive) => {
            receive = listener;
            return () => {};
          },
          completeFlush: (request: string, error?: string) => {
            replies.push({ request, error });
          },
        },
      },
    },
  );
  EditorFlushSlave();
  return { receive, replies, resolveSave };
}

test("renderer acknowledges export flush only after its editor save completes", async () => {
  const f = rendererFixture(true);
  f.receive("request", "doc");
  await Promise.resolve();
  expect(f.replies).toEqual([]);
  f.resolveSave();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(f.replies).toEqual([{ request: "request", error: undefined }]);
});

test("a loading editor refuses export flush rather than saving its placeholder", async () => {
  const f = rendererFixture(false);
  f.receive("request", "doc");
  await Promise.resolve();
  expect(f.replies[0]?.error).toBe("Editor is not ready for PDF export");
});
