import "fake-indexeddb/auto";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import { downloadCloudDocument, type CloudDownloadTarget } from "../src/cloud/document-download";
import { captureDraft } from "../src/cloud/draft-transfer";
import { emptyAuthorProfile } from "../src/utils/document-profile";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const db = new HighTexDB(`cloud-download-${crypto.randomUUID()}`);
const getInstance = HighTexDB.getInstance;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const session: CloudSession = { sessionId: "session", accountId: "student", serverUrl: "https://fixture.invalid" };
const categories = [{ id: 1, name: "Thesis", variant: "thesis", chapters: [] }] as Category[];
const local: HighTexDocument = {
  id: "local", title: "Local draft", altTitle: "", category: "1", config: {},
  keywords: { indonesian: [], english: [] },
};
const archive = zipSync({
  "manifest.json": strToU8(JSON.stringify({
    version: 2, format: "json",
    document: { id: "remote", title: { id: "Cloud draft" }, category: "1", keywords: { id: [], en: [] } },
  })),
  "files/config.json": strToU8("{}"),
  "files/chapters/1.json": strToU8(JSON.stringify([
    { type: "paragraph", content: [{ type: "text", text: "Cloud content" }] },
  ])),
});
let accept: () => Promise<void>;
let accepted = 0;
let backups: Uint8Array[];

beforeAll(async () => {
  HighTexDB.getInstance = () => db;
  await db.open();
});

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  await db.documents.put(local);
  await db.chapters.put({
    id: "local.1", content: [{ type: "paragraph", content: [{ type: "text", text: "Unsynced local content" }] }],
  });
  accepted = 0;
  backups = [];
  accept = async () => {};
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      config: { get: () => ({ language: "en" }) },
      profile: { get: async () => emptyAuthorProfile(), picture: async () => false },
      editor: { has: async () => false },
      hightex: {
        cloud: {
          pull: async () => ({ status: "downloaded", file: archive, downloadId: "download" }),
          backup: async (_session: string, file: Uint8Array) => { backups.push(file); },
          academic: { load: async () => ({
            session, serverDocumentId: "server", author: emptyAuthorProfile(), committee: {},
          }) },
          accept: async () => { accepted++; await accept(); },
        },
      },
    }),
  });
});

afterAll(async () => {
  HighTexDB.getInstance = getInstance;
  await db.delete();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

const download = (target: CloudDownloadTarget = { kind: "latest" }, replace = true) =>
  downloadCloudDocument({
    session, serverDocumentId: "server", localDocumentId: "local", categories, target,
  }, {
    ensureCurrent: async () => {},
    confirmReplacement: async () => replace,
  });

test("cancelling replacement preserves the local draft without backup or acceptance", async () => {
  const before = await captureDraft(db, "local");
  expect(await download({ kind: "latest" }, false)).toEqual({ status: "cancelled" });
  expect(await captureDraft(db, "local")).toEqual(before);
  expect(backups).toHaveLength(0);
  expect(accepted).toBe(0);
});

test("failed acceptance restores the previous draft after backing it up", async () => {
  const before = await captureDraft(db, "local");
  accept = async () => {
    expect((await db.documents.get("local"))?.title).toBe("Cloud draft");
    throw Error("Acceptance failed");
  };
  await expect(download()).rejects.toThrow("Acceptance failed");
  expect(await captureDraft(db, "local")).toEqual(before);
  expect(backups).toHaveLength(1);
  expect(accepted).toBe(1);
});

test("failed acceptance keeps newer local edits when rollback cannot safely replace them", async () => {
  accept = async () => {
    await db.documents.update("local", { title: "Newer local edits" });
    throw Error("Acceptance failed");
  };
  const result = await download();
  expect(result.status).toBe("rollback-failed");
  expect((await db.documents.get("local"))?.title).toBe("Newer local edits");
  expect(backups).toHaveLength(1);
});

test("restoring history preserves document identity without accepting a new sync base", async () => {
  const result = await download({ kind: "restore", sha256: "history-version" });
  expect(result).toMatchObject({ status: "saved", document: { id: "local", title: "Cloud draft" } });
  expect((await db.chapters.get("local.1"))?.content[0].content?.[0].text).toBe("Cloud content");
  expect(backups).toHaveLength(1);
  expect(accepted).toBe(0);
});
