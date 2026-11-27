import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

/** Isolate Electron source under explicit host dependencies without global module mocks. */
export function loadSource<T>(file: URL, modules: Record<string, unknown>, host: Record<string, unknown> = {}): T {
  const sandbox = {
    exports: {} as T,
    require: (name: string) => {
      if (!(name in modules)) throw Error(`Unexpected import: ${name}`);
      return modules[name];
    },
    setTimeout,
    clearTimeout,
    Date,
    structuredClone,
    AbortController,
    ...host,
  };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText,
    sandbox,
  );
  return sandbox.exports;
}

/** Run the real resolver against the same explicit window as the isolated renderer source. */
export function loadIPCModule(host: Record<string, unknown> = {}) {
  return loadSource<typeof import("../../src/hooks/use-ipc")>(
    new URL("../../src/hooks/use-ipc.ts", import.meta.url), {}, host,
  );
}
