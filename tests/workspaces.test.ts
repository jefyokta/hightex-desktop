import { afterEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  workspaceHost,
  workspaceIdFromUrl,
  normalizeWorkspaceServer,
} from "../electron/workspaces/identity";
import {
  WorkspaceRegistry,
  hasLegacyWorkspace,
} from "../electron/workspaces/registry";
import {
  cloudWorkspace,
  planWorkspaceMigration,
  selectWorkspaceData,
} from "../electron/workspaces/migration-plan";

const directories: string[] = [];
const directory = () => {
  const root = mkdtempSync(path.join(tmpdir(), "hightex-workspaces-test-"));
  directories.push(root);
  return root;
};
afterEach(() => {
  directories
    .splice(0)
    .forEach((root) => rmSync(root, { recursive: true, force: true }));
});
const document = (id: string, parentId?: string): HighTexDocument => ({
  id,
  parentId,
  title: id,
  altTitle: "",
  category: "1",
  keywords: { indonesian: [], english: [] },
  config: {},
});
const binding = (
  id: string,
  accountId = "1",
  serverUrl = "https://cloud.test/api/",
): CloudBinding => ({
  localDocumentId: id,
  serverDocumentId: `remote-${id}`,
  accountId,
  serverUrl,
  baseSha256: "a".repeat(64),
});

test("profile origins are distinct, stable and reject foreign/malformed hosts", () => {
  expect(workspaceHost("abc-1")).toBe("profile.abc-1");
  expect(workspaceIdFromUrl("hightex://profile.abc-1/document/d")).toBe(
    "abc-1",
  );
  for (const value of [
    "http://profile.abc-1",
    "hightex://profile.abc-1.evil",
    "hightex://user@profile.abc-1",
    "hightex://profile.abc-1:80",
    "hightex://app",
  ])
    expect(workspaceIdFromUrl(value)).toBeNull();
  for (const id of ["../other", "x.y", "", "A", "x".repeat(64)])
    expect(() => workspaceHost(id)).toThrow();
});

test("server normalization keeps origins and ports distinct without inventing subdomains", () => {
  expect(normalizeWorkspaceServer("https://CLOUD.test/api")).toBe(
    "https://cloud.test/api/",
  );
  expect(normalizeWorkspaceServer("http://localhost:8000")).toBe(
    "http://localhost:8000/api/",
  );
  for (const value of [
    "file:///tmp/x",
    "https://user:pass@cloud.test",
    "https://cloud.test/tenant",
    "https://cloud.test/?a=b",
  ])
    expect(() => normalizeWorkspaceServer(value)).toThrow();
});

test("fresh installs skip migration; updates with legacy stores require it exactly once", () => {
  const fresh = directory();
  expect(hasLegacyWorkspace(fresh)).toBe(false);
  expect(
    new WorkspaceRegistry(fresh, "https://cloud.test/api/").read()
      .migrationComplete,
  ).toBe(true);
  for (const file of [
    "installed.json",
    "config.json",
    "hightex.db",
    "document-sync-v2.json",
  ]) {
    const root = directory();
    writeFileSync(path.join(root, file), "{}");
    const registry = new WorkspaceRegistry(root, "https://cloud.test/api/");
    expect(registry.read().migrationComplete).toBe(false);
    registry.write({ ...registry.read(), migrationComplete: true });
    expect(
      new WorkspaceRegistry(root, "https://cloud.test/api/").read()
        .migrationComplete,
    ).toBe(true);
  }
  const browserOnly = directory();
  mkdirSync(path.join(browserOnly, "IndexedDB"));
  mkdirSync(
    path.join(browserOnly, "IndexedDB", "hightex_app_0.indexeddb.leveldb"),
  );
  expect(hasLegacyWorkspace(browserOnly)).toBe(true);
});

test("profile identity survives rename/logout and rejects replacing a bound cloud account", () => {
  const registry = new WorkspaceRegistry(
    directory(),
    "https://cloud.test/api/",
  );
  const state = registry.create({
    name: "University",
    type: "cloud",
  });
  const cloud = state.profiles[1];
  registry.write({ ...state, activeId: cloud.id });
  expect(registry.bindAccount("user-1").accountId).toBe("user-1");
  expect(() => registry.bindAccount("user-2")).toThrow();
  const reloaded = registry.read();
  reloaded.profiles[1].name = "Renamed";
  registry.write(reloaded);
  expect(registry.read().profiles[1].id).toBe(cloud.id);
  registry.write({ ...registry.read(), activeId: "local" });
  expect(() => registry.bindAccount("user-1")).toThrow();
});

