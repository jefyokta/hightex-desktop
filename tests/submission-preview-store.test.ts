import "fake-indexeddb/auto";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import { readSnapshot } from "../src/review/snapshot-reader";
import { createSnapshotPreviewStore } from "../src/review/snapshot-preview-store";
import { emptyAuthorProfile } from "../src/utils/document-profile";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const actor = new HighTexDB(`preview-actor-${crypto.randomUUID()}`);
const categories: Category[] = [
  {
    id: 1,
    name: "TA",
    variant: "thesis",
    chapters: [{ chapter: "1", title: "PENDAHULUAN" }],
  },
];
const encode = (value: unknown) => strToU8(JSON.stringify(value));
const entries = (name = "Student A") => ({
  "manifest.json": encode({
    format: "json",
    schema_version: 2,
    document: { id: "same-id", title: { id: "Snapshot" }, category: "1" },
  }),
  "files/profile.json": encode({
    ...emptyAuthorProfile(),
    name,
    nim: name,
    cv: `<p>CV ${name}</p>`,
  }),
  "files/assets/profile.webp": strToU8(`Photo ${name}`),
  "files/config.json": encode({
    statementDate: "2026-10-21",
    intern: {
      onsite_at: "Company",
      advisor: { name: "Company advisor" },
      validity: "2026-10-21",
    },
  }),
  "files/chapters/1.json": encode([
    { type: "paragraph", content: [{ type: "text", text: name }] },
    { type: "image", attrs: { src: "shared" } },
  ]),
  "files/assets/images/shared.webp": strToU8(`Image ${name}`),
  "files/assets/references.json": encode({ shared: `Reference ${name}` }),
  "files/assets/variables.json": encode([
    { name: "company", value: name },
    { name: "name", value: "Wrong cached author" },
  ]),
  "files/assets/aliases.json": encode([{ key: "same-id.API", value: name }]),
});
const model = (data = entries()) =>
  readSnapshot(zipSync(data), { kind: "local", filename: "snapshot.hightex" });
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
beforeAll(async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      config: { get: () => ({ language: "en" }) },
      profile: {
        get: () => {
          throw new Error("Actor profile accessed");
        },
      },
    }),
  });
  await actor.open();
  await actor.documents.put({
    id: "same-id",
    title: "Actor draft",
    altTitle: "",
    category: "1",
    config: {},
    keywords: { indonesian: [], english: [] },
    profile: { ...emptyAuthorProfile(), name: "Advisor D" },
  });
  await actor.cite.put({ key: "shared", bib: "Actor reference" });
  await actor.images.put({
    id: "shared",
    blob: new Blob(["actor image"]),
    createdAt: 0,
    documentId: "same-id",
  });
});
afterAll(async () => {
  await actor.delete();
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

test("preview store lives in its own memory factory and leaves default storage/dependencies untouched", async () => {
  const databases = await indexedDB.databases();
  const before = await Promise.all(
    actor.tables.map((table) => table.toArray()),
  );
  const defaultFactory = HighTexDB.getInstance;
  const originalIDB = Dexie.dependencies.indexedDB;
  const originalRange = Dexie.dependencies.IDBKeyRange;
  const { db } = await createSnapshotPreviewStore(await model(), categories);
  try {
    expect(await indexedDB.databases()).toEqual(databases);
    expect(HighTexDB.getInstance).toBe(defaultFactory);
    expect(Dexie.dependencies.indexedDB).toBe(originalIDB);
    expect(Dexie.dependencies.IDBKeyRange).toBe(originalRange);
    expect(await db.getVar("name", "same-id")).toBe("Student A");
    expect((await db.cite.get("shared"))?.bib).toBe("Reference Student A");
    expect(await (await db.getBlob("shared"))?.text()).toBe("Image Student A");
    expect(
      await Promise.all(actor.tables.map((table) => table.toArray())),
    ).toEqual(before);
    expect(await (await actor.getBlob("shared"))?.text()).toBe("actor image");
  } finally {
    await db.delete();
  }
});

test("two snapshots sharing IDs keep independent authors, CV/photos, references and variables", async () => {
  const a = await createSnapshotPreviewStore(
    await model(entries("Student A")),
    categories,
  );
  const b = await createSnapshotPreviewStore(
    await model(entries("Student B")),
    categories,
  );
  try {
    expect(await a.db.getVar("name", "same-id")).toBe("Student A");
    expect(await b.db.getVar("name", "same-id")).toBe("Student B");
    expect(await a.db.getVar("company", "same-id")).toBe("Student A");
    expect(await b.db.getVar("company", "same-id")).toBe("Student B");
    expect(
      await (await a.db.documents.get("same-id"))?.profile?.picture?.text(),
    ).toBe("Photo Student A");
    expect(
      await (await b.db.documents.get("same-id"))?.profile?.picture?.text(),
    ).toBe("Photo Student B");
    expect((await a.db.documents.get("same-id"))?.profile?.cv).toBe(
      "<p>CV Student A</p>",
    );
    expect((await b.db.cite.get("shared"))?.bib).toBe("Reference Student B");
  } finally {
    await a.db.delete();
    await b.db.delete();
  }
});

test("normal compiler warm-up cannot add default references to the snapshot", async () => {
  const { db } = await createSnapshotPreviewStore(await model(), categories);
  try {
    await db.warm();
    expect(await db.cite.toArray()).toEqual([
      { key: "shared", bib: "Reference Student A" },
    ]);
    expect(await db.getAliases("same-id")).toEqual([
      { key: "API", value: "Student A" },
    ]);
    const doc = (await db.documents.get("same-id"))!;
    expect(doc.config.statementDate).toEqual(new Date("2026-10-21"));
    expect(doc.config.intern?.validity).toEqual(new Date("2026-10-21"));
    expect(doc.config.intern?.advisor?.name).toBe("Company advisor");
  } finally {
    await db.delete();
  }
});

test("legacy snapshot without a profile never adopts the viewer or cached author variable", async () => {
  const data: Record<string, Uint8Array> = entries();
  delete data["files/profile.json"];
  const snapshot = await readSnapshot(zipSync(data), {
    kind: "local",
    filename: "legacy.hightex",
  });
  const { db } = await createSnapshotPreviewStore(snapshot, categories);
  try {
    expect((await db.documents.get("same-id"))?.profile).toBeUndefined();
    expect(await db.getVar("name", "same-id")).toBe("");
    expect(await db.getVar("cv", "same-id")).toBe("");
  } finally {
    await db.delete();
  }
});

test("unknown categories fail without opening a persistent database and external images are not used", async () => {
  const snapshot = await model();
  const databases = await indexedDB.databases();
  await expect(createSnapshotPreviewStore(snapshot, [])).rejects.toThrow(
    "snapshot_category_missing",
  );
  expect(await indexedDB.databases()).toEqual(databases);
  const data = entries();
  data["files/chapters/1.json"] = encode([
    { type: "image", attrs: { src: "https://remote.test/image.png" } },
  ]);
  const { db } = await createSnapshotPreviewStore(
    await model(data),
    categories,
  );
  try {
    expect((await db.chapters.get("same-id.1"))?.content[0].attrs?.src).toBe(
      "",
    );
  } finally {
    await db.delete();
  }
});
