import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { strToU8, zipSync } from "fflate";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";
import { createHash } from "node:crypto";
import {
  readSnapshot,
  type SnapshotSource,
} from "../src/review/snapshot-reader";
import { SnapshotCache } from "../src/review/snapshot-cache";
import { SnapshotContent } from "../src/components/submission/snapshot-content";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import { Document } from "../src/editor/document";
import { emptyAuthorProfile } from "../src/utils/document-profile";

const encode = (value: unknown) => strToU8(JSON.stringify(value));
const session: ReviewSession = {
  serverUrl: "https://server.test/api/",
  accountId: "advisor-d",
  sessionId: "session-1",
};
const source = (
  bytes: Uint8Array,
  submissionId = "87",
  currentSession = session,
): SnapshotSource => ({
  kind: "submission",
  documentId: "server-document",
  submissionId,
  session: currentSession,
  sha256: createHash("sha256").update(bytes).digest("hex"),
});
const entries = (name = "Student A", suffix = "A") => ({
  "manifest.json": encode({
    schema_version: 2,
    format: "json",
    document: {
      id: "same-local-id",
      title: { id: `Title ${suffix}`, en: `English ${suffix}` },
      category: "1",
      keywords: { id: ["id"], en: ["en"] },
    },
  }),
  "files/profile.json": encode({
    ...emptyAuthorProfile(),
    name,
    nim: `NIM-${suffix}`,
    cv: `CV ${suffix}`,
    advisorName: `Campus ${suffix}`,
  }),
  "files/assets/profile.webp": strToU8(`photo ${suffix}`),
  "files/assets/images/shared.webp": strToU8(`image ${suffix}`),
  "files/assets/references.json": encode({
    shared: `@article{shared, author={Student ${suffix}}, title={Paper ${suffix}}, year={2026}}`,
  }),
  "files/assets/variables.json": encode([
    { name: "location", value: `Company ${suffix}` },
    { name: "name", value: "Wrong cached author" },
  ]),
  "files/config.json": encode({
    intern: {
      onsite_at: `Company ${suffix}`,
      advisor: { name: `Company advisor ${suffix}`, nip: "NIP" },
    },
  }),
  "files/chapters/1.json": encode([
    {
      type: "paragraph",
      content: [
        { type: "text", text: `Text ${suffix}`, marks: [{ type: "bold" }] },
        { type: "variable", attrs: { name: "name" } },
        { type: "variable", attrs: { name: "location" } },
      ],
    },
    { type: "image", attrs: { src: "shared", width: 300 } },
  ]),
});
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
beforeAll(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      config: { get: () => ({ language: "en" }) },
      profile: {
        get: () => {
          throw new Error("Must never read actor profile");
        },
        picture: () => {
          throw new Error("Must never read actor photo");
        },
      },
    }),
  });
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
});
afterAll(() => {
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("isolated snapshot reader and renderer", () => {
  test("two submissions sharing a local ID preserve their own authors, CV/photos, images, references and variables", async () => {
    const aFile = zipSync(entries());
    const bFile = zipSync(entries("Student B", "B"));
    const a = await readSnapshot(aFile, source(aFile));
    const b = await readSnapshot(bFile, source(bFile, "88"));
    expect(a.document.id).toBe(b.document.id);
    expect(a.variable("name")).toBe("Student A");
    expect(b.variable("name")).toBe("Student B");
    expect(a.variable("location")).toBe("Company A");
    expect(b.variable("location")).toBe("Company B");
    expect(a.document.profile?.cv).toBe("CV A");
    expect(b.document.profile?.cv).toBe("CV B");
    expect(await a.document.profile?.picture?.text()).toBe("photo A");
    expect(await b.document.profile?.picture?.text()).toBe("photo B");
    expect(await a.images.get("shared")?.text()).toBe("image A");
    expect(await b.images.get("shared")?.text()).toBe("image B");
    expect(a.references.shared).toContain("Paper A");
    expect(b.references.shared).toContain("Paper B");
    const htmlA = renderToStaticMarkup(
      <SnapshotContent
        snapshot={a}
        nodes={a.chapters[0].content}
        images={new Map([["shared", "blob:snapshot-a"]])}
      />,
    );
    const htmlB = renderToStaticMarkup(
      <SnapshotContent
        snapshot={b}
        nodes={b.chapters[0].content}
        images={new Map([["shared", "blob:snapshot-b"]])}
      />,
    );
    expect(htmlA.replace(/<[^>]*>/g, "")).toContain("Text AStudent ACompany A");
    expect(htmlB.replace(/<[^>]*>/g, "")).toContain("Text BStudent BCompany B");
    expect(htmlA).toContain('src="blob:snapshot-a"');
    expect(htmlB).not.toContain("snapshot-a");
    expect(htmlA).not.toContain("Student B");
  });

  test("reading and rendering never changes draft tables, global author variables or the active editor document", async () => {
    const db = HighTexDB.getInstance();
    await db.open();
    const previous = Document.instance;
    try {
      await db.documents.put({
        id: "advisor-draft",
        title: "Advisor own draft",
        altTitle: "",
        category: "1",
        keywords: { indonesian: [], english: [] },
        config: {},
        profile: {
          ...emptyAuthorProfile(),
          name: "Advisor D",
          cv: "Advisor CV",
        },
      });
      await db.setVar("name", "Advisor D", "global");
      await db.setVar("location", "Advisor office", "advisor-draft");
      await db.cite.put({ key: "shared", bib: "Advisor reference" });
      await db.images.put({
        id: "shared",
        documentId: "advisor-draft",
        blob: new Blob(["advisor image"]),
        createdAt: 1,
      });
      Document.instance = new Document("advisor-draft");
      const active = Document.instance;
      const before = await Promise.all(
        db.tables.map((table) => table.toArray()),
      );
      const bytes = zipSync(entries());
      const snapshot = await readSnapshot(bytes, source(bytes));
      const html = renderToStaticMarkup(
        <SnapshotContent
          snapshot={snapshot}
          nodes={snapshot.chapters[0].content}
          images={new Map()}
        />,
      );
      expect(html).toContain("Student A");
      expect(html).not.toContain("Advisor D");
      expect(Document.instance).toBe(active);
      expect(
        await Promise.all(db.tables.map((table) => table.toArray())),
      ).toEqual(before);
      expect(
        await db.images.get("shared").then((image) => image?.blob.text()),
      ).toBe("advisor image");
    } finally {
      Document.instance = previous;
      await db.delete();
    }
  });

  test("missing profile and legacy cached name never turn into the viewer identity", async () => {
    const packageEntries: Record<string, Uint8Array> = entries();
    delete packageEntries["files/profile.json"];
    const snapshot = await readSnapshot(zipSync(packageEntries), {
      kind: "local",
      filename: "old.hightex",
    });
    expect(snapshot.document.profile).toBeUndefined();
    expect(snapshot.variable("name")).toBe("");
    expect(snapshot.variable("cv")).toBe("");
  });

  test("reads web v1 snapshots even when the submission version is 2 and keywords are an empty array", async () => {
    const file = zipSync({
      "manifest.json": encode({
        format: "hightex",
        schema_version: 1,
        version: 2,
        document: {
          id: "web-document",
          title: { main: "Web title" },
          keywords: [],
        },
        author: {
          name: "Web student",
          mentors: [{ name: "Web advisor", role: "primary" }],
        },
        structure: {
          chapters: [
            { id: "1", file: "data/1.json" },
            { id: "reference", file: "data/reference.json" },
          ],
        },
      }),
      "data/1.json": encode([
        { type: "paragraph", content: [{ type: "text", text: "Web content" }] },
      ]),
      "data/reference.json": encode({ web: "Web bibliography" }),
    });
    const snapshot = await readSnapshot(file, source(file));
    expect(snapshot.document.title).toBe("Web title");
    expect(snapshot.document.profile?.name).toBe("Web student");
    expect(snapshot.document.profile?.nim).toBe("");
    expect(snapshot.document.profile?.advisorName).toBe("Web advisor");
    expect(snapshot.chapters).toHaveLength(1);
    expect(snapshot.references.web).toBe("Web bibliography");
  });

  test("accepts minimal server-supported v2 manifests without inventing author metadata", async () => {
    const file = zipSync({
      "manifest.json": encode({ version: 2 }),
      "files/chapters/1.json": encode([{ type: "paragraph" }]),
    });
    const snapshot = await readSnapshot(file, source(file));
    expect(snapshot.document.id).toBe("server-document");
    expect(snapshot.document.title).toBe("");
    expect(snapshot.document.profile).toBeUndefined();
  });

  test("input buffers and exported copies cannot mutate the frozen snapshot or its original bytes", async () => {
    const input = zipSync(entries());
    const snapshot = await readSnapshot(input, source(input));
    const originalHash = snapshot.sha256;
    input.fill(0);
    const copy = snapshot.originalFile();
    copy.fill(0);
    expect(
      createHash("sha256").update(snapshot.originalFile()).digest("hex"),
    ).toBe(originalHash);
    expect(Object.isFrozen(snapshot.document.profile)).toBe(true);
    expect(Object.isFrozen(snapshot.chapters[0].content)).toBe(true);
  });

  test("rejects corrupted archives, hash mismatches, unsupported formats and malformed content", async () => {
    await expect(
      readSnapshot(new Uint8Array([1, 2]), { kind: "local", filename: "bad" }),
    ).rejects.toThrow("invalid_archive");
    const bytes = zipSync(entries());
    const wrong = {
      ...source(bytes),
      sha256: "0".repeat(64),
    } as SnapshotSource;
    await expect(readSnapshot(bytes, wrong)).rejects.toThrow(
      "integrity_failed",
    );
    for (const version of [
      { schema_version: 999 },
      { schema_version: 2, version: 3 },
      { schema_version: 2, format: "ht" },
    ]) {
      await expect(
        readSnapshot(
          zipSync({ ...entries(), "manifest.json": encode(version) }),
          { kind: "local", filename: "bad" },
        ),
      ).rejects.toThrow("unsupported_format");
    }
    await expect(
      readSnapshot(
        zipSync({ ...entries(), "files/chapters/1.json": strToU8("{broken") }),
        { kind: "local", filename: "bad" },
      ),
    ).rejects.toThrow("invalid_content");
    await expect(
      readSnapshot(zipSync({ ...entries(), "../escape.json": encode({}) }), {
        kind: "local",
        filename: "bad",
      }),
    ).rejects.toThrow("invalid_archive");
  });

  test("preserves unknown node text, escapes markup and does not load remote images", async () => {
    const packageEntries = entries();
    packageEntries["files/chapters/1.json"] = encode([
      {
        type: "future-node",
        content: [{ type: "text", text: "<script>student text</script>" }],
      },
      { type: "image", attrs: { src: "https://remote.test/tracker.png" } },
    ]);
    const snapshot = await readSnapshot(zipSync(packageEntries), {
      kind: "local",
      filename: "future.hightex",
    });
    const html = renderToStaticMarkup(
      <SnapshotContent
        snapshot={snapshot}
        nodes={snapshot.chapters[0].content}
        images={new Map()}
      />,
    );
    expect(snapshot.unsupportedNodes).toContain("future-node");
    expect(html).toContain("&lt;script&gt;student text&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('src="https://remote.test');
  });

  test("rejects oversized ZIP entries before decompression and deeply nested JSON", async () => {
    const file = zipSync(entries());
    const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
    for (let offset = 0; offset < file.length - 28; offset++) {
      if (view.getUint32(offset, true) === 0x02014b50) {
        view.setUint32(offset + 24, 129 * 1024 * 1024, true);
        break;
      }
    }
    await expect(
      readSnapshot(file, { kind: "local", filename: "oversized.hightex" }),
    ).rejects.toThrow("too_large");
    let nested: unknown = "value";
    for (let level = 0; level < 110; level++) nested = { child: nested };
    await expect(
      readSnapshot(
        zipSync({ ...entries(), "files/config.json": encode(nested) }),
        { kind: "local", filename: "deep.hightex" },
      ),
    ).rejects.toThrow("too_large");
  });

  test("citation keys shared by two students are resolved from each snapshot", async () => {
    const first = entries("Student A", "A");
    const second = entries("Student B", "B");
    first["files/assets/references.json"] = encode({
      shared: "@article{shared, author={ALPHA}, title={First}, year={2026}}",
    });
    second["files/assets/references.json"] = encode({
      shared: "@article{shared, author={BRAVO}, title={Second}, year={2026}}",
    });
    const nodes = [
      {
        type: "paragraph",
        content: [{ type: "cite", attrs: { cite: "shared" } }],
      },
    ];
    first["files/chapters/1.json"] = encode(nodes);
    second["files/chapters/1.json"] = encode(nodes);
    const a = await readSnapshot(zipSync(first), {
      kind: "local",
      filename: "a.hightex",
    });
    const b = await readSnapshot(zipSync(second), {
      kind: "local",
      filename: "b.hightex",
    });
    const htmlA = renderToStaticMarkup(
      <SnapshotContent
        snapshot={a}
        nodes={a.chapters[0].content}
        images={new Map()}
      />,
    );
    const htmlB = renderToStaticMarkup(
      <SnapshotContent
        snapshot={b}
        nodes={b.chapters[0].content}
        images={new Map()}
      />,
    );
    expect(htmlA).toContain("ALPHA");
    expect(htmlA).not.toContain("BRAVO");
    expect(htmlB).toContain("BRAVO");
  });
});

test("snapshot cache separates versions and clears when account, token session or server changes", async () => {
  const cache = new SnapshotCache();
  const bytes = zipSync(entries());
  const a = await readSnapshot(bytes, source(bytes));
  const b = await readSnapshot(bytes, source(bytes, "88"));
  cache.put(a);
  cache.put(b);
  const download: SubmissionSnapshot = {
    session,
    documentId: "server-document",
    submissionId: "87",
    sha256: a.sha256,
    file: bytes,
  };
  expect(cache.get(download)).toBe(a);
  expect(cache.get({ ...download, submissionId: "88" })).toBe(b);
  for (const current of [
    { ...session, accountId: "other" },
    { ...session, sessionId: "new-session" },
    { ...session, serverUrl: "https://other.test/api/" },
  ]) {
    cache.put(a);
    expect(cache.get({ ...download, session: current })).toBeUndefined();
    expect(cache.get(download)).toBeUndefined();
  }
});
