import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function fixture(saved?: Partial<ConfigShape>) {
  const values = new Map<string, unknown>();
  if (saved) values.set("app", saved);
  const modules: Record<string, unknown> = {
    electron: { app: { getPath: () => "/fixture/downloads" } },
    "electron-store": {
      default: class {
        get(key: string) {
          return values.get(key);
        }
        set(key: string, value: unknown) {
          values.set(key, value);
        }
      },
    },
  };
  const sandbox = {
    exports: {} as {
      ConfigService: typeof import("../electron/service/config-service").ConfigService;
    },
    require: (name: string) => modules[name],
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../electron/service/config-service.ts", import.meta.url),
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
  return { service: sandbox.exports.ConfigService, values };
}

test("experimental pagination stays opt-in for new and older saved settings", () => {
  expect(fixture().service.get().editor.pagination).toBe(false);
  expect(
    fixture({ editor: { spellCheck: true } }).service.get().editor.pagination,
  ).toBe(false);
  const { service, values } = fixture({
    editor: { spellCheck: true, pagination: true },
  });
  service.set({ theme: "dark" });
  expect(
    fixture(values.get("app") as ConfigShape).service.get().editor.pagination,
  ).toBe(true);
  service.set({ editor: { pagination: false } });
  const reopened = fixture(values.get("app") as ConfigShape).service;
  expect(reopened.get().editor).toMatchObject({
    spellCheck: true,
    pagination: false,
  });
  expect(reopened.reset().editor.pagination).toBe(false);
});

test("resize guides default to true for new and previously saved editor settings", () => {
  expect(fixture().service.get().editor.tableResizeGuides).toBe(true);
  const { service } = fixture({
    editor: { spellCheck: true, aliasHint: true },
  });
  expect(service.get().editor).toMatchObject({
    spellCheck: true,
    aliasHint: true,
    tableResizeGuides: true,
  });
});

test("disabled resize guides survive partial updates and reopening saved config", () => {
  const { service, values } = fixture({ editor: { aliasHint: true } });
  service.set({ editor: { tableResizeGuides: false } });
  service.set({ editor: { spellCheck: true } });
  service.set({ theme: "dark" });

  const reopened = fixture(values.get("app") as ConfigShape).service;
  expect(reopened.get().editor).toMatchObject({
    tableResizeGuides: false,
    spellCheck: true,
    aliasHint: true,
  });
  expect(reopened.get().theme).toBe("dark");
  expect(reopened.reset().editor.tableResizeGuides).toBe(true);
  expect(reopened.get().editor.tableResizeGuides).toBe(true);
});

test("section patches preserve settings owned by other controls", () => {
  const { service } = fixture();
  service.set({ export: { saveDialog: true, exportTimeout: 45000 } });
  service.set({ export: { saveFolder: "/fixture/exports" } });
  service.set({ zotero: { enabled: true, port: 23120 } });
  service.set({ zotero: { host: "localhost" } });
  service.set({ previewer: { scope: "full" } });

  expect(service.get().export).toEqual({
    saveDialog: true, saveFolder: "/fixture/exports", exportTimeout: 45000,
  });
  expect(service.get().zotero).toEqual({ enabled: true, port: 23120, host: "localhost" });
  expect(service.get().previewer).toEqual({ scope: "full", autoUpdate: false, layoutIndicator: true });
});
