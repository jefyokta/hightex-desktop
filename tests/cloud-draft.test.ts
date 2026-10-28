import "fake-indexeddb/auto";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { afterAll, beforeEach, expect, test } from "bun:test";
import { zipSync, strToU8, unzipSync, strFromU8 } from "fflate";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import {
  captureDraft,
  draftRevision,
  installCloudDraft,
  prepareCloudDraft,
  rollbackCloudDraft,
} from "../src/cloud/draft-transfer";
import { emptyAuthorProfile } from "../src/utils/document-profile";
import { writeProfileEntries } from "../src/utils/htx/profile";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const db = new HighTexDB(`cloud-draft-${crypto.randomUUID()}`);
const categories = [
  { id: 1, name: "TA", variant: "thesis", chapters: [] },
] as Category[];
const local: HighTexDocument = {
  id: "draft",
  title: "My local edits",
  altTitle: "Local",
  category: "1",
  config: {},
  keywords: { indonesian: [], english: [] },
  profile: { ...emptyAuthorProfile(), name: "Local author" },
};
const archive = async (name = "Student A") =>
  zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        schema_version: 2,
        version: 2,
        format: "json",
        document: {
          id: "shared",
          title: { id: name },
          category: "1",
          keywords: { id: [], en: [] },
        },
      }),
    ),
    "files/config.json": strToU8(
      JSON.stringify({
        intern: {
          onsite_at: "Company",
          advisor: { name: "Onsite" },
          validity: "2026-10-21T00:00:00Z",
        },
      }),
    ),
    "files/chapters/1.json": strToU8(
      JSON.stringify([
        {
          type: "paragraph",
          content: [
            { type: "image", attrs: { src: "same-image" } },
            { type: "cite", attrs: { cite: "same-ref|missing" } },
          ],
        },
      ]),
    ),
    "files/assets/images/same-image.webp": strToU8(`image ${name}`),
    "files/assets/references.json": strToU8(
      JSON.stringify({ "same-ref": `@book{test,title={${name}}}` }),
    ),
    "files/assets/variables.json": strToU8(
      JSON.stringify([{ name: "company", value: name }]),
    ),
    "files/assets/aliases.json": strToU8(
      JSON.stringify([
        { key: "shared.caption", value: "Picture", documentId: "shared" },
      ]),
    ),
    ...(await writeProfileEntries({
      ...emptyAuthorProfile(),
      name,
      cv: `<p>${name} CV</p>`,
      picture: new Blob([name], { type: "image/webp" }),
    })),
  });

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});
afterAll(async () => {
  await db.delete();
});

test("stage validation does not write; unknown category and malformed aliases fail without mutations", async () => {
  await db.documents.put(local);
  const before = await captureDraft(db, local.id);
  await prepareCloudDraft(await archive(), "draft", categories);
  expect(await captureDraft(db, "draft")).toEqual(before);
  await expect(
    prepareCloudDraft(await archive(), "draft", []),
  ).rejects.toMatchObject({ code: "unknown_category" });
  const entries = unzipSync(await archive());
  entries["files/assets/aliases.json"] = strToU8('[{"key":5}]');
  await expect(
    prepareCloudDraft(zipSync(entries), "draft", categories),
  ).rejects.toMatchObject({ code: "invalid_archive" });
  expect(await captureDraft(db, "draft")).toEqual(before);
});

