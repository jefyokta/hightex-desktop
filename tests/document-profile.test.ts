import "fake-indexeddb/auto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { zipSync } from "fflate";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import { Exporter } from "../src/utils/htx/exporter";
import { HighTexImporter } from "../src/utils/import-v2";
import {
  emptyAuthorProfile,
  resolveDocumentProfile,
} from "../src/utils/document-profile";
import { readProfileEntries } from "../src/utils/htx/profile";

const category: Category = {
  id: 1,
  name: "KP",
  variant: "intern",
  chapters: [{ chapter: "1", title: "Pendahuluan" }],
};
const makeDocument = (id: string, name?: string): HighTexDocument => ({
  id,
  title: `Document ${id}`,
  altTitle: "English title",
  category: "1",
  keywords: { indonesian: ["lokal"], english: ["local"] },
  config: {},
  profile: name
    ? { ...emptyAuthorProfile(), name, nim: `nim-${id}` }
    : undefined,
});

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const db = HighTexDB.getInstance();

beforeAll(async () => {
  const fakeWindow = Object.assign(new EventTarget(), {
    config: { get: () => ({ language: "en" }) },
    hightex: { categories: async () => [category] },
    profile: {
      get: () => {
        throw new Error("Rendering/import must not read the viewer profile");
      },
      picture: () => {
        throw new Error("Rendering/import must not read the viewer photo");
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  await db.open();
});

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

afterAll(async () => {
  await db.delete();
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("document authors and variables", () => {
  test("two authors and custom variables stay separate across reopening the database", async () => {
    await db.documents.bulkPut([
      makeDocument("a", "Student A"),
      makeDocument("b", "Student B"),
    ]);
    await db.setVar("location", "Company A", "a");
    await db.setVar("location", "Company B", "b");
    await db.setVar("name", "Advisor default", "global");
    db.close();
    await db.open();

    expect(await db.getVar("name", "a")).toBe("Student A");
    expect(await db.getVar("name", "b")).toBe("Student B");
    expect(await db.getVar("location", "a")).toBe("Company A");
    expect(await db.getVar("location", "b")).toBe("Company B");
    expect(
      (await db.getVars("a")).filter((variable) => variable.name === "name"),
    ).toEqual([{ name: "name", value: "Student A", documentId: "a" }]);
  });

  test("missing author never falls back to local/global viewer data, including legacy CV", async () => {
    const document = makeDocument("old");
    await db.documents.put(document);
    await db.setVar("name", "Advisor D", "global");
    await db.setVar("cv", "Advisor CV", "global");
    await db.setVar("name", "Old cached identity", "old");
    expect(await db.getVar("name", "old")).toBe("");
    expect(await db.getVar("cv", "old")).toBe("");
    expect(resolveDocumentProfile(document)).toMatchObject({
      name: "",
      cv: "",
      incomplete: true,
    });
    expect((await db.documents.get("old"))?.profile).toBeUndefined();
  });

  test("local variables override globals without changing the other document", async () => {
    await db.setVar("location", "Default", "global");
    await db.setVar("location", "A", "a");
    expect(await db.getVar("location", "a")).toBe("A");
    expect(await db.getVar("location", "b")).toBe("Default");
    await db.deleteVar("location", "a");
    expect(await db.getVar("location", "a")).toBe("Default");
  });

  test("saving stale settings preserves a newly edited CV and photo", async () => {
    const a = makeDocument("a", "Student A");
    const b = makeDocument("b", "Student B");
    await db.documents.bulkPut([a, b]);
    await db.updateProfile("a", {
      cv: "CV A",
      picture: new Blob(["photo A"], { type: "image/webp" }),
    });
    await db.updateDocument(a, { ...a.profile!, name: "Updated A" });

    const saved = (await db.documents.get("a"))!;
    expect(saved.profile?.name).toBe("Updated A");
    expect(saved.profile?.cv).toBe("CV A");
    expect(await saved.profile?.picture?.text()).toBe("photo A");
    expect((await db.documents.get("b"))?.profile).toEqual(b.profile);
  });

  test("renaming from a stale document does not restore an old author or deleted photo", async () => {
    const old = makeDocument("a", "Old A");
    old.profile!.picture = new Blob(["old photo"], { type: "image/webp" });
    await db.documents.put(old);
    await db.updateProfile("a", { name: "Updated A", picture: undefined });
    await db.updateDocument({ ...old, title: "Renamed" });
    const saved = (await db.documents.get("a"))!;
    expect(saved.title).toBe("Renamed");
    expect(saved.profile?.name).toBe("Updated A");
    expect(saved.profile?.picture).toBeUndefined();
  });

  test("concurrent CV/photo writes retain both changes and preserve author identity", async () => {
    await db.documents.put(makeDocument("a", "Student A"));
    await Promise.all([
      db.updateProfile("a", { cv: "New CV" }),
      db.updateProfile("a", {
        picture: new Blob(["photo"], { type: "image/webp" }),
      }),
    ]);
    const profile = (await db.documents.get("a"))?.profile;
    expect(profile?.name).toBe("Student A");
    expect(profile?.cv).toBe("New CV");
    expect(await profile?.picture?.text()).toBe("photo");
  });
});

describe("portable author profile", () => {
  test("export/import preserves author, CV/photo, KP settings and both keyword languages", async () => {
    const original = makeDocument("kp", "Student A");
    original.profile = {
      ...original.profile!,
      advisorName: "Campus advisor",
      advisorNip: "campus-1",
      cv: "<p>CV A</p>",
      picture: new Blob(["photo A"], { type: "image/webp" }),
    };
    original.config = {
      kaprodi: { name: "Head", nip: "head-1" },
      intern: {
        onsite_at: "Company A",
        advisor: { name: "Company advisor", nip: "company-1" },
        validity: new Date("2026-10-21"),
      },
    };
    await db.documents.put(original);
    await db.chapters.put({
      id: "kp.1",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Student content" }],
        },
      ],
    });
    await db.setVar("location", "Company A", "kp");

    const { buffer } = await new Exporter("kp").buildExport();
    await db.documents.delete("kp");
    const importer = await HighTexImporter.create(
      new File([new Uint8Array(buffer)], "kp.hightex"),
      "/test/kp.hightex",
    );
    const imported = await importer.import();
    expect(imported.profile?.name).toBe("Student A");
    expect(imported.profile?.cv).toBe("<p>CV A</p>");
    expect(await imported.profile?.picture?.text()).toBe("photo A");
    expect(imported.profile?.advisorName).toBe("Campus advisor");
    expect(imported.config.intern).toEqual(original.config.intern);
    expect(imported.config.kaprodi).toEqual(original.config.kaprodi);
    expect(imported.keywords).toEqual(original.keywords);
    expect(await db.getVar("location", "kp")).toBe("Company A");
    expect(resolveDocumentProfile(imported)).toMatchObject({
      name: "Student A",
      incomplete: false,
    });
  });

  test("importing an old package removes a previous author instead of preserving a stale one", async () => {
    await db.documents.put(makeDocument("old", "Previous author"));
    const { entries } = await new Exporter("old").buildExport();
    delete entries["files/profile.json"];
    delete entries["files/assets/profile.webp"];
    const file = new File([new Uint8Array(zipSync(entries))], "old.hightex");
    const importer = await HighTexImporter.create(file, "/test/old.hightex");
    const imported = await importer.import();
    expect(imported.profile).toBeUndefined();
    expect((await db.documents.get("old"))?.profile).toBeUndefined();
    expect(await db.getVar("name", "old")).toBe("");
  });

  test("legacy manifest profile is read and malformed profile fails before changing stored data", async () => {
    expect(
      readProfileEntries({}, { ...emptyAuthorProfile(), name: "Legacy A" })
        ?.name,
    ).toBe("Legacy A");
    await db.documents.put(makeDocument("a", "Student A"));
    const { entries } = await new Exporter("a").buildExport();
    entries["files/profile.json"] = new TextEncoder().encode('{"name":42}');
    const importer = await HighTexImporter.create(
      new File([new Uint8Array(zipSync(entries))], "bad.hightex"),
      "/test/bad.hightex",
    );
    await expect(importer.import()).rejects.toThrow();
    expect((await db.documents.get("a"))?.profile?.name).toBe("Student A");
  });
});

test("v1 migration preserves old records as backup without assigning the global profile to old documents", async () => {
  const name = `profile-migration-${crypto.randomUUID()}`;
  const old = new Dexie(name);
  old.version(1).stores({
    documents: "id",
    chapters: "id",
    cite: "key, documentId",
    chapterGraphs: "id",
    images: "id, documentId",
    variables: "name, documentId",
    aliases: "key, documentId",
    file: "filePath, documentId",
  });
  const document = makeDocument("old");
  document.config.intern = { onsite_at: "Existing company" };
  await old.table("documents").put(document);
  await old.table("variables").bulkPut([
    { documentId: "global", name: "name", value: "Advisor D" },
    { documentId: "old", name: "custom", value: "keep me" },
  ]);
  old.close();

  const migrated = new HighTexDB(name);
  try {
    await migrated.open();
    expect(await migrated.table("variables").count()).toBe(2);
    expect(await migrated.getVar("custom", "old")).toBe("keep me");
    expect(await migrated.getVar("name", "old")).toBe("");
    expect((await migrated.documents.get("old"))?.profile).toBeUndefined();
    expect((await migrated.documents.get("old"))?.config).toEqual(
      document.config,
    );
    await migrated.setVar("custom", "second value", "other");
    migrated.close();
    await migrated.open();
    expect(await migrated.getVar("custom", "old")).toBe("keep me");
    expect(await migrated.getVar("custom", "other")).toBe("second value");
  } finally {
    await migrated.delete();
  }
});
