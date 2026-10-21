import "fake-indexeddb/auto";
import { expect, test } from "bun:test";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
import { HighTexDB } from "../src/editor/storage/hightex-db";
import {
  accountProfilePatch,
  applyAccountProfile,
} from "../src/account/apply-profile";
const data: AccountProfileData = {
  session: { accountId: "12", sessionId: "a", serverUrl: "http://local/api/" },
  name: "Server Student",
  nim: "A001",
  email: "a@test",
  roles: ["student"],
  cv: null,
  picturePath: null,
};
const makeDoc = (id: string): HighTexDocument => ({
  id,
  title: id,
  altTitle: "",
  category: "1",
  keywords: { indonesian: [], english: [] },
  config: {},
  profile: {
    name: "Local Student",
    nim: "LOCAL",
    advisorName: "Advisor",
    advisorNip: "NIP",
    cv: "Manual CV",
  },
});
const guards = {
  current: async () => {},
  locked: async () => false,
  editor: async () => false,
};
test("applying selected account fields preserves manual CV when the server value is null", async () => {
  const db = new HighTexDB(`apply-${crypto.randomUUID()}`);
  try {
    const before = makeDoc("a");
    await db.documents.bulkPut([before, makeDoc("b")]);
    const patch = accountProfilePatch(data, ["name", "cv", "picture"]);
    expect(patch).toEqual({ name: "Server Student" });
    await applyAccountProfile(db, before, patch, guards);
    expect((await db.documents.get("a"))?.profile).toEqual({
      ...before.profile!,
      name: "Server Student",
    });
    expect(await db.documents.get("b")).toEqual(makeDoc("b"));
  } finally {
    await db.delete();
  }
});
test("explicit empty CV can be applied, but unchecked fields never overwrite document data", () => {
  expect(accountProfilePatch({ ...data, cv: "" }, ["cv"])).toEqual({ cv: "" });
  expect(accountProfilePatch({ ...data, cv: "New CV" }, [])).toEqual({});
});
test("cloud-linked documents and open editors are blocked before applying", async () => {
  const db = new HighTexDB(`apply-${crypto.randomUUID()}`);
  try {
    const before = makeDoc("a");
    await db.documents.put(before);
    for (const guard of [
      { ...guards, locked: async () => true },
      { ...guards, editor: async () => true },
    ]) {
      await expect(
        applyAccountProfile(db, before, { name: "New" }, guard),
      ).rejects.toThrow();
      expect(await db.documents.get("a")).toEqual(before);
    }
  } finally {
    await db.delete();
  }
});
test("a profile edited after review cannot be replaced using a stale comparison", async () => {
  const db = new HighTexDB(`apply-${crypto.randomUUID()}`);
  try {
    const before = makeDoc("a");
    await db.documents.put({
      ...before,
      profile: { ...before.profile!, cv: "Newer manual CV" },
    });
    await expect(
      applyAccountProfile(db, before, { cv: "Old account CV" }, guards),
    ).rejects.toThrow("document_changed");
    expect((await db.documents.get("a"))?.profile?.cv).toBe("Newer manual CV");
  } finally {
    await db.delete();
  }
});
test("a session change detected after preflight prevents all document writes", async () => {
  const db = new HighTexDB(`apply-${crypto.randomUUID()}`);
  try {
    const before = makeDoc("a");
    await db.documents.put(before);
    let calls = 0;
    await expect(
      applyAccountProfile(
        db,
        before,
        { name: "Other account" },
        {
          ...guards,
          current: async () => {
            if (++calls === 2) throw Error("session_changed");
          },
        },
      ),
    ).rejects.toThrow("session_changed");
    expect(await db.documents.get("a")).toEqual(before);
  } finally {
    await db.delete();
  }
});
