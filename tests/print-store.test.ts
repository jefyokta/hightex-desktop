import "fake-indexeddb/auto";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import { createDocumentPrintStore } from "../src/compiler/print-store";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const source = HighTexDB.getInstance();
const stores: HighTexDB[] = [];

beforeAll(async () => {
  await source.open();
});
beforeEach(async () => {
  await Promise.all(source.tables.map((table) => table.clear()));
  await source.documents.put({
    id: "draft",
    title: "Original title",
    altTitle: "Original title",
    category: "1",
    config: {},
    keywords: { indonesian: ["original"], english: [] },
    profile: {
      name: "Original author",
      nim: "001",
      advisorName: "",
      advisorNip: "",
      cv: "Original biography",
    },
  });
  await source.chapters.put({
    id: "draft.1",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Original content" },
          { type: "cite", attrs: { cite: "shared-reference" } },
        ],
      },
      { type: "image", attrs: { src: "shared-image" } },
    ],
  });
  await source.cite.bulkPut([
    { key: "own-reference", documentId: "draft", bib: "Original reference" },
    { key: "other-reference", documentId: "other", bib: "Unrelated reference" },
    {
      key: "shared-reference",
      documentId: "other",
      bib: "Required shared reference",
    },
  ]);
  await source.images.bulkPut([
    {
      id: "shared-image",
      documentId: "other",
      blob: new Blob(["original image"]),
      createdAt: 0,
    },
    {
      id: "other-image",
      documentId: "other",
      blob: new Blob(["unrelated image"]),
      createdAt: 0,
    },
  ]);
  await source.documentVariables.bulkPut([
    { name: "custom", documentId: "draft", value: "Original variable" },
    {
      name: "globalCustom",
      documentId: "global",
      value: "Original global variable",
    },
    { name: "private", documentId: "other", value: "Other variable" },
  ]);
  await source.aliases.put({
    key: "draft.ERP",
    documentId: "draft",
    value: "Original alias",
  });
});
afterAll(async () => {
  await Promise.all(stores.map((db) => db.delete()));
  await source.delete();
});

test("a print store preserves one revision of chapters, author, references, assets and variables", async () => {
  const store = await createDocumentPrintStore("draft");
  stores.push(store);
  await source.documents.update("draft", {
    title: "New title",
    profile: {
      name: "New author",
      nim: "002",
      advisorName: "",
      advisorNip: "",
      cv: "New biography",
    },
  });
  await source.chapters.put({
    id: "draft.1",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "New content" }] },
    ],
  });
  await source.cite.update("own-reference", { bib: "New reference" });
  await source.images.update("shared-image", { blob: new Blob(["new image"]) });
  await source.documentVariables.update(["draft", "custom"], {
    value: "New variable",
  });
  await source.aliases.update("draft.ERP", { value: "New alias" });

  expect((await store.documents.get("draft"))?.title).toBe("Original title");
  expect((await store.documents.get("draft"))?.profile?.name).toBe(
    "Original author",
  );
  expect(
    JSON.stringify((await store.chapters.get("draft.1"))?.content),
  ).toContain("Original content");
  expect((await store.cite.get("own-reference"))?.bib).toBe(
    "Original reference",
  );
  expect(
    await store.images.get("shared-image").then((image) => image?.blob.text()),
  ).toBe("original image");
  expect((await store.documentVariables.get(["draft", "custom"]))?.value).toBe(
    "Original variable",
  );
  expect((await store.aliases.get("draft.ERP"))?.value).toBe("Original alias");
});

test("compiler warm and writes stay isolated while required shared images and global variables are retained", async () => {
  const store = await createDocumentPrintStore("draft");
  stores.push(store);
  const referenceCount = await store.cite.count();
  await store.warm();
  expect(await store.cite.count()).toBe(referenceCount);
  await store.chapters.put({ id: "draft.1", content: [] });
  expect(
    JSON.stringify((await source.chapters.get("draft.1"))?.content),
  ).toContain("Original content");
  expect(await store.images.get("shared-image")).toBeDefined();
  expect(await store.images.get("other-image")).toBeUndefined();
  expect(await store.cite.get("other-reference")).toBeUndefined();
  expect((await store.cite.get("shared-reference"))?.bib).toBe(
    "Required shared reference",
  );
  expect(
    (await store.documentVariables.get(["global", "globalCustom"]))?.value,
  ).toBe("Original global variable");
  expect(
    await store.documentVariables.get(["other", "private"]),
  ).toBeUndefined();
  expect(Dexie.dependencies.indexedDB).toBe(indexedDB);
});

test("missing draft fails before creating a print store", async () => {
  await expect(createDocumentPrintStore("missing")).rejects.toThrow(
    "Document not found",
  );
});