test("atomic replacement removes stale rows and preserves profile, KP dates, variables and aliases", async () => {
  await db.documents.put(local);
  await db.chapters.bulkPut([
    { id: "draft.deleted", content: [{ type: "paragraph" }] },
    { id: "draft-other.1", content: [{ type: "paragraph" }] },
  ]);
  await db.documentVariables.put({
    name: "deleted",
    value: "old",
    documentId: "draft",
  });
  const before = await captureDraft(db, "draft");
  const prepared = await prepareCloudDraft(
    await archive(),
    "draft",
    categories,
  );
  await installCloudDraft(db, prepared, before);
  const result = await captureDraft(db, "draft");
  expect(result.document?.profile?.name).toBe("Student A");
  expect(await result.document?.profile?.picture?.text()).toBe("Student A");
  expect(result.document?.config.intern?.validity).toEqual(
    new Date("2026-10-21T00:00:00Z"),
  );
  expect(result.chapters.map((chapter) => chapter.id)).toEqual(["draft.1"]);
  expect(await db.chapters.get("draft-other.1")).toBeDefined();
  expect(result.variables).toEqual([
    { name: "company", value: "Student A", documentId: "draft" },
  ]);
  expect(result.aliases[0].key).toBe("draft.caption");
});

test("two imports with colliding image/citation IDs do not overwrite each other or unrelated global references", async () => {
  await db.cite.put({ key: "same-ref", bib: "Original global" });
  for (const [id, name] of [
    ["a", "Student A"],
    ["b", "Student B"],
  ]) {
    const prepared = await prepareCloudDraft(
      await archive(name),
      id,
      categories,
    );
    await installCloudDraft(db, prepared, await captureDraft(db, id));
  }
  const [a, b] = await Promise.all([
    captureDraft(db, "a"),
    captureDraft(db, "b"),
  ]);
  const aNodes = a.chapters[0].content[0].content!;
  const bNodes = b.chapters[0].content[0].content!;
  expect(aNodes[0].attrs?.src).not.toBe(bNodes[0].attrs?.src);
  expect(await (await db.images.get(aNodes[0].attrs!.src))!.blob.text()).toBe(
    "image Student A",
  );
  expect(await (await db.images.get(bNodes[0].attrs!.src))!.blob.text()).toBe(
    "image Student B",
  );
  expect(
    (await db.cite.get(aNodes[1].attrs!.cite.split("|")[0]))?.bib,
  ).toContain("Student A");
  expect(aNodes[1].attrs!.cite.split("|")[1]).not.toBe("missing");
  expect((await db.cite.get("same-ref"))?.bib).toBe("Original global");
});

test("concurrent local edits abort replacement without removing any old content", async () => {
  await db.documents.put(local);
  const before = await captureDraft(db, "draft");
  const prepared = await prepareCloudDraft(
    await archive(),
    "draft",
    categories,
  );
  await db.chapters.put({
    id: "draft.new",
    content: [{ type: "text", text: "new edit" }],
  });
  await expect(installCloudDraft(db, prepared, before)).rejects.toMatchObject({
    code: "local_changed",
  });
  expect((await db.documents.get("draft"))?.title).toBe(local.title);
  expect(await db.chapters.get("draft.new")).toBeDefined();
});

test("same-size image edits are detected before replacing a draft", async () => {
  await db.documents.put(local);
  await db.images.put({
    id: "old",
    blob: new Blob(["A"], { type: "image/webp" }),
    documentId: "draft",
    createdAt: 0,
  });
  const before = await captureDraft(db, "draft");
  const prepared = await prepareCloudDraft(
    await archive(),
    "draft",
    categories,
  );
  await db.images.update("old", {
    blob: new Blob(["B"], { type: "image/webp" }),
  });
  await expect(installCloudDraft(db, prepared, before)).rejects.toMatchObject({
    code: "local_changed",
  });
  expect(await (await db.images.get("old"))?.blob.text()).toBe("B");
});

test("replacement preserves old image bytes referenced by another draft", async () => {
  await db.documents.put(local);
  await db.images.put({
    id: "shared-old",
    blob: new Blob(["shared bytes"], { type: "image/webp" }),
    documentId: "draft",
    createdAt: 0,
  });
  await db.chapters.put({
    id: "other.1",
    content: [{ type: "image", attrs: { src: "shared-old" } }],
  });
  const before = await captureDraft(db, "draft");
  const prepared = await prepareCloudDraft(
    await archive(),
    "draft",
    categories,
  );
  await installCloudDraft(db, prepared, before);
  expect(await (await db.images.get("shared-old"))?.blob.text()).toBe(
    "shared bytes",
  );
  await rollbackCloudDraft(db, prepared, before);
  expect(await draftRevision(await captureDraft(db, "draft"))).toBe(
    await draftRevision(before),
  );
});

