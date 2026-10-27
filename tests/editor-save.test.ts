import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function fixture() {
  const files = new Map<string, Uint8Array>();
  let canceled = false;
  let failWrite = false;
  let prompts = 0;
  const modules: Record<string, unknown> = {
    electron: {
      app: { getPath: () => "/downloads" },
      dialog: {
        showSaveDialog: async () => {
          prompts++;
          return { canceled, filePath: "/documents/thesis.hightex" };
        },
      },
    },
    "./../main/application": {},
    fs: {
      default: {
        mkdirSync() {},
        writeFileSync: (file: string, buffer: Uint8Array) => {
          if (failWrite) throw new Error("Disk full");
          files.set(file, buffer);
        },
      },
    },
    path: { default: path },
  };
  const sandbox = {
    exports: {} as {
      EditorWindow: typeof import("../electron/windows/editor-window").EditorWindow;
    },
    require: (name: string) => modules[name],
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../electron/windows/editor-window.ts", import.meta.url),
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
  const state = {
    window: {},
    document: { id: "doc" },
  } as EditorWindowState;
  return {
    save: sandbox.exports.EditorWindow.save,
    state,
    files,
    prompts: () => prompts,
    cancel: (value: boolean) => (canceled = value),
    fail: (value: boolean) => (failWrite = value),
  };
}

test("saving again reuses the chosen file path and writes the latest bytes", async () => {
  const f = fixture();
  const first = new Uint8Array([1]);
  const latest = new Uint8Array([2]);
  expect(await f.save(f.state, first, "thesis.hightex")).toBe(
    "/documents/thesis.hightex",
  );
  expect(f.state.document.filePath).toBe("/documents/thesis.hightex");
  await f.save(f.state, latest, "thesis.hightex");
  expect(f.prompts()).toBe(1);
  expect(f.files.get("/documents/thesis.hightex")).toEqual(latest);
});

test("canceling does not write or remember a file path and allows another save", async () => {
  const f = fixture();
  f.cancel(true);
  expect(await f.save(f.state, new Uint8Array([1]), "thesis.hightex")).toBe(
    undefined,
  );
  expect(f.files.size).toBe(0);
  expect(f.state.document.filePath).toBeUndefined();
  f.cancel(false);
  await f.save(f.state, new Uint8Array([2]), "thesis.hightex");
  expect(f.prompts()).toBe(2);
  expect(f.files.size).toBe(1);
});

test("a failed write preserves the error and allows retrying the save", async () => {
  const f = fixture();
  f.fail(true);
  await expect(
    f.save(f.state, new Uint8Array([1]), "thesis.hightex"),
  ).rejects.toThrow("Disk full");
  expect(f.state.document.filePath).toBeUndefined();
  f.fail(false);
  await f.save(f.state, new Uint8Array([2]), "thesis.hightex");
  expect(f.files.size).toBe(1);
});