test("deleting a workspace removes its local data and protects active/default profiles", () => {
  const root = directory();
  const registry = new WorkspaceRegistry(root, "https://cloud.test/api/");
  const created = registry.create({ name: "Research", type: "local" });
  const workspaceId = created.profiles[1].id;
  registry.write({ ...created, activeId: workspaceId });
  expect(() => registry.delete(workspaceId)).toThrow(
    "The active workspace cannot be deleted",
  );
  expect(() => registry.delete("local")).toThrow(
    "The default workspace cannot be deleted",
  );

  mkdirSync(path.join(registry.directory(workspaceId), "data"));
  registry.write({ ...created, activeId: "local" });
  const next = registry.delete(workspaceId);
  expect(next.profiles.map((profile) => profile.id)).toEqual(["local"]);
  expect(existsSync(registry.directory(workspaceId))).toBe(false);
});

test("migration groups by host/account and keeps branches with their parent", () => {
  const documents = [
    document("a"),
    document("b"),
    document("c"),
    document("a-branch", "a"),
    document("offline"),
  ];
  const plan = planWorkspaceMigration(documents, [
    binding("a"),
    binding("b", "2"),
    binding("c", "1", "https://other.test/api/"),
  ]);
  expect(plan.conflicts).toEqual([]);
  expect(plan.profiles).toHaveLength(4);
  expect(plan.assignments["a-branch"]).toBe(plan.assignments.a);
  expect(
    new Set([plan.assignments.a, plan.assignments.b, plan.assignments.c]).size,
  ).toBe(3);
  expect(plan.assignments.offline).toBe("local");
  expect(cloudWorkspace("https://cloud.test", "1").id).toBe(plan.assignments.a);
});

test("mixed bindings and broken parent links require an explicit migration decision", () => {
  const plan = planWorkspaceMigration(
    [document("a"), document("child", "a"), document("orphan", "missing")],
    [binding("a"), binding("child", "2")],
  );
  expect(plan.conflicts.map((item) => item.documentId).sort()).toEqual([
    "a",
    "orphan",
  ]);
  expect(plan.assignments.child).toBe(plan.assignments.a);
  expect(plan.assignments.a).toBe("local");
  expect(
    planWorkspaceMigration([document("x", "y"), document("y", "x")], [])
      .conflicts,
  ).toHaveLength(1);
});

test("selected data includes referenced assets and shared data while isolating document/form rows", () => {
  const snapshot: WorkspaceDataSnapshot = {
    tables: {
      documents: [document("a"), document("b")] as unknown as Record<
        string,
        unknown
      >[],
      chapters: [
        {
          id: "a.1",
          content: [{ type: "image", attrs: { src: "shared-image" } }],
        },
        { id: "b.1" },
      ],
      chapterGraphs: [{ id: "a.1" }, { id: "b.1" }],
      images: [
        { id: "shared-image", documentId: "b" },
        { id: "private-b", documentId: "b" },
      ],
      cite: [
        { key: "global" },
        { key: "a", documentId: "a" },
        { key: "b", documentId: "b" },
      ],
      documentVariables: [
        { name: "shared", documentId: "global" },
        { name: "secret", documentId: "b" },
      ],
      aliases: [{ key: "b.x", documentId: "b" }],
      file: [{ filePath: "/a.hightex", documentId: "a" }],
    },
    localStorage: {
      "hightex:forms:v1:a": "form-a",
      "hightex:forms:v1:b": "form-b",
      other: "legacy",
    },
  };
  const a = selectWorkspaceData(
    snapshot,
    { a: "cloud-a", b: "cloud-b" },
    "cloud-a",
  );
  expect(a.tables.documents.map((row) => row.id)).toEqual(["a"]);
  expect(a.tables.images.map((row) => row.id)).toEqual(["shared-image"]);
  expect(a.tables.cite.map((row) => row.key)).toEqual(["global", "a"]);
  expect(a.tables.documentVariables).toEqual([
    { name: "shared", documentId: "global" },
  ]);
  expect(a.tables.aliases).toEqual([]);
  expect(a.tables.chapterGraphs).toEqual([{ id: "a.1" }]);
  expect(a.localStorage).toEqual({ "hightex:forms:v1:a": "form-a" });
  expect(snapshot.tables.images).toHaveLength(2);
});
