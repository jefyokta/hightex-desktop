import "fake-indexeddb/auto";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import { ReferenceRepository } from "../src/editor/storage/reference-repository";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const db = HighTexDB.getInstance();
const references = new ReferenceRepository(db);
beforeAll(() => db.open());
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});
afterAll(() => db.delete());

const seed = async () => {
  await db.cite.bulkPut(
    ["first", "second", "other-document", "unused"].map((key) => ({
      key,
      bib: `@book{${key},title={Title},author={Author},year={2026}}`,
    })),
  );
  await db.chapters.bulkPut([
    {
      id: "a.1",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "cite", attrs: { cite: "first|second" } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "b.abstract",
      content: [{ type: "cite", attrs: { cite: "other-document" } }],
    },
  ]);
};

test("cleanup preserves grouped and nested citations across all documents", async () => {
  await seed();
  expect((await references.unused()).map((citation) => citation.key)).toEqual([
    "unused",
  ]);
  expect(
    await references.deleteUnused(["first", "second", "other-document", "unused"]),
  ).toBe(1);
  expect(await db.cite.toCollection().primaryKeys()).toEqual([
    "first",
    "other-document",
    "second",
  ]);
  expect(await references.unused()).toEqual([]);
});

test("cleanup rechecks chapters after confirmation and only removes reviewed candidates", async () => {
  await seed();
  const reviewed = (await references.unused()).map((citation) => citation.key);
  await db.chapters.put({
    id: "c.1",
    content: [{ type: "cite", attrs: { cite: "unused" } }],
  });
  await db.cite.put({ key: "new-unused", bib: "@book{new,title={New}}" });
  expect(await references.deleteUnused(reviewed)).toBe(0);
  expect(await db.cite.get("unused")).toBeDefined();
  expect(await db.cite.get("new-unused")).toBeDefined();
});

test("cleanup handles an empty library and unused entries without chapters", async () => {
  expect(await references.unused()).toEqual([]);
  expect(await references.deleteUnused([])).toBe(0);
  await db.cite.put({ key: "unused", bib: "@book{unused,title={Unused}}" });
  expect(await references.deleteUnused([])).toBe(0);
  expect(await references.deleteUnused(["unused", "unused", "missing"])).toBe(1);
  expect(await db.cite.count()).toBe(0);
});

test("cleanup rolls back every deletion if a write fails", async () => {
  await db.cite.bulkPut(
    ["a", "b"].map((key) => ({ key, bib: "@book{entry,title={Title}}" })),
  );
  const fail = (key: string) => {
    if (key === "b") throw new Error("write failed");
  };
  db.cite.hook("deleting", fail);
  try {
    await expect(references.deleteUnused(["a", "b"])).rejects.toThrow(
      "write failed",
    );
    expect(await db.cite.count()).toBe(2);
  } finally {
    db.cite.hook("deleting").unsubscribe(fail);
  }
});

test("usage identifies documents and chapters for nested and grouped citations", async () => {
  await seed();
  expect(await references.usage("second")).toEqual([{ documentId: "a", title: "a", chapters: ["1"] }]);
  expect(await references.usage("other-document")).toEqual([{ documentId: "b", title: "b", chapters: ["abstract"] }]);
  expect(await references.usage("unused")).toEqual([]);
});

test("imports keep explicit duplicates separate but can reuse equivalent Zotero metadata", async () => {
  const bib = "@book{source,author={Doe, Jane},title={Original},year={2026},doi={10.1234/source}}";
  await db.cite.put({ key: "document-owned", documentId: "a", bib });
  const reused = await references.importBibtex(bib.replace("{source,", "{zotero-key,"), { reuseEquivalent: true });
  expect(reused.records.map(record => record.key)).toEqual(["document-owned"]);
  expect(reused.records[0].documentId).toBe("a");
  expect(await db.cite.count()).toBe(1);
  const explicit = await references.importBibtex(bib.replace("{source,", "{document-owned,"));
  expect(explicit.records.map(record => record.key)).toEqual(["document-owned_1"]);
  const changed = await references.importBibtex(bib.replace("Original", "Revised title"), { reuseEquivalent: true });
  expect(changed.records.map(record => record.key)).toEqual(["source"]);
  expect(await db.cite.count()).toBe(3);
  expect((await db.cite.get("document-owned"))?.bib).toBe(bib);
});

test("concurrent imports reserve unique keys in the same transaction", async () => {
  const bib = "@book{source,author={Writer},title={Title},year={2026}}";
  const imported = await Promise.all([references.importBibtex(bib), references.importBibtex(bib)]);
  expect(imported.flatMap(result => result.records.map(record => record.key)).sort()).toEqual(["source", "source_1"]);
  expect(await db.cite.count()).toBe(2);
});
