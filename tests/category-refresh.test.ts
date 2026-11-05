import { expect, test } from "bun:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import path from "node:path";
// import installerBackup from "../resources/category-backup.json";
import { parseCategoryDirectory } from "../src/utils/category-directory";

function fixture() {
  const first: Category = {
    id: 1,
    name: "Original",
    variant: "thesis",
    chapters: [{ chapter: "1", title: "Introduction" }],
  };
  let cached = JSON.stringify({ data: [first] });
  let response: unknown = {
    data: [
      {
        ...first,
        name: "Updated",
        chapters: JSON.stringify([{ chapter: "1", title: "New structure" }]),
      },
    ],
  };
  let failed = false,
    calls = 0;
  let backup: unknown = { data: [] };
  let packaged = false;
  const backupReads: string[] = [];
  const storage = {
    get: () => cached,
    set: (value: string) => {
      cached = value;
    },
  };
  class HasStorage {
    getStorage() {
      return storage;
    }
    static instance() {
      return new this();
    }
  }
  const modules: Record<string, unknown> = {
    "./concerns/has-storage": { HasStorage },
    "../../src/utils/category-directory": { parseCategoryDirectory },
    electron: {
      app: {
        get isPackaged() {
          return packaged;
        },
        getAppPath: () => "/fixture-app",
      },
    },
    path: { default: path },
    "fs/promises": {
      readFile: async (file: string) => {
        backupReads.push(file);
        if (backup instanceof Error) throw backup;
        return JSON.stringify(backup);
      },
    },
    "./server-service": {
      ServerService: {
        request: async () => {
          calls++;
          if (failed) throw Error("Offline");
          return response;
        },
      },
    },
    "./logger-service": { LoggerService: { write: () => {} } },
  };
  const sandbox = {
    exports: {},
    require: (id: string) => modules[id] ?? {},
    AbortSignal,
    process: { resourcesPath: "/fixture-installer/resources" },
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../electron/service/category-service.ts", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText,
    sandbox,
  );
  const service = (
    sandbox.exports as typeof import("../electron/service/category-service")
  ).CategoryService;
  return {
    service,
    first,
    cached: () => cached,
    cache: (value: unknown) => {
      cached = typeof value === "string" ? value : JSON.stringify(value);
    },
    backup: (value: unknown) => {
      backup = value;
    },
    packaged: () => {
      packaged = true;
    },
    backupReads,
    calls: () => calls,
    respond: (value: unknown) => {
      response = value;
    },
    offline: () => {
      failed = true;
    },
  };
}
test("reading a valid category cache stays offline; manual refresh replaces matching categories", async () => {
  const f = fixture();
  expect((await f.service.getAll())[0].name).toBe("Original");
  expect(f.calls()).toBe(0);
  expect(f.backupReads).toEqual([]);
  expect((await f.service.refresh())[0]).toMatchObject({
    name: "Updated",
    chapters: [{ chapter: "1", title: "New structure" }],
  });
  expect(f.calls()).toBe(1);
  expect((await f.service.getAll())[0].name).toBe("Updated");
  expect(f.calls()).toBe(1);
});
test("network errors and malformed category responses preserve the last usable offline cache", async () => {
  const f = fixture();
  const original = f.cached();
  for (const raw of [
    {},
    { data: [] },
    { data: [{ ...f.first, variant: "unknown" }] },
    { data: [{ ...f.first, chapters: "broken" }] },
    { data: [f.first, f.first] },
  ]) {
    f.respond(raw);
    await expect(f.service.refresh()).rejects.toThrow();
    expect(f.cached()).toBe(original);
  }
  f.offline();
  await expect(f.service.refresh()).rejects.toThrow("Offline");
  expect(f.cached()).toBe(original);
});
test("retired category IDs remain usable by existing documents after refreshing", async () => {
  const f = fixture();
  f.respond({ data: [{ ...f.first, id: 2, name: "New category" }] });
  expect((await f.service.refresh()).map((category) => category.id)).toEqual([
    2, 1,
  ]);
  expect(await f.service.get("1")).toMatchObject({ name: "Original" });
});

