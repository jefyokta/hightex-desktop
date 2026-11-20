import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

/** Isolate Electron source under explicit host dependencies without global module mocks. */
export function loadSource<T>(file: URL, modules: Record<string, unknown>): T {
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
