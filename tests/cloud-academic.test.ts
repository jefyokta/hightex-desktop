import "fake-indexeddb/auto";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import Dexie from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { strFromU8, unzipSync } from "fflate";
import {
  CloudAcademicClient,
  parseCloudAcademic,
} from "../electron/service/cloud-academic-client";
import { HighTexDB } from "../src/editor/storage/hightex-db";
import { Exporter } from "../src/utils/htx/exporter";
import {
  refreshCloudAcademic,
  exportCloudArtifact,
} from "../src/cloud/academic-data";
import { readSnapshot } from "../src/review/snapshot-reader";

const context: CloudSession = {
  sessionId: "session-a",
  serverUrl: "http://demo/api/",
  accountId: "12",
};
const me = () => ({
  message: {
    id: 12,
    name: "Student Server, S.Kom.",
    identity_number: "STUDENT12",
    roles: [{ name: "advisor" }, { name: "student" }],
    advisors: [
      {
        name: "Advisor Two, M.Kom.",
        identity_number: "NIP2",
        advisor_role: "secondary",
      },
      {
        name: "Advisor One, M.Kom.",
        identity_number: "NIP1",
        advisor_role: "primary",
      },
    ],
    thesis_data: {
      student_id: 12,
      session_chair: { name: "Chair" },
      first_examiner: { name: "Examiner One" },
      second_examiner: { name: "Examiner Two" },
    },
  },
});
const university = {
  data: {
    lead_program_study: { name: "Program Head", nip: "HEAD" },
    dean: { name: "Dean", nip: "DEAN" },
  },
};
const academic = (): CloudAcademicData => {
  const data = parseCloudAcademic(me(), university);
  return {
    session: context,
    serverDocumentId: "server-doc",
    author: data.author,
    committee: data.committee,
  };
};
const document = (id = "local-doc"): HighTexDocument => ({
  id,
  title: "Local title",
  altTitle: "Local English title",
  category: "1",
  keywords: { indonesian: ["local"], english: [] },
  profile: {
    name: "Manual author",
    nim: "MANUAL",
    advisorName: "Manual advisor",
    advisorNip: "MANUAL",
    secondAdvisor: { name: "Stale advisor", nip: "STALE" },
    cv: "<p>Local CV</p>",
    picture: new Blob([new Uint8Array([1, 2])], { type: "image/webp" }),
  },
  config: {
    leader: "Manual chair",
    member_1: "Manual examiner",
    member_2: "Manual examiner two",
    kaprodi: { name: "Manual head", nip: "OLD" },
    dekan: { name: "Manual dean", nip: "OLD" },
    validityDate: new Date("2026-10-21T00:00:00Z"),
  },
});
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const db = new HighTexDB(`CloudAcademic-${crypto.randomUUID()}`);
const getInstance = HighTexDB.getInstance;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
let loads = 0;
const fakeWindow = () =>
  Object.assign(new EventTarget(), {
    config: { get: () => ({ language: "en" }) },
    hightex: {
      categories: async () => [{ id: 1, variant: "thesis", chapters: [] }],
      cloud: {
        context: async () => context,
        binding: async (_session: string, id: string) =>
          id === "local-doc" ? { serverDocumentId: "server-doc" } : null,
        academic: {
          locked: async (id: string) => id === "local-doc",
          load: async () => {
            loads++;
            return academic();
          },
        },
      },
    },
  });
