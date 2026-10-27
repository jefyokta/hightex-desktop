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
