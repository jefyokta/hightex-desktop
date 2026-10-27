import "fake-indexeddb/auto";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import { Document } from "../src/editor/document";
import { Chapter } from "../src/editor/chapter";
import { useChapterStore } from "../src/hooks/use-chapter";

const categories: Category[] = [
  {
    id: 1,
    name: "Thesis",
    variant: "thesis",
    chapters: [
      { chapter: "1", title: "Introduction" },
      { chapter: "4", title: "Results" },
    ],
  },
];
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Document.instance;
const originalCurrent = Document.current;
const originalChapter = Chapter.instance;
const originalStoreChapter = useChapterStore.getState().chapter;
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const db = HighTexDB.getInstance();
const api = { categories: async () => categories };

beforeAll(async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.assign(new EventTarget(), { hightex: api }),
  });
  await db.open();
});

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  api.categories = async () => categories;
  for (const id of ["active", "background"])
    await db.documents.put({
      id,
      title: id,
      altTitle: id,
      category: "1",
      config: {},
      keywords: { indonesian: [], english: [] },
    });
  await db.chapters.put({
    id: "active.1",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Original chapter one" }],
      },
    ],
  });
});

afterAll(async () => {
  await db.delete();
  Document.instance = originalDocument;
  Document.current = originalCurrent;
  Chapter.instance = originalChapter;
  useChapterStore.getState().setChapter(originalStoreChapter);
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

test("loading a document without activating it preserves the active editor and binds every chapter to its owner", async () => {
  const active = await new Document("active").warm();
  const chapter = active.chapters.find((item) => item.getChapter() === "1")!;
  Document.setCurrentChapter(chapter);
  let activated = 0;
  const onWarmed = () => {
    activated++;
  };
  window.addEventListener("document:warmed", onWarmed);
  try {
    const background = await new Document("background").warm({
      activate: false,
    });
    expect(background.ready).toBe(true);
    expect(
      background.chapters.every((item) => item.document === background),
    ).toBe(true);
    expect(Document.instance).toBe(active);
    expect(Document.current).toBe(chapter);
    expect(Chapter.instance).toBe(chapter);
    expect(useChapterStore.getState().chapter).toBe(chapter);
    expect(activated).toBe(0);
    background.activate();
    expect(Document.instance).toBe(background);
    expect(activated).toBe(1);
  } finally {
    window.removeEventListener("document:warmed", onWarmed);
  }
});

test("a slower obsolete load cannot replace the selected document or chapter", async () => {
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  let calls = 0;
  api.categories = async () => {
    if (++calls === 1) {
      started();
      await held;
    }
    return categories;
  };
  const obsolete = new Document("background").warm({ activate: false });
  await entered;
  const active = await new Document("active").warm({ activate: false });
  active.activate();
  const chapter = active.chapters.find((item) => item.getChapter() === "4")!;
  Document.setCurrentChapter(chapter);
  release();
  await obsolete;
  expect(Document.instance).toBe(active);
  expect(Document.current).toBe(chapter);
  expect(Chapter.instance).toBe(chapter);
  expect(useChapterStore.getState().chapter).toBe(chapter);
  expect(
    JSON.stringify((await db.chapters.get("active.1"))?.content),
  ).toContain("Original chapter one");
});

test("creating an already saved chapter, including concurrent calls, never clears its content", async () => {
  const doc = await new Document("active").warm({ activate: false });
  const chapter = doc.chapters.find((item) => item.getChapter() === "1")!;
  const original = await db.chapters.get("active.1");
  await Promise.all([chapter.query.create(), chapter.query.create()]);
  expect(await db.chapters.get("active.1")).toEqual(original);
});

test("a versioned document binds normal and static chapters to that version without activating them", async () => {
  const active = await new Document("active").warm();
  const version = await new Document("active", "v1").warm({ activate: false });
  expect(Document.instance).toBe(active);
  expect(
    version.chapters.every((chapter) => chapter.document === version),
  ).toBe(true);
  expect(
    version.chapters.every((chapter) => chapter.getId().endsWith(".v1")),
  ).toBe(true);
  expect(
    JSON.stringify((await db.chapters.get("active.1"))?.content),
  ).toContain("Original chapter one");
});