beforeAll(async () => {
  HighTexDB.getInstance = () => db;
  await db.open();
});
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  loads = 0;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow(),
  });
  await db.documents.put(document());
  await db.chapters.put({
    id: "local-doc.1",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Local saved chapter" }],
      },
    ],
  });
});
afterAll(async () => {
  HighTexDB.getInstance = getInstance;
  await db.delete();
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

test("active mentorship roles and thesis assignments map by role, with server-formatted names", () => {
  expect(academic()).toMatchObject({
    author: {
      name: "Student Server, S.Kom.",
      nim: "STUDENT12",
      advisorName: "Advisor One, M.Kom.",
      advisorNip: "NIP1",
      secondAdvisor: { name: "Advisor Two, M.Kom.", nip: "NIP2" },
    },
    committee: {
      leader: "Chair",
      member_1: "Examiner One",
      member_2: "Examiner Two",
      kaprodi: { name: "Program Head", nip: "HEAD" },
      dekan: { name: "Dean", nip: "DEAN" },
    },
  });
});

test("missing assignments clear old manual values instead of guessing advisors/examiners", async () => {
  const raw = me();
  raw.message.advisors = [];
  raw.message.thesis_data = null as unknown as typeof raw.message.thesis_data;
  const parsed = parseCloudAcademic(raw, university);
  await db.cacheCloudAcademic("local-doc", {
    ...academic(),
    author: parsed.author,
    committee: parsed.committee,
  });
  const doc = await db.documents.get("local-doc");
  expect(doc?.profile).toMatchObject({
    name: "Student Server, S.Kom.",
    advisorName: "",
    advisorNip: "",
  });
  expect(doc?.profile?.secondAdvisor).toBeUndefined();
  expect(doc?.config).toMatchObject({ leader: "", member_1: "", member_2: "" });
});

test("ambiguous roles, mismatched thesis student and malformed university data fail", () => {
  const raw = me();
  raw.message.advisors[0].advisor_role = "primary";
  expect(() => parseCloudAcademic(raw, university)).toThrow("academic_invalid");
  const foreign = me();
  foreign.message.thesis_data.student_id = 99;
  expect(() => parseCloudAcademic(foreign, university)).toThrow(
    "academic_invalid",
  );
  expect(() => parseCloudAcademic(me(), { data: {} })).toThrow(
    "academic_invalid",
  );
});

test("loader binds /me and owned server document to the current session", async () => {
  const paths: string[] = [];
  const client = new CloudAcademicClient({
    context: () => context,
    request: async (path) => {
      paths.push(path);
      return {
        ok: true,
        status: 200,
        data:
          path === "/me"
            ? me()
            : path === "/university-data"
              ? university
              : { document: { id: "server-doc", author: 12 } },
      };
    },
  });
  expect(
    await client.load({
      sessionId: context.sessionId,
      serverDocumentId: "server-doc",
    }),
  ).toEqual(academic());
  expect(paths.sort()).toEqual(["/document", "/me", "/university-data"]);
  await expect(
    client.load({ sessionId: "old-session", serverDocumentId: "server-doc" }),
  ).rejects.toMatchObject({ code: "session_changed" });
  await expect(
    client.load({
      sessionId: context.sessionId,
      serverDocumentId: "another-doc",
    }),
  ).rejects.toMatchObject({ code: "cloud_changed" });
  // A web document can exist before its first desktop cloud commit.
  expect(
    (
      await client.load({
        sessionId: context.sessionId,
        serverDocumentId: null,
      })
    ).serverDocumentId,
  ).toBe("server-doc");
});

test("late account switch or foreign document cannot supply another author's data", async () => {
  let session = context;
  const client = new CloudAcademicClient({
    context: () => session,
    request: async (path) => {
      if (path === "/me")
        session = { ...context, sessionId: "new-session", accountId: "99" };
      return {
        ok: true,
        status: 200,
        data:
          path === "/me"
            ? me()
            : path === "/university-data"
              ? university
              : { document: { id: "server-doc", author: 12 } },
      };
    },
  });
  await expect(
    client.load({
      sessionId: context.sessionId,
      serverDocumentId: "server-doc",
    }),
  ).rejects.toMatchObject({ code: "session_changed" });
  const foreign = new CloudAcademicClient({
    context: () => context,
    request: async (path) => ({
      ok: true,
      status: 200,
      data:
        path === "/me"
          ? me()
          : path === "/university-data"
            ? university
            : { document: { id: "server-doc", author: 99 } },
    }),
  });
  await expect(
    foreign.load({
      sessionId: context.sessionId,
      serverDocumentId: "server-doc",
    }),
  ).rejects.toMatchObject({ code: "cloud_changed" });
});

test("cloud fields survive stale settings/profile writes while title, CV/photo and dates remain editable", async () => {
  const stale = (await db.documents.get("local-doc"))!;
  await db.cacheCloudAcademic("local-doc", academic());
  const editedDate = new Date("2026-11-01T00:00:00Z");
  const result = await db.updateDocument(
    {
      ...stale,
      title: "Edited title",
      config: { ...stale.config, validityDate: editedDate },
    },
    stale.profile,
  );
  expect(result.title).toBe("Edited title");
  expect(result.config.validityDate).toEqual(editedDate);
  expect(result.profile?.name).toBe(academic().author.name);
  expect(result.config.leader).toBe("Chair");
  const picture = new Blob([new Uint8Array([3, 4])], { type: "image/webp" });
  const profile = await db.updateProfile("local-doc", {
    name: "Attempted edit",
    advisorName: "Wrong advisor",
    cv: "<p>Edited CV</p>",
    picture,
  });
  expect(profile.profile).toMatchObject({
    name: academic().author.name,
    advisorName: academic().author.advisorName,
    cv: "<p>Edited CV</p>",
  });
  expect(new Uint8Array(await profile.profile!.picture!.arrayBuffer())).toEqual(
    new Uint8Array([3, 4]),
  );
});

test("local documents stay editable and cloud cache rejects a different owner or server", async () => {
  await db.documents.put(document("local-only"));
  const local = await db.updateProfile("local-only", {
    name: "Editable author",
  });
  expect(local.profile?.name).toBe("Editable author");
  await db.cacheCloudAcademic("local-doc", academic());
  for (const session of [
    { ...context, accountId: "99" },
    { ...context, serverUrl: "http://other/api/" },
  ])
    await expect(
      db.cacheCloudAcademic("local-doc", { ...academic(), session }),
    ).rejects.toMatchObject({ code: "academic_scope" });
  expect((await db.documents.get("local-doc"))?.profile?.name).toBe(
    academic().author.name,
  );
});

test("cloud export normalizes frozen bytes without changing an unbound local draft; local policy stays out of archives", async () => {
  const exported = await new Exporter("local-doc").exportForPush(academic());
  expect((await db.documents.get("local-doc"))?.profile?.name).toBe(
    "Manual author",
  );
  const snapshot = await readSnapshot(exported.file, {
    kind: "local",
    filename: "cloud.hightex",
  });
  expect(snapshot.document.profile?.name).toBe(academic().author.name);
  expect(snapshot.document.profile?.cv).toBe("<p>Local CV</p>");
  expect(snapshot.document.config.leader).toBe("Chair");
  await db.cacheCloudAcademic("local-doc", academic());
  const archive = await new Exporter("local-doc").exportForPush();
  const entries = unzipSync(archive.file);
  expect(
    Object.values(entries).some((bytes) =>
      strFromU8(bytes).includes("cloudAcademic"),
    ),
  ).toBe(false);
});

test("push validation rejects manual changes and assignment changes, but permits local CV and dates", async () => {
  let server = me();
  const client = new CloudAcademicClient({
    context: () => context,
    request: async (path) => ({
      ok: true,
      status: 200,
      data:
        path === "/me"
          ? server
          : path === "/university-data"
            ? university
            : { document: { id: "server-doc", author: 12 } },
    }),
  });
  const valid = await new Exporter("local-doc").exportForPush(academic());
  const input: CloudPushInput = {
    ...valid,
    sessionId: context.sessionId,
    message: "",
    expectedServerDocumentId: "server-doc",
    expectedCloudSha256: null,
    replace: false,
  };
  await client.verify(input, "server-doc");
  const manual = await new Exporter("local-doc").exportForPush();
  await expect(
    client.verify({ ...input, file: manual.file }, "server-doc"),
  ).rejects.toMatchObject({ code: "academic_changed" });
  server = me();
  server.message.thesis_data.session_chair.name = "New chair";
  await expect(client.verify(input, "server-doc")).rejects.toMatchObject({
    code: "academic_changed",
  });
});

test("automatic refresh affects bound working documents only and retains cached fields on network failure", async () => {
  expect(await refreshCloudAcademic("local-doc")).toEqual({ locked: true });
  expect((await db.documents.get("local-doc"))?.profile?.name).toBe(
    academic().author.name,
  );
  await db.documents.put(document("local-only"));
  expect(await refreshCloudAcademic("local-only")).toEqual({ locked: false });
  expect(loads).toBe(1);
  window.hightex.cloud.academic.load = async () => {
    throw Error("Offline");
  };
  expect(await refreshCloudAcademic("local-doc")).toMatchObject({
    locked: true,
    error: "academic_unavailable",
  });
  expect((await db.documents.get("local-doc"))?.profile?.name).toBe(
    academic().author.name,
  );
});

test("an old-account working document stays locked without adopting the newly logged-in actor", async () => {
  await db.cacheCloudAcademic("local-doc", academic());
  window.hightex.cloud.context = async () => ({
    ...context,
    accountId: "99",
    sessionId: "other-session",
  });
  window.hightex.cloud.binding = async () => null;
  expect(await refreshCloudAcademic("local-doc")).toMatchObject({
    locked: true,
    error: "academic_scope",
  });
  expect(loads).toBe(0);
  await expect(
    exportCloudArtifact(
      "local-doc",
      await window.hightex.cloud.context(),
      "other-doc",
    ),
  ).rejects.toMatchObject({ code: "academic_scope" });
  expect((await db.documents.get("local-doc"))?.profile?.name).toBe(
    academic().author.name,
  );
});