test("inline WebP images become isolated assets instead of looking up another draft's image", async () => {
  const entries = unzipSync(await archive());
  entries["files/chapters/1.json"] = strToU8(
    JSON.stringify([
      {
        type: "image",
        attrs: { src: `data:image/webp;base64,${btoa("inline image")}` },
      },
    ]),
  );
  const prepared = await prepareCloudDraft(
    zipSync(entries),
    "inline",
    categories,
  );
  const imageId = prepared.state.chapters[0].content[0].attrs!.src;
  expect(imageId).toStartWith("cloud_inline_");
  expect(
    await prepared.state.images
      .find((image) => image.id === imageId)
      ?.blob.text(),
  ).toBe("inline image");
});

test("failed write rolls back document, chapters, assets and variables in the same transaction", async () => {
  await db.documents.put(local);
  const before = await captureDraft(db, "draft");
  const prepared = await prepareCloudDraft(
    await archive(),
    "draft",
    categories,
  );
  prepared.state.variables.push({
    name: undefined,
    value: "bad",
    documentId: "draft",
  } as unknown as Variable);
  await expect(installCloudDraft(db, prepared, before)).rejects.toThrow();
  expect(await draftRevision(await captureDraft(db, "draft"))).toBe(
    await draftRevision(before),
  );
  expect(await db.images.count()).toBe(0);
});

test("failed binding acceptance can restore previous state or remove a new copy", async () => {
  for (const existing of [false, true]) {
    if (existing) await db.documents.put(local);
    const before = await captureDraft(db, "draft");
    const prepared = await prepareCloudDraft(
      await archive(),
      "draft",
      categories,
    );
    await installCloudDraft(db, prepared, before);
    await rollbackCloudDraft(db, prepared, before);
    expect(await draftRevision(await captureDraft(db, "draft"))).toBe(
      await draftRevision(before),
    );
  }
});

test("rollback preserves newer edits and legacy packages do not retain a stale author", async () => {
  await db.documents.put(local);
  const before = await captureDraft(db, "draft");
  const entries = unzipSync(await archive());
  delete entries["files/profile.json"];
  delete entries["files/assets/profile.webp"];
  const prepared = await prepareCloudDraft(
    zipSync(entries),
    "draft",
    categories,
  );
  await installCloudDraft(db, prepared, before);
  expect((await db.documents.get("draft"))?.profile).toBeUndefined();
  await db.documents.update("draft", { title: "New edit" });
  await expect(rollbackCloudDraft(db, prepared, before)).rejects.toMatchObject({
    code: "local_changed",
  });
  expect((await db.documents.get("draft"))?.title).toBe("New edit");
});

test("web v1 import is rejected before changing any draft state", async () => {
  const entries = unzipSync(await archive());
  const desktop = JSON.parse(strFromU8(entries["files/chapters/1.json"]));
  const web = zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        format: "hightex",
        schema_version: 1,
        version: 2,
        document: {
          id: "server-doc",
          title: { main: "Web" },
          category: { name: "TA" },
          keywords: [],
        },
        author: { name: "Recorded author" },
        structure: { chapters: [{ id: "1", file: "data/1.json" }] },
      }),
    ),
    "data/1.json": strToU8(JSON.stringify(desktop)),
  });
  const before = await captureDraft(db, "copy");
  await expect(
    prepareCloudDraft(web, "copy", categories),
  ).rejects.toMatchObject({ code: "unsupported_content" });
  expect(await captureDraft(db, "copy")).toEqual(before);
});
