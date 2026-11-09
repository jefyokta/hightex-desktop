import "fake-indexeddb/auto";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import { Exporter } from "../src/utils/htx/exporter";
import { archiveSha256 } from "../src/utils/htx/import-model";
import {
  createDocumentBranch,
  mergeDocumentBranch,
} from "../src/editor/storage/document-branches";
import {
  emptyAuthorProfile,
  invalidateWorkspaceAuthorProfile,
} from "../src/utils/document-profile";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const db = HighTexDB.getInstance();
let picture: Uint8Array | false = false;
let profile = {
  ...emptyAuthorProfile(),
  name: "Writer",
  nim: "001",
  isCloud: false,
};
const content = (text: string) => [
  { type: "paragraph", content: [{ type: "text", text }] },
];
beforeAll(async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      hightex: {
        categories: async () => [
          {
            id: 1,
            name: "Thesis",
            variant: "thesis",
            chapters: [{ chapter: "1", title: "Introduction" }],
          },
        ],
      },
      profile: { get: async () => profile, picture: async () => picture },
      editor: { has: async () => false },
    }),
  });
  await db.open();
});
beforeEach(async () => {
  picture = false;
  await Promise.all(db.tables.map((table) => table.clear()));
  profile = {
    ...emptyAuthorProfile(),
    name: "Writer",
    nim: "001",
    isCloud: false,
  };
  invalidateWorkspaceAuthorProfile();
  await db.documents.put({
    id: "main",
    title: "Main title",
    altTitle: "",
    category: "1",
    config: {},
    keywords: { indonesian: [], english: [] },
  });
  await db.chapters.put({ id: "main.1", content: content("Original content") });
});
afterAll(async () => {
  await db.delete();
  invalidateWorkspaceAuthorProfile();
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});
test("a workspace profile edit does not make an unchanged Main conflict with its branch", async () => {
  picture = new Uint8Array([1, 2, 3]);
  const branch = await createDocumentBranch("main", "Revision");
  await db.chapters.put({
    id: branch.id + ".1",
    content: content("Revised content"),
  });
  profile = {
    ...profile,
    name: "Updated writer",
    cv: "Updated global CV",
    advisorName: "Updated global advisor",
  };
  picture = new Uint8Array([4, 5, 6]);
  invalidateWorkspaceAuthorProfile();
  await mergeDocumentBranch(branch.id);
  expect(JSON.stringify((await db.chapters.get("main.1"))?.content)).toContain(
    "Revised content",
  );
});
test.each(["title", "content"])(
  "a changed Main %s still prevents branch merge",
  async (change) => {
    const branch = await createDocumentBranch("main", "Revision");
    if (change === "title")
      await db.documents.update("main", { title: "Changed title" });
    else
      await db.chapters.put({
        id: "main.1",
        content: content("Changed main content"),
      });
    await expect(mergeDocumentBranch(branch.id)).rejects.toThrow();
    expect((await db.documents.get("main"))?.title).toBe(
      change === "title" ? "Changed title" : "Main title",
    );
  },
);
test("a changed cloud document advisor still prevents branch merge", async () => {
  profile = { ...profile, isCloud: true };
  invalidateWorkspaceAuthorProfile();
  await db.documents.update("main", {
    profile: { ...emptyAuthorProfile(), advisorName: "Original advisor" },
  });
  const branch = await createDocumentBranch("main", "Revision");
  await db.documents.update("main", {
    profile: { ...emptyAuthorProfile(), advisorName: "Changed advisor" },
  });
  await expect(mergeDocumentBranch(branch.id)).rejects.toThrow();
});

test.each([false, true])(
  "legacy archive revisions preserve conflicts after a profile change (main changed: %s)",
  async (changed) => {
    picture = new Uint8Array([1, 2, 3]);
    const baseline = await new Exporter("main").buildExport();
    const branch = await createDocumentBranch("main", "Legacy revision");
    await db.documents.update(branch.id, {
      parentRevision: await archiveSha256(baseline.buffer),
    });
    await db.chapters.put({
      id: branch.id + ".1",
      content: content("Revised legacy content"),
    });
    profile = { ...profile, name: "New global author", cv: "New global CV" };
    picture = new Uint8Array([4, 5, 6]);
    invalidateWorkspaceAuthorProfile();
    if (changed) {
      await db.documents.update("main", { title: "Changed main title" });
      await expect(mergeDocumentBranch(branch.id)).rejects.toThrow();
      expect((await db.documents.get("main"))?.title).toBe(
        "Changed main title",
      );
    } else {
      await mergeDocumentBranch(branch.id);
      expect(
        JSON.stringify((await db.chapters.get("main.1"))?.content),
      ).toContain("Revised legacy content");
      expect((await db.documents.get(branch.id))?.parentRevision).toStartWith(
        "document-v1:",
      );
    }
  },
);

test.each([false, true])(
  "legacy cloud revision restores only global identity (academic changed: %s)",
  async (changed) => {
    profile = { ...profile, isCloud: true };
    invalidateWorkspaceAuthorProfile();
    await db.documents.update("main", {
      profile: { ...emptyAuthorProfile(), advisorName: "Original advisor" },
    });
    const baseline = await new Exporter("main").buildExport();
    const branch = await createDocumentBranch("main", "Cloud legacy revision");
    await db.documents.update(branch.id, {
      parentRevision: await archiveSha256(baseline.buffer),
    });
    profile = { ...profile, name: "Changed global author" };
    invalidateWorkspaceAuthorProfile();
    if (changed) {
      await db.documents.update("main", {
        profile: {
          ...emptyAuthorProfile(),
          advisorName: "New academic advisor",
        },
      });
      await expect(mergeDocumentBranch(branch.id)).rejects.toThrow();
    } else {
      await mergeDocumentBranch(branch.id);
      expect((await db.documents.get("main"))?.profile?.advisorName).toBe(
        "Original advisor",
      );
    }
  },
);
