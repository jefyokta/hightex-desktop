import "fake-indexeddb/auto";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import {
  deleteUnusedCitation,
  getUnusedCitations,
} from "../src/utils/delete-unused-citation";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const db = HighTexDB.getInstance();
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
  expect((await getUnusedCitations()).map((citation) => citation.key)).toEqual([
    "unused",
  ]);
  expect(
    await deleteUnusedCitation(["first", "second", "other-document", "unused"]),
  ).toBe(1);
  expect(await db.cite.toCollection().primaryKeys()).toEqual([
    "first",
    "other-document",
    "second",
  ]);
  expect(await getUnusedCitations()).toEqual([]);
});

test("cleanup rechecks chapters after confirmation and only removes reviewed candidates", async () => {
  await seed();
  const reviewed = (await getUnusedCitations()).map((citation) => citation.key);
  await db.chapters.put({
    id: "c.1",
    content: [{ type: "cite", attrs: { cite: "unused" } }],
  });
  await db.cite.put({ key: "new-unused", bib: "@book{new,title={New}}" });
  expect(await deleteUnusedCitation(reviewed)).toBe(0);
  expect(await db.cite.get("unused")).toBeDefined();
  expect(await db.cite.get("new-unused")).toBeDefined();
});

test("cleanup handles an empty library and unused entries without chapters", async () => {
  expect(await getUnusedCitations()).toEqual([]);
  expect(await deleteUnusedCitation([])).toBe(0);
  await db.cite.put({ key: "unused", bib: "@book{unused,title={Unused}}" });
  expect(await deleteUnusedCitation([])).toBe(0);
  expect(await deleteUnusedCitation(["unused", "unused", "missing"])).toBe(1);
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
    await expect(deleteUnusedCitation(["a", "b"])).rejects.toThrow(
      "write failed",
    );
    expect(await db.cite.count()).toBe(2);
  } finally {
    db.cite.hook("deleting").unsubscribe(fail);
  }
});