test("API and backup chapter numbers normalize from numbers and numeric category IDs", async () => {
  const f = fixture();
  f.respond({
    data: [
      {
        ...f.first,
        id: "1",
        chapters: JSON.stringify([
          { chapter: 1, title: "Introduction" },
          { chapter: "2", title: "Methods" },
        ]),
      },
    ],
  });
  expect(await f.service.refresh()).toMatchObject([
    { id: 1, chapters: [{ chapter: "1" }, { chapter: "2" }] },
  ]);
  expect((await f.service.getAll())[0].chapters[0].chapter).toBe("1");
});
test("empty or corrupt cache recovers numeric chapter backups offline and persists the result", async () => {
  for (const initial of ["broken json", { data: [] }]) {
    const f = fixture();
    f.cache(initial);
    f.offline();
    f.backup({
      data: [
        {
          ...f.first,
          chapters: JSON.stringify([{ chapter: 1, title: "Backup chapter" }]),
        },
      ],
    });
    expect((await f.service.getAll())[0]).toMatchObject({
      id: 1,
      chapters: [{ chapter: "1", title: "Backup chapter" }],
    });
    expect(f.calls()).toBe(0);
    expect((await f.service.getAll())[0].id).toBe(1);
    expect(f.calls()).toBe(0);
    expect(JSON.parse(f.cached()).data[0].chapters[0].chapter).toBe("1");
  }
});
test("a broken cached record is repaired from backup while valid custom categories survive offline", async () => {
  const f = fixture();
  f.offline();
  f.cache({
    data: [
      { ...f.first, chapters: "broken" },
      { ...f.first, id: 99, name: "Custom category" },
    ],
  });
  f.backup({ data: [{ ...f.first, name: "Installer recovery" }] });
  expect(
    (await f.service.getAll()).map((category) => [category.id, category.name]),
  ).toEqual([
    [99, "Custom category"],
    [1, "Installer recovery"],
  ]);
  expect((await f.service.get("1"))?.name).toBe("Installer recovery");
});
test("a missing category triggers backup recovery while normal cache reads never touch the backup", async () => {
  const f = fixture();
  f.offline();
  f.backup({
    data: [
      { ...f.first, name: "Older installer value" },
      { ...f.first, id: 2, name: "Missing category" },
    ],
  });
  expect((await f.service.getAll()).map((category) => category.id)).toEqual([
    1,
  ]);
  expect(f.backupReads).toEqual([]);
  expect((await f.service.get("2"))?.name).toBe("Missing category");
  expect(
    (await f.service.getAll()).map((category) => [category.id, category.name]),
  ).toEqual([
    [1, "Original"],
    [2, "Missing category"],
  ]);
  expect(f.calls()).toBe(0);
});
test("a missing ID can be fetched online, and an unknown ID is never replaced with a different category offline", async () => {
  const f = fixture();
  f.respond({ data: [{ ...f.first, id: 2, name: "New server category" }] });
  expect((await f.service.get("2"))?.name).toBe("New server category");
  const offline = fixture();
  offline.offline();
  expect(await offline.service.get("404")).toBeUndefined();
  expect((await offline.service.getAll())[0].id).toBe(1);
});
test("backup lookup uses the project resource in development and installer resource when packaged", async () => {
  const development = fixture();
  development.cache({ data: [] });
  await development.service.getAll();
  expect(development.backupReads[0]).toBe(
    "/fixture-app/resources/category-backup.json",
  );
  const packaged = fixture();
  packaged.packaged();
  packaged.cache({ data: [] });
  await packaged.service.getAll();
  expect(packaged.backupReads[0]).toBe(
    "/fixture-installer/resources/category-backup.json",
  );
});
test("a missing or damaged backup does not discard a still-valid offline cache", async () => {
  for (const backup of [Error("ENOENT"), { data: [{ malformed: true }] }]) {
    const f = fixture();
    f.backup(backup);
    f.offline();
    expect((await f.service.getAll())[0].name).toBe("Original");
    expect(f.calls()).toBe(0);
  }
});


