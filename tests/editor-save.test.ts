import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createHash, randomUUID } from "node:crypto";
import { loadSource } from "./helpers/load-source";
import en from "../src/locales/en.json";
import id from "../src/locales/id.json";

function fixture() {
  const files = new Map<string, Uint8Array>();
  let canceled = false, failWrite: string | undefined, prompts = 0, conflictChoice = 2;
  let chosenPath = "/documents/thesis.hightex";
  let duringWrite: (() => void) | undefined;
  const missing = () => Object.assign(Error("File missing"), { code: "ENOENT" });
  const archive = { archiveFingerprint: (bytes: Uint8Array) => Buffer.from(bytes).toString("hex") };
  const host = {
    app: { getPath: () => "/downloads" },
    dialog: {
      showSaveDialog: async () => { prompts++; return { canceled, filePath: chosenPath }; },
      showMessageBox: async () => ({ response: conflictChoice }),
    },
  };
  const filesystem = {
    mkdir: async () => {},
    readFile: async (file: string) => { const bytes = files.get(file); if (!bytes) throw missing(); return bytes; },
    realpath: async (file: string) => { if (!files.has(file)) throw missing(); return file; },
    rename: async (source: string, target: string) => { files.set(target, files.get(source)!); files.delete(source); },
    rm: async (file: string) => { files.delete(file); },
    writeFile: async (file: string, buffer: Uint8Array) => {
      if (failWrite) throw Object.assign(Error(`Write failed: ${failWrite}`), { code: failWrite });
      files.set(file, buffer);
      duringWrite?.();
    },
  };
  const service = loadSource<typeof import("../electron/service/document-file-service")>(
    new URL("../electron/service/document-file-service.ts", import.meta.url), {
      electron: host, "node:fs/promises": filesystem, "node:path": path,
      "node:crypto": { createHash, randomUUID }, "../utilities/archive-fingerprint": archive,
      "./config-service": { ConfigService: { getKey: () => "en" } },
      "../../src/locales/en.json": en, "../../src/locales/id.json": id,
    },
  );
  const modules: Record<string, unknown> = {
    electron: host, "../service/document-file-service": service,
    "../utilities/archive-fingerprint": archive,
  };
  const sandbox = { exports: {} as { EditorWindow: typeof import("../electron/windows/editor-window").EditorWindow }, require: (name: string) => modules[name] };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../electron/windows/editor-window.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, sandbox);
  const state = { window: {}, document: { id: "doc" } } as EditorWindowState;
  return {
    save: sandbox.exports.EditorWindow.save, state, files, prompts: () => prompts,
    cancel: (value: boolean) => { canceled = value; }, fail: (code?: string) => { failWrite = code; },
    conflict: (choice: number, destination?: string) => { conflictChoice = choice; if (destination) chosenPath = destination; },
    duringWrite: (action: () => void) => { duringWrite = action; },
  };
}

test("saving again reuses the chosen path and updates both saved baselines", async () => {
  const f = fixture();
  expect(await f.save(f.state, new Uint8Array([1]), "thesis.hightex")).toMatchObject({ status: "saved", filePath: "/documents/thesis.hightex" });
  await f.save(f.state, new Uint8Array([2]), "thesis.hightex");
  expect(f.prompts()).toBe(1);
  expect(f.files.get("/documents/thesis.hightex")).toEqual(new Uint8Array([2]));
  expect(f.state.archiveBaseline).toBe("02");
  expect(f.state.fileBaseline).toBe("02");
});

test("canceling does not write or change the file binding and allows retry", async () => {
  const f = fixture();
  f.cancel(true);
  expect(await f.save(f.state, new Uint8Array([1]), "thesis.hightex")).toEqual({ status: "cancelled" });
  expect(f.files.size).toBe(0);
  expect(f.state.document.filePath).toBeUndefined();
  f.cancel(false);
  await f.save(f.state, new Uint8Array([2]), "thesis.hightex");
  expect(f.prompts()).toBe(2);
  expect(f.files.size).toBe(1);
});

test.each([["ENOSPC", "disk-full"], ["EACCES", "permission"]] as const)("%s preserves the previous file and explains the failure", async (native, code) => {
  const f = fixture();
  await f.save(f.state, new Uint8Array([1]), "thesis.hightex");
  f.fail(native);
  const failed = await f.save(f.state, new Uint8Array([2]), "thesis.hightex");
  expect(failed).toMatchObject({ status: "failed", error: { code, detail: `Write failed: ${native}` } });
  expect(f.files.get("/documents/thesis.hightex")).toEqual(new Uint8Array([1]));
  expect(f.state.archiveBaseline).toBe("01");
  expect(f.files.size).toBe(1);
  f.fail();
  expect(await f.save(f.state, new Uint8Array([2]), "thesis.hightex")).toMatchObject({ status: "saved" });
});

test.each([[2, "cancelled"], [1, "reload"]] as const)("external-change decision %s never overwrites either version", async (choice, status) => {
  const f = fixture();
  await f.save(f.state, new Uint8Array([1]), "thesis.hightex");
  f.files.set("/documents/thesis.hightex", new Uint8Array([3]));
  f.conflict(choice);
  expect(await f.save(f.state, new Uint8Array([2]), "thesis.hightex")).toMatchObject({ status });
  expect(f.files.get("/documents/thesis.hightex")).toEqual(new Uint8Array([3]));
  expect(f.state.archiveBaseline).toBe("01");
});

test("saving a conflict copy keeps the external version and adopts the new path", async () => {
  const f = fixture();
  await f.save(f.state, new Uint8Array([1]), "thesis.hightex");
  f.files.set("/documents/thesis.hightex", new Uint8Array([3]));
  f.conflict(0, "/documents/copy.hightex");
  expect(await f.save(f.state, new Uint8Array([2]), "thesis.hightex")).toMatchObject({ status: "saved", filePath: "/documents/copy.hightex" });
  expect(f.files.get("/documents/thesis.hightex")).toEqual(new Uint8Array([3]));
  expect(f.files.get("/documents/copy.hightex")).toEqual(new Uint8Array([2]));
});

test("a conflict copy cannot use the source path", async () => {
  const f = fixture();
  await f.save(f.state, new Uint8Array([1]), "thesis.hightex");
  f.files.set("/documents/thesis.hightex", new Uint8Array([3]));
  f.conflict(0);
  expect(await f.save(f.state, new Uint8Array([2]), "thesis.hightex")).toMatchObject({ status: "failed", error: { code: "changed" } });
  expect(f.files.get("/documents/thesis.hightex")).toEqual(new Uint8Array([3]));
});

test("a change during the temporary write cancels replacement and removes the temporary file", async () => {
  const f = fixture();
  await f.save(f.state, new Uint8Array([1]), "thesis.hightex");
  f.duringWrite(() => f.files.set("/documents/thesis.hightex", new Uint8Array([3])));
  expect(await f.save(f.state, new Uint8Array([2]), "thesis.hightex")).toMatchObject({ status: "failed", error: { code: "changed" } });
  expect(f.files.get("/documents/thesis.hightex")).toEqual(new Uint8Array([3]));
  expect(f.state.fileBaseline).toBe("01");
  expect(f.files.size).toBe(1);
});
