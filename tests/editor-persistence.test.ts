import { expect, test } from "bun:test";
import type { Editor, JSONContent } from "@tiptap/core";
import type { Chapter } from "../src/editor/chapter";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadSource<T>(file: string, modules: Record<string, unknown>): T {
  const sandbox = {
    exports: {} as T,
    require: (name: string) => modules[name],
  };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
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

const paragraph = (text: string): JSONContent[] => [
  { type: "paragraph", content: [{ type: "text", text }] },
];

function editorFixture() {
  const read = deferred<JSONContent[]>();
  const writes: JSONContent[][] = [];
  const state = {
    doc: { type: "doc", content: [] as JSONContent[] },
    schema: {},
    plugins: [],
  };
  const model = {
    isDestroyed: false,
    isEditable: true,
    state,
    setEditable(value: boolean) {
      this.isEditable = value;
    },
    getJSON() {
      return this.state.doc;
    },
    commands: {
      setContent(doc: typeof state.doc) {
        model.state.doc = doc;
      },
      fixTables() {},
    },
    view: {
      updateState(next: typeof state) {
        model.state = next;
      },
    },
  };
  const editor = model as unknown as Editor;
  const chapter = {
    getId: () => "doc.4",
    getContent: () => read.promise,
    setContent: async (content: JSONContent[]) => {
      writes.push(structuredClone(content));
    },
  } as unknown as Chapter;
  const normalizeUpdate = () => {
    void source.events.update({ editor });
  };
  const source = loadSource<typeof import("../src/editor/event")>(
    "../src/editor/event/index.ts",
    {
      "../extensions/utilites": { ensureUniqueId: () => normalizeUpdate?.() },
      "@tiptap/pm/state": {
        EditorState: { create: (next: typeof state) => next },
      },
      "../storage": {
        Storage: { instance: { waitForChapter: async () => {} } },
      },
      "@/utils/content-fixer": {
        ContentFixer: (content: JSONContent[]) => ({ type: "doc", content }),
      },
      "@/utils/convert-table-header-like": {
        convertTableHeaderLikeCells: () => {},
      },
      "@/utils/migrate-grid-to-table": {
        migrateGridToTable: async (content: JSONContent[]) => content,
      },
    },
  );
  return { ...source, read, writes, model, editor, chapter };
}

test("placeholder and normalization transactions cannot autosave before the chapter is loaded", async () => {
  const f = editorFixture();
  const initialized = f.events.create({ editor: f.editor, chapter: f.chapter });
  await f.events.update({ editor: f.editor });
  expect(f.writes).toEqual([]);
  expect(f.model.isEditable).toBe(false);
  expect(f.getEditorChapter(f.editor)).toBeUndefined();

  f.read.resolve(paragraph("Original chapter four"));
  expect(await initialized).toBe(true);
  expect(f.writes).toEqual([]);
  expect(f.getEditorChapter(f.editor)).toBe(f.chapter);
  expect(f.model.isEditable).toBe(true);

  f.model.state.doc.content = paragraph("Edited chapter four");
  await f.events.update({ editor: f.editor });
  expect(f.writes).toEqual([paragraph("Edited chapter four")]);
});

test("a canceled load cannot populate, enable, or bind the old editor", async () => {
  const f = editorFixture();
  let current = true;
  const initialized = f.events.create({
    editor: f.editor,
    chapter: f.chapter,
    isCurrent: () => current,
  });
  current = false;
  f.read.resolve(paragraph("Obsolete content"));
  expect(await initialized).toBe(false);
  expect(f.model.state.doc.content).toEqual([]);
  expect(f.model.isEditable).toBe(false);
  expect(f.getEditorChapter(f.editor)).toBeUndefined();
  await f.events.update({ editor: f.editor });
  expect(f.writes).toEqual([]);
});

test("a failed chapter read never enables autosave or replaces stored content", async () => {
  const f = editorFixture();
  const initialized = f.events.create({ editor: f.editor, chapter: f.chapter });
  f.read.reject(new Error("Read failed"));
  await expect(initialized).rejects.toThrow("Read failed");
  await f.events.update({ editor: f.editor });
  expect(f.writes).toEqual([]);
  expect(f.model.isEditable).toBe(false);
  expect(f.getEditorChapter(f.editor)).toBeUndefined();
});

test("disposing an editor during loading prevents its pending create from enabling autosave", async () => {
  const f = editorFixture();
  const initialized = f.events.create({ editor: f.editor, chapter: f.chapter });
  f.events.destroy({ editor: f.editor });
  f.read.resolve(paragraph("Obsolete content"));
  expect(await initialized).toBe(false);
  expect(f.model.isEditable).toBe(false);
  expect(f.getEditorChapter(f.editor)).toBeUndefined();
  await f.events.update({ editor: f.editor });
  expect(f.writes).toEqual([]);
});

test("intentional clearing after loading is saved, while disposed editors cannot save", async () => {
  const f = editorFixture();
  f.read.resolve(paragraph("Original"));
  await f.events.create({ editor: f.editor, chapter: f.chapter });
  f.model.state.doc.content = [];
  await f.events.update({ editor: f.editor });
  expect(f.writes).toEqual([[]]);
  f.events.destroy({ editor: f.editor });
  f.model.state.doc.content = paragraph("Late update");
  await f.events.update({ editor: f.editor });
  expect(f.writes).toEqual([[]]);
  expect(f.getEditorChapter(f.editor)).toBeUndefined();
});

function storageFixture() {
  const transactions: ReturnType<typeof deferred<void>>[] = [];
  const stored = new Map<string, HighTexChapter>();
  const db = {
    chapters: {
      put: async (chapter: HighTexChapter) => {
        stored.set(chapter.id, chapter);
      },
    },
    documents: { update: async () => {} },
    transaction: (...args: unknown[]) => {
      const run = args[args.length - 1] as () => Promise<void>;
      const gate = deferred<void>();
      transactions.push(gate);
      return gate.promise.then(run);
    },
  };
  const { Storage } = loadSource<typeof import("../src/editor/storage")>(
    "../src/editor/storage/index.ts",
    {
      "./hightex-db": { HighTexDB: { getInstance: () => db } },
      "bibtex.js": {},
    },
  );
  return { storage: Storage.instance, transactions, stored };
}

test("chapter saves preserve write order, allow other chapters, and can be awaited before reload", async () => {
  const f = storageFixture();
  const first = f.storage.setChapter({
    id: "doc.1",
    content: paragraph("First"),
  });
  const latest = f.storage.setChapter({
    id: "doc.1",
    content: paragraph("Latest"),
  });
  const other = f.storage.setChapter({
    id: "doc.4",
    content: paragraph("Other"),
  });
  expect(f.transactions).toHaveLength(2);
  let finished = false;
  const flushed = f.storage.waitForChapter("doc.1").then(() => {
    finished = true;
  });
  f.transactions[1].resolve();
  await other;
  expect(f.stored.get("doc.4")?.content).toEqual(paragraph("Other"));
  expect(finished).toBe(false);
  f.transactions[0].resolve();
  await first;
  expect(f.transactions).toHaveLength(3);
  f.transactions[2].resolve();
  await latest;
  await flushed;
  expect(finished).toBe(true);
  expect(f.stored.get("doc.1")?.content).toEqual(paragraph("Latest"));
});

test("a failed save is reported without blocking the next chapter save", async () => {
  const f = storageFixture();
  const first = f.storage.setChapter({
    id: "doc.1",
    content: paragraph("First"),
  });
  const retry = f.storage.setChapter({
    id: "doc.1",
    content: paragraph("Retry"),
  });
  f.transactions[0].reject(new Error("Write failed"));
  await expect(first).rejects.toThrow("Write failed");
  expect(f.transactions).toHaveLength(2);
  f.transactions[1].resolve();
  await retry;
  await f.storage.waitForChapter("doc.1");
  expect(f.stored.get("doc.1")?.content).toEqual(paragraph("Retry"));
});
