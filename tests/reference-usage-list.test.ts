import "fake-indexeddb/auto";
import { afterAll, beforeAll, expect, test } from "bun:test";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import { ReferenceRepository } from "../src/editor/storage/reference-repository";
import { citationUsageIndex } from "../src/editor/document/reference-usage";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const db = new HighTexDB("ReferenceUsageList", false);
const repository = new ReferenceRepository(db);
const key = "local_document_internal_cite31";
beforeAll(async () => {
  await db.open();
  await db.documents.bulkPut([
    { id: "a", title: "First document" } as HighTexDocument,
    { id: "b", title: "Second document" } as HighTexDocument,
  ]);
  await db.chapters.bulkPut([
    { id: "a.1", content: [
      { type: "heading", content: [{ type: "text", text: "Introduction" }] },
      { type: "paragraph", content: [{ type: "cite", attrs: { cite: `${key}|other|${key}` } }] },
      { type: "paragraph", content: [{ type: "cite", attrs: { cite: key, manual: true } }] },
    ] },
    { id: "b.2", content: [
      { type: "heading", content: [{ type: "text", text: "Results" }] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [
        { type: "paragraph", content: [{ type: "cite", attrs: { cite: key } }] },
      ] }] }] },
    ] },
  ]);
});
afterAll(() => db.delete());

test("reference lists share one grouped usage index with document and chapter titles", async () => {
  const before = await db.chapters.toArray();
  const index = citationUsageIndex(await repository.usageChapters());
  expect(index.get(key)).toHaveLength(2);
  expect(index.get(key)?.map(location => [location.documentTitle, location.chapterTitle]))
    .toEqual([["First document", "Introduction"], ["Second document", "Results"]]);
  expect(index.get(key)?.[1].path).toEqual([1, 0, 0, 0, 0]);
  expect(index.get("other")).toHaveLength(1);
  expect(index.has("unused")).toBe(false);
  expect(await db.chapters.toArray()).toEqual(before);
});

test("an editor list counts only its own document", async () => {
  const chapters = await repository.usageChapters("a");
  expect(chapters.map(chapter => chapter.id)).toEqual(["a.1"]);
  expect(citationUsageIndex(chapters).get(key)).toHaveLength(1);
});
