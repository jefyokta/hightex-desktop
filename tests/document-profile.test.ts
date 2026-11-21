import { contentFingerprint } from "../src/utils/htx/content-fingerprint";
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
import { zipSync, unzipSync, strFromU8 } from "fflate";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import { Exporter } from "../src/utils/htx/exporter";
import { HighTexImporter } from "../src/utils/import-v2";
import { DocumentFileSource } from "../src/editor/document/file-source";
import {
  emptyAuthorProfile,
  resolveDocumentProfile,
  getAuthorDetails,
  normalizeAuthorProfile,
  invalidateWorkspaceAuthorProfile,
} from "../src/utils/document-profile";
import { readProfileEntries } from "../src/utils/htx/profile";
import { captureDraft } from "../src/utils/htx/draft-transfer";
import { migrateDocumentCommittee } from "../src/utils/document-committee";
import { parseHighTexV2 } from "@hightex/importer";
import { SchemaWritter } from "../src/utils/htx/schema/schema-writter";
import { readDocumentSnapshot } from "../src/editor/storage/document-snapshot";
import {
  documentRenderModel,
  documentRenderFingerprint,
} from "../src/editor/document/render-model";

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
let workspace: AuthorProfile = emptyAuthorProfile();
const setWorkspace = (profile: AuthorProfile) => {
  workspace = profile;
  invalidateWorkspaceAuthorProfile();
};

beforeAll(async () => {
  const fakeWindow = Object.assign(new EventTarget(), {
    config: { get: () => ({ language: "en" }) },
    hightex: { categories: async () => [category] },
    profile: {
      get: async () => ({ ...workspace, isCloud: false }),
      picture: async () =>
        workspace.picture
          ? new Uint8Array(await workspace.picture.arrayBuffer())
          : false,
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  await db.open();
});

beforeEach(async () => {
  setWorkspace(emptyAuthorProfile());
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe("file-backed opening", () => {
  let source: Uint8Array;
  let reads: number;
  let unavailable: boolean;
  let opened: Array<[string, string | undefined]>;

  beforeEach(() => {
    reads = 0;
    unavailable = false;
    opened = [];
    Object.assign(window, {
      editor: {
        sourceFile: async (_id: string, path?: string) => path,
        open: async (id: string, path?: string) => { opened.push([id, path]); },
      },
    });
    window.hightex.readFile = async () => {
      reads++;
      if (unavailable) throw Error("File moved");
      return Buffer.from(source);
    };
  });

  async function storedFile(id = "file-document") {
    await db.documents.put({ ...makeDocument(id), file: "/source.hightex" });
    await db.chapters.put({
      id: `${id}.1`,
      content: [{ type: "paragraph", content: [{ type: "text", text: "From disk" }] }],
    });
    source = (await new Exporter(id).buildExport()).buffer;
    return id;
  }

  test("opening only routes to the editor, leaving an active draft intact", async () => {
    const id = await storedFile();
    const file = new File([new Uint8Array(source)], "source.hightex");
    await db.documents.update(id, { title: "Editing now" });
    const before = await captureDraft(db, id);
    await (await HighTexImporter.create(file, "/source.hightex")).open();
    expect(await captureDraft(db, id)).toEqual(before);
    await db.documents.delete(id);
    await (await HighTexImporter.create(file, "/source.hightex")).open();
    expect(await db.documents.get(id)).toBeUndefined();
    expect(opened).toEqual([[id, "/source.hightex"], [id, "/source.hightex"]]);
  });

  test("disk wins while a different autosave is recoverable with its assets", async () => {
    const id = await storedFile();
    const files = new DocumentFileSource();
    await files.saved(id, source);
    await db.documents.update(id, { title: "Unsaved title" });
    await db.chapters.put({
      id: `${id}.1`,
      content: [
        { type: "paragraph", content: [
          { type: "text", text: "Unsaved paragraph" },
          { type: "cite", attrs: { cite: "draft-cite" } },
        ] },
        { type: "image", attrs: { src: "draft-image" } },
      ],
    });
    await db.images.put({
      id: "draft-image", documentId: id, createdAt: 0,
      blob: new Blob(["original pixels"], { type: "image/webp" }),
    });
    await db.cite.put({ key: "draft-cite", documentId: id, bib: "@book{draft,title={Draft}}" });
    await db.setAlias("API", "Draft abbreviation", id);
    await db.setVar("location", "Draft location", id);

    await files.load(id);
    expect((await db.documents.get(id))?.title).toBe(`Document ${id}`);
    expect((await db.chapters.get(`${id}.1`))?.content[0].content?.[0].text).toBe("From disk");
    const recovery = (await db.documents.toArray()).find((document) => document.id !== id)!;
    expect(recovery.title).toBe("Unsaved title — Autosave recovery");
    expect(recovery.file).toBeUndefined();
    const recovered = parseHighTexV2((await new Exporter(recovery.id).buildExport()).buffer);
    expect(recovered.chapters.find((chapter) => chapter.id === "1")?.content[0].content?.[0].text).toBe("Unsaved paragraph");
    expect(Object.values(recovered.references)).toContain("@book{draft,title={Draft}}");
    expect(new TextDecoder().decode(Object.values(recovered.images)[0].bytes)).toBe("original pixels");
    expect(await db.getAliases(recovery.id)).toContainEqual({ key: "API", value: "Draft abbreviation" });
    expect(recovered.variables).toContainEqual({ name: "location", value: "Draft location" });
  });

  test("navigation reuses the load and a clean reopening does not create recovery copies", async () => {
    const id = await storedFile();
    const files = new DocumentFileSource();
    await Promise.all([files.load(id), files.load(id)]);
    expect(reads).toBe(1);
    await db.chapters.update(`${id}.1`, { content: [{ type: "paragraph", attrs: { normalized: true } }] });
    await files.initialized(id, (await new Exporter(id).buildExport()).buffer);
    await files.load(id);
    expect((await db.chapters.get(`${id}.1`))?.content[0].attrs?.normalized).toBe(true);
    expect(reads).toBe(1);
    await new DocumentFileSource().load(id);
    expect(reads).toBe(2);
    expect(await db.documents.count()).toBe(1);
    expect((await db.chapters.get(`${id}.1`))?.content[0].content?.[0].text).toBe("From disk");
  });

  test("a missing file keeps the draft and cannot mark unsaved content as clean", async () => {
    const id = await storedFile();
    const files = new DocumentFileSource();
    await files.saved(id, source);
    await db.documents.update(id, { title: "Keep these edits" });
    unavailable = true;
    await files.load(id);
    await files.initialized(id, (await new Exporter(id).buildExport()).buffer);
    expect((await db.documents.get(id))?.title).toBe("Keep these edits");
    unavailable = false;
    await new DocumentFileSource().load(id);
    expect((await db.documents.toArray()).map((document) => document.title)).toContain(
      "Keep these edits — Autosave recovery",
    );
  });

  test("an invalid source leaves storage intact and can be retried", async () => {
    const id = await storedFile();
    const valid = source;
    const before = await captureDraft(db, id);
    source = new Uint8Array([1, 2, 3]);
    const files = new DocumentFileSource();
    await expect(files.load(id)).rejects.toBeDefined();
    expect(await captureDraft(db, id)).toEqual(before);
    source = valid;
    await files.load(id);
    expect(reads).toBe(2);
    expect(await db.documents.count()).toBe(1);
  });

  test("reconnecting a moved file preserves edits and the recovery baseline", async () => {
    const id = await storedFile();
    const files = new DocumentFileSource();
    await files.saved(id, source);
    await db.documents.update(id, { title: "Edits before reconnecting" });
    window.editor.locateSource = async () => "/moved/source.hightex";
    await files.locate(id);
    expect((await db.documents.get(id))?.file).toBe("/moved/source.hightex");
    expect((await db.documents.get(id))?.title).toBe("Edits before reconnecting");
    await new DocumentFileSource().load(id);
    expect((await db.documents.toArray()).map((document) => document.title)).toContain(
      "Edits before reconnecting — Autosave recovery",
    );
  });

  test("file status includes metadata, references, workspace identity and uncommitted chapter content", async () => {
    const id = await storedFile();
    const files = new DocumentFileSource();
    await files.saved(id, source, 123456);
    expect(await files.status(id)).toMatchObject({ modified: false, savedAt: 123456 });
    expect(await files.status(id, undefined, {
      id: `${id}.1`, content: [{ type: "paragraph", content: [{ type: "text", text: "Still typing" }] }],
    })).toMatchObject({ modified: true });
    await db.documents.update(id, { title: "Updated metadata" });
    expect((await files.status(id)).modified).toBe(true);
    await db.documents.update(id, { title: `Document ${id}` });
    expect((await files.status(id)).modified).toBe(false);
    await db.cite.put({ key: "status-cite", documentId: id, bib: "@book{status,title={Updated}}" });
    expect((await files.status(id)).modified).toBe(true);
    await files.saved(id, (await new Exporter(id).buildExport()).buffer);
    expect((await files.status(id)).modified).toBe(false);
    setWorkspace({ ...emptyAuthorProfile(), name: "Changed workspace author" });
    expect((await files.status(id)).modified).toBe(true);
  });

  test("settings from before Save As cannot restore an old file path", async () => {
    const id = await storedFile();
    const settingsDraft = (await db.documents.get(id))!;
    await db.documents.update(id, { file: "/new/location.hightex" });
    await db.updateDocument({ ...settingsDraft, title: "Updated settings" });
    expect((await db.documents.get(id))?.file).toBe("/new/location.hightex");
    expect((await db.documents.get(id))?.title).toBe("Updated settings");
  });

  test("a new file is loaded from the window path and existing cloud ownership survives reopening", async () => {
    const id = await storedFile();
    await db.documents.delete(id);
    window.editor.sourceFile = async () => "/source.hightex";
    await new DocumentFileSource().load(id);
    expect((await db.documents.get(id))?.file).toBe("/source.hightex");
    const cloudAcademic: CloudAcademicSource = {
      accountId: "account", serverUrl: "https://hightex.test", serverDocumentId: "server-doc",
      author: { name: "Server author", nim: "123", advisorName: "Advisor", advisorNip: "456", committee: {} },
      committee: { kaprodi: { name: "Kaprodi", nip: "789" }, dekan: { name: "Dekan", nip: "012" } },
    };
    await db.documents.update(id, { cloudAcademic });
    await new DocumentFileSource().load(id);
    expect((await db.documents.get(id))?.cloudAcademic).toEqual(cloudAcademic);
    expect((await db.documents.get(id))?.profile?.name).toBe("Server author");
  });
});

test("abbreviation labels remove one matching namespace without changing stored keys or authored dots", async () => {
  const aliases = [
    { documentId: "a", key: "a.API", value: "Interface" },
    { documentId: "a", key: "A.B", value: "Dotted abbreviation" },
    { documentId: "a", key: "a.a.API", value: "Authored prefix" },
    { documentId: "a", key: "another.API", value: "Different prefix" },
  ];
  await db.aliases.bulkPut(aliases);
  const before = await db.aliases.toArray();
  const labels = new Map(
    (await db.getAliases("a")).map(({ key, value }) => [key, value]),
  );
  expect(labels.get("API")).toBe("Interface");
  expect(labels.get("A.B")).toBe("Dotted abbreviation");
  expect(labels.get("a.API")).toBe("Authored prefix");
  expect(labels.get("another.API")).toBe("Different prefix");
  expect(await db.aliases.toArray()).toEqual(before);
});

test("database-only rendering and archive export use the same document and asset scope", async () => {
  const source = makeDocument("database-only");
  source.config.consentDate = new Date("2026-11-03");
  await db.documents.put(source);
  await db.chapters.bulkPut([
    {
      id: "database-only.1",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Only in IndexedDB" },
            { type: "cite", attrs: { cite: "used-foreign-cite" } },
          ],
        },
        { type: "image", attrs: { src: "used-foreign-image" } },
      ],
    },
    { id: "another.1", content: [{ type: "paragraph" }] },
  ]);
  await db.cite.bulkPut([
    {
      key: "used-foreign-cite",
      documentId: "another",
      bib: "@book{used,title={Used}}",
    },
    {
      key: "unused-foreign-cite",
      documentId: "another",
      bib: "@book{unused,title={Unused}}",
    },
  ]);
  for (const id of ["used-foreign-image", "unused-foreign-image"])
    await db.images.put({
      id,
      documentId: "another",
      blob: new Blob([id], { type: "image/webp" }),
      createdAt: 0,
    });
  await db.setAlias("API", "Application Programming Interface", source.id);
  await db.setAlias("OTHER", "Unrelated", "another");
  await db.setVar("location", "Campus", source.id);
  setWorkspace({
    ...emptyAuthorProfile(),
    name: "Workspace author",
    picture: new Blob(["photo"], { type: "image/webp" }),
  });

  const snapshot = await readDocumentSnapshot(source.id);
  const direct = await documentRenderModel(snapshot);
  const archived = parseHighTexV2(
    (await new Exporter(source.id).buildExport()).buffer,
  );
  for (const key of [
    "document",
    "chapters",
    "config",
    "references",
    "images",
    "variables",
    "aliases",
    "profile",
    "profilePicture",
  ] as const)
    expect(direct[key]).toEqual(archived[key]);
  expect(direct.chapters.map(({ id }) => id)).toEqual(["1"]);
  expect(Object.keys(direct.images)).toEqual(["used-foreign-image"]);
  expect(Object.keys(direct.references)).toEqual(["used-foreign-cite"]);
  expect(snapshot.document.file).toBeUndefined();

  await db.chapters.update("database-only.1", {
    content: [{ type: "paragraph" }],
  });
  await db.images.delete("used-foreign-image");
  expect((await documentRenderModel(snapshot)).chapters).toEqual(
    direct.chapters,
  );
  expect((await documentRenderModel(snapshot)).images).toEqual(direct.images);
  expect(await db.documents.get(source.id)).toEqual(source);
});

test("render source identity covers metadata, author, illustrations and photograph", async () => {
  await db.documents.put(makeDocument("identity"));
  await db.images.put({
    id: "png",
    documentId: "identity",
    blob: new Blob(["image"], { type: "image/png" }),
    createdAt: 0,
  });
  setWorkspace({
    ...emptyAuthorProfile(),
    name: "Author",
    picture: new Blob(["photo"], { type: "image/png" }),
  });
  const snapshot = await readDocumentSnapshot("identity");
  const model = await documentRenderModel(snapshot);
  const identity = await documentRenderFingerprint(model);
  expect(
    await documentRenderFingerprint(await documentRenderModel(snapshot)),
  ).toBe(identity);
  expect(model.images.png.mime).toBe("image/png");
  const variants = [
    { ...model, document: { ...model.document, title: "Changed title" } },
    { ...model, profile: { ...model.profile!, name: "Another author" } },
    {
      ...model,
      profilePicture: { mime: "image/png", bytes: new Uint8Array([1]) },
    },
    {
      ...model,
      images: { added: { mime: "image/png", bytes: new Uint8Array([2]) } },
    },
  ];
  for (const variant of variants)
    expect(await documentRenderFingerprint(variant)).not.toBe(identity);
});

test("reading a PDF source never repairs IDs or writes back to stored chapters", async () => {
  const source = makeDocument("read-only-source");
  const chapters = ["1", "2"].map((id) => ({
    id: `${source.id}.${id}`,
    content: [
      {
        type: "paragraph",
        attrs: { id: "duplicate", shouldUnique: true },
        content: [{ type: "text", text: "Preserve stored input" }],
      },
    ],
  }));
  await db.documents.put(source);
  await db.chapters.bulkPut(chapters);
  const model = await documentRenderModel(
    await readDocumentSnapshot(source.id),
  );
  expect(model.chapters.map((chapter) => chapter.content[0].attrs?.id)).toEqual(
    ["duplicate", "duplicate"],
  );
  expect(await db.chapters.bulkGet(chapters.map(({ id }) => id))).toEqual(
    chapters,
  );
  expect(await db.documents.get(source.id)).toEqual(source);
});

afterAll(async () => {
  await db.delete();
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("document authors and variables", () => {
  test("documents use the active workspace author while custom variables stay separate across reopening", async () => {
    await db.documents.bulkPut([
      makeDocument("a", "Student A"),
      makeDocument("b", "Student B"),
    ]);
    setWorkspace({
      ...emptyAuthorProfile(),
      name: "Workspace writer",
      nim: "WS",
    });
    await db.setVar("location", "Company A", "a");
    await db.setVar("location", "Company B", "b");
    await db.setVar("name", "Advisor default", "global");
    db.close();
    await db.open();

    expect(await db.getVar("name", "a")).toBe("Workspace writer");
    expect(await db.getVar("name", "b")).toBe("Workspace writer");
    expect(await db.getVar("location", "a")).toBe("Company A");
    expect(await db.getVar("location", "b")).toBe("Company B");
    expect(
      (await db.getVars("a")).filter((variable) => variable.name === "name"),
    ).toEqual([{ name: "name", value: "Workspace writer", documentId: "a" }]);
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

  test("saving document settings cannot replace the stored profile, CV or photo", async () => {
    const a = makeDocument("a", "Student A");
    const b = makeDocument("b", "Student B");
    await db.documents.bulkPut([a, b]);
    await db.documents.update("a", {
      profile: {
        ...a.profile!,
        cv: "CV A",
        picture: new Blob(["photo A"], { type: "image/webp" }),
      },
    });
    await db.updateDocument({
      ...a,
      profile: { ...a.profile!, name: "Attempted override" },
    });

    const saved = (await db.documents.get("a"))!;
    expect(saved.profile?.name).toBe("Student A");
    expect(saved.profile?.cv).toBe("CV A");
    expect(await saved.profile?.picture?.text()).toBe("photo A");
    expect((await db.documents.get("b"))?.profile).toEqual(b.profile);
  });

  test("renaming from a stale document does not restore an old author or deleted photo", async () => {
    const old = makeDocument("a", "Old A");
    old.profile!.picture = new Blob(["old photo"], { type: "image/webp" });
    await db.documents.put(old);
    await db.documents.update("a", {
      profile: { ...old.profile!, name: "Updated A", picture: undefined },
    });
    await db.updateDocument({ ...old, title: "Renamed" });
    const saved = (await db.documents.get("a"))!;
    expect(saved.title).toBe("Renamed");
    expect(saved.profile?.name).toBe("Updated A");
    expect(saved.profile?.picture).toBeUndefined();
  });

  test("concurrent document writes cannot create per-document CV or photo overrides", async () => {
    const original = makeDocument("a", "Student A");
    await db.documents.put(original);
    await Promise.all([
      db.updateDocument({
        ...original,
        profile: { ...original.profile!, cv: "Attempted CV" },
      }),
      db.updateDocument({
        ...original,
        profile: {
          ...original.profile!,
          picture: new Blob(["attempted photo"]),
        },
      }),
    ]);
    expect((await db.documents.get("a"))?.profile).toEqual(original.profile);
  });
});

describe("portable author profile", () => {
  test("config serialization strips legacy committee fields even if a caller supplies them", () => {
    const writer = new SchemaWritter();
    const legacy = Object.assign({} as HighTexConfig, {
      leader: "Old Chair",
      member_1: "Old Examiner",
      member_2: "",
      consentDate: new Date("2026-11-03"),
    });
    writer.putConfig(legacy);
    const config = JSON.parse(
      strFromU8(writer.getEntries()["files/config.json"]),
    );
    expect(config).toEqual({ consentDate: legacy.consentDate!.toISOString() });
    expect(legacy.leader).toBe("Old Chair");
  });
  test("committee IDs, NIPs and explicit empty assignments survive profile normalization and export/import", async () => {
    const source = makeDocument("committee", "Student A");
    const committee: AcademicCommittee = {
      chair: { id: "c1", name: "Chair, M.Kom.", nip: "000123" },
      examiner1: { name: "Legacy Examiner", nip: "" },
      examiner2: { id: "e2", name: "Examiner Two", nip: "000456" },
    };
    source.profile!.committee = committee;
    setWorkspace(source.profile!);
    await db.documents.put(source);
    expect(normalizeAuthorProfile(source.profile)?.committee).toEqual(
      committee,
    );
    expect(getAuthorDetails(source.profile!).committee).toEqual(committee);
    const { buffer, entries } = await new Exporter(source.id).buildExport();
    expect(parseHighTexV2(buffer).profile?.committee).toEqual(committee);
    expect(JSON.parse(strFromU8(entries["files/config.json"]))).toEqual({});
    const imported = await HighTexImporter.create(
      new File([buffer], "committee.hightex"),
      "/tmp/committee.hightex",
    );
    const saved = await imported.import("copy");
    expect(saved.profile?.committee).toEqual(committee);
    expect(saved.config).not.toHaveProperty("leader");
    expect(saved.config).not.toHaveProperty("member_1");
    expect((await db.documents.get(source.id))?.config).toEqual({});
    setWorkspace({ ...workspace, committee: {} });
    const cleared = await new Exporter(saved.id).buildExport();
    expect(parseHighTexV2(cleared.buffer).profile?.committee).toEqual({});
    const reopened = await (
      await HighTexImporter.create(
        new File([cleared.buffer], "cleared.hightex"),
        "/tmp/cleared.hightex",
      )
    ).import("copy");
    expect(reopened.profile?.committee).toEqual({});
  });

  test("importing a legacy archive uses the destination workspace identity and preserves document configuration", async () => {
    const entries = {
      "manifest.json": new TextEncoder().encode(
        JSON.stringify({
          schema_version: 2,
          format: "json",
          document: { id: "old-committee", category: "1" },
        }),
      ),
      "files/config.json": new TextEncoder().encode(
        JSON.stringify({
          leader: "Old Chair",
          member_1: "Old Examiner",
          consentDate: "2026-11-03",
          intern: { onsite_at: "Company" },
        }),
      ),
    };
    const buffer = zipSync(entries);
    const importer = await HighTexImporter.create(
      new File([buffer], "old.hightex"),
      "/tmp/old.hightex",
    );
    const saved = await importer.import();
    expect(saved.profile).toMatchObject({
      name: "",
      nim: "",
      committee: {},
    });
    expect(saved.profile?.committee?.chair?.id).toBeUndefined();
    expect(saved.config).toMatchObject({
      consentDate: new Date("2026-11-03"),
      intern: { onsite_at: "Company" },
    });
    expect(saved.config).not.toHaveProperty("leader");
    expect(importer.model.config.leader).toBe("Old Chair");
    const reexported = parseHighTexV2(
      (await new Exporter(saved.id).buildExport()).buffer,
    );
    expect(reexported.profile?.committee).toEqual(saved.profile?.committee);
    for (const key of ["leader", "member_1", "member_2"])
      expect(reexported.config).not.toHaveProperty(key);
  });
  test("content fingerprint includes document illustrations and excludes profile photos", async () => {
    await db.documents.put(makeDocument("a", "Student A"));
    await db.chapters.put({ id: "a.1", content: [{ type: "paragraph" }] });
    await db.images.put({
      id: "image",
      blob: new Blob(["A"], { type: "image/webp" }),
      documentId: "a",
      createdAt: 0,
    });
    const exporter = new Exporter("a");
    const first = await exporter.exportForPush();
    await Bun.sleep(5);
    const second = await exporter.exportForPush();
    expect(second.file).toEqual(first.file);
    expect(first.hash).toBe(await contentFingerprint(first.file));
    const manifest = JSON.parse(
      strFromU8(unzipSync(first.file)["manifest.json"]),
    );
    expect(manifest.version).toBe(2);
    expect(manifest.schema_version).toBe(2);
    await db.images.update("image", {
      blob: new Blob(["B"], { type: "image/webp" }),
    });
    const changedImage = await exporter.exportForPush();
    expect(changedImage.hash).not.toBe(first.hash);
    setWorkspace({
      ...workspace,
      picture: new Blob(["photo"], { type: "image/webp" }),
    });
    expect((await exporter.exportForPush()).hash).toBe(changedImage.hash);
    await db.images.delete("image");
    await db.chapters.delete("a.1");
    const entries = unzipSync((await exporter.exportForPush()).file);
    expect(entries["files/assets/images/image.webp"]).toBeUndefined();
    expect(entries["files/chapters/1.json"]).toBeUndefined();
  });

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
    setWorkspace(original.profile!);
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

  test("importing an archive without a profile applies the active workspace without reviving the old writer", async () => {
    await db.documents.put(makeDocument("old", "Previous author"));
    const { entries } = await new Exporter("old").buildExport();
    delete entries["files/profile.json"];
    delete entries["files/assets/profile.webp"];
    const file = new File([new Uint8Array(zipSync(entries))], "old.hightex");
    const importer = await HighTexImporter.create(file, "/test/old.hightex");
    const imported = await importer.import();
    expect(imported.profile).toMatchObject(emptyAuthorProfile());
    expect((await db.documents.get("old"))?.profile).toMatchObject(
      emptyAuthorProfile(),
    );
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
    await expect(
      HighTexImporter.create(
        new File([new Uint8Array(zipSync(entries))], "bad.hightex"),
        "/test/bad.hightex",
      ),
    ).rejects.toThrow();
    expect((await db.documents.get("a"))?.profile?.name).toBe("Student A");
  });
});

test("committee migration preserves authors, pictures and dates, is idempotent, and respects cleared assignments", () => {
  const original = makeDocument("legacy-committee", "Original Student");
  const picture = new Blob(["picture"], { type: "image/webp" });
  const date = new Date("2026-11-03");
  original.profile!.picture = picture;
  original.config = Object.assign(
    {},
    {
      leader: "Chair",
      member_1: "Examiner",
      validityDate: date,
      kaprodi: { name: "Head", nip: "HEAD" },
    },
  );
  const migrated = migrateDocumentCommittee(original);
  expect(migrated.profile?.name).toBe("Original Student");
  expect(migrated.profile?.picture).toBe(picture);
  expect(migrated.profile?.committee).toEqual({
    chair: { name: "Chair", nip: "" },
    examiner1: { name: "Examiner", nip: "" },
  });
  expect(migrated.config.validityDate).toBe(date);
  expect(migrated.config.kaprodi).toEqual(original.config.kaprodi);
  expect(original.config).toHaveProperty("leader", "Chair");
  expect(original.profile?.committee).toBeUndefined();
  expect(migrateDocumentCommittee(migrated)).toBe(migrated);
  const cleared = {
    ...original,
    profile: { ...original.profile!, committee: {} },
  };
  expect(migrateDocumentCommittee(cleared).profile?.committee).toEqual({});
  const chosen = { chair: { id: "new", name: "Chosen Chair", nip: "01" } };
  const selected = {
    ...original,
    profile: { ...original.profile!, committee: chosen },
  };
  expect(migrateDocumentCommittee(selected).profile?.committee).toEqual(chosen);
});

test("v2 database upgrade migrates each document's own committee and never refills a cleared profile on reopen", async () => {
  const name = `committee-migration-${crypto.randomUUID()}`;
  const old = new Dexie(name);
  old.version(2).stores({
    documents: "id",
    chapters: "id",
    cite: "key, documentId",
    chapterGraphs: "id",
    images: "id, documentId",
    variables: "name, documentId",
    aliases: "key, documentId",
    file: "filePath, documentId",
    documentVariables: "[documentId+name], documentId, name",
  });
  const a = makeDocument("a", "Student A");
  a.config = Object.assign({} as HighTexConfig, {
    leader: "Chair A",
    member_1: "Examiner A",
  });
  const b = makeDocument("b", "Student B");
  b.config = Object.assign({} as HighTexConfig, {
    leader: "Chair B",
    member_2: "Examiner B",
  });
  const c = { ...a, id: "cleared", profile: { ...a.profile!, committee: {} } };
  await old.table("documents").bulkPut([a, b, c]);
  old.close();
  const migrated = new HighTexDB(name);
  try {
    await migrated.open();
    expect((await migrated.documents.get("a"))?.profile).toMatchObject({
      name: "Student A",
      committee: {
        chair: { name: "Chair A", nip: "" },
        examiner1: { name: "Examiner A", nip: "" },
      },
    });
    expect((await migrated.documents.get("b"))?.profile).toMatchObject({
      name: "Student B",
      committee: {
        chair: { name: "Chair B", nip: "" },
        examiner2: { name: "Examiner B", nip: "" },
      },
    });
    expect((await migrated.documents.get("a"))?.config).toEqual({});
    expect(
      (await migrated.documents.get("cleared"))?.profile?.committee,
    ).toEqual({});
    await migrated.documents.update("a", {
      profile: {
        ...(await migrated.documents.get("a"))!.profile!,
        committee: {},
      },
    });
    migrated.close();
    await migrated.open();
    expect((await migrated.documents.get("a"))?.profile?.committee).toEqual({});
  } finally {
    await migrated.delete();
  }
});

test("local package import rejects v1 before changing stored documents", async () => {
  await db.documents.put(makeDocument("a", "Existing author"));
  const before = await captureDraft(db, "a");
  const file = new File(
    [
      new Uint8Array(
        zipSync({
          "manifest.json": new TextEncoder().encode(
            JSON.stringify({ schema_version: 1, document: { id: "a" } }),
          ),
        }),
      ),
    ],
    "v1.hightex",
  );
  await expect(
    HighTexImporter.create(file, "/test/v1.hightex"),
  ).rejects.toMatchObject({
    description: "Only HighTex v2 documents are supported.",
  });
  expect(await captureDraft(db, "a")).toEqual(before);
});

test("local package import rolls back a failed asset/reference write before warming the editor", async () => {
  await db.documents.put(makeDocument("a", "Existing author"));
  await db.chapters.put({ id: "a.stale", content: [{ type: "paragraph" }] });
  const before = await captureDraft(db, "a");
  const { entries } = await new Exporter("a").buildExport();
  entries["files/assets/references.json"] = new TextEncoder().encode(
    JSON.stringify({ ref: "@book{ref,title={Imported}}" }),
  );
  const importer = await HighTexImporter.create(
    new File([new Uint8Array(zipSync(entries))], "new.hightex"),
    "/test/new.hightex",
  );
  const failWrite = () => {
    throw new Error("local reference write failed");
  };
  db.cite.hook("creating", failWrite);
  try {
    await expect(importer.import()).rejects.toMatchObject({
      description: "local reference write failed",
    });
    expect(await captureDraft(db, "a")).toEqual(before);
    expect(await db.cite.count()).toBe(0);
  } finally {
    db.cite.hook("creating").unsubscribe(failWrite);
  }
});

test("local package overwrite clears stale rows and namespaces aliases", async () => {
  await db.documents.put(makeDocument("a", "Imported author"));
  const { entries } = await new Exporter("a").buildExport();
  entries["files/chapters/1.json"] = new TextEncoder().encode(
    JSON.stringify([{ type: "paragraph" }]),
  );
  entries["files/assets/aliases.json"] = new TextEncoder().encode(
    JSON.stringify([{ key: "a.caption", value: "Caption" }]),
  );
  await db.chapters.put({ id: "a.stale", content: [{ type: "paragraph" }] });
  await db.setVar("stale", "old", "a");
  const importer = await HighTexImporter.create(
    new File([new Uint8Array(zipSync(entries))], "new.hightex"),
    "/test/new.hightex",
  );
  expect(importer.exists).toBe(true);
  await importer.import();
  expect(await db.chapters.get("a.stale")).toBeUndefined();
  expect(await db.documentVariables.get(["a", "stale"])).toBeUndefined();
  expect(await db.getAliases("a")).toEqual([
    { key: "caption", value: "Caption" },
  ]);
});

test("import as copy remaps document data and assets without changing the existing draft", async () => {
  await db.documents.put({
    ...makeDocument("original", "Student A"),
    file: "/original.hightex",
  });
  await db.chapters.put({
    id: "original.1",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Imported content" },
          { type: "cite", attrs: { cite: "first|second" } },
          { type: "image", attrs: { src: "photo" } },
        ],
      },
    ],
  });
  await db.images.put({
    id: "photo",
    documentId: "original",
    blob: new Blob(["photo"], { type: "image/webp" }),
    createdAt: 0,
  });
  await db.cite.bulkPut([
    {
      key: "first",
      bib: "@book{first,title={First},author={Author A},year={2025}}",
      documentId: "original",
    },
    {
      key: "second",
      bib: "@book{second,title={Second},author={Author B},year={2026}}",
      documentId: "original",
    },
  ]);
  await db.aliases.put({
    key: "original.caption",
    value: "Caption",
    documentId: "original",
  });
  await db.setVar("location", "Company A", "original");
  const { buffer } = await new Exporter("original").buildExport();
  await db.documents.update("original", { title: "Local changes" });
  const before = await captureDraft(db, "original");
  const originalReferences = await db.cite
    .where("documentId")
    .equals("original")
    .toArray();
  const importer = await HighTexImporter.create(
    new File([new Uint8Array(buffer)], "original.hightex"),
    "/original.hightex",
  );
  expect(importer.exists).toBe(true);
  const copy = await importer.import("copy");
  expect(copy.id).not.toBe("original");
  expect(copy.title).toBe("Document original (Copy)");
  expect(copy.file).toBeUndefined();
  expect(copy.profile?.name).toBe(workspace.name);
  expect(await captureDraft(db, "original")).toEqual(before);
  expect(
    await db.cite.where("documentId").equals("original").toArray(),
  ).toEqual(originalReferences);
  const chapter = await db.chapters.get(`${copy.id}.1`);
  expect(chapter?.content[0].content?.[0].text).toBe("Imported content");
  const references = chapter?.content[0].content?.[1].attrs?.cite.split(
    "|",
  ) as string[];
  expect(references).toHaveLength(2);
  for (const key of references)
    expect((await db.cite.get(key))?.documentId).toBe(copy.id);
  const image = await db.images.get(
    chapter?.content[0].content?.[2].attrs?.src,
  );
  expect(image?.documentId).toBe(copy.id);
  expect(await image?.blob.text()).toBe("photo");
  expect(await db.getAliases(copy.id)).toEqual([
    { key: "caption", value: "Caption" },
  ]);
  expect(await db.getVar("location", copy.id)).toBe("Company A");
  const secondCopy = await importer.import("copy");
  expect(secondCopy.id).not.toBe(copy.id);
  expect(await db.documents.count()).toBe(3);
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
