import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function fixture(type: "local" | "cloud" | undefined) {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const opened: string[] = [];
  let fetched = 0;
  const runtime = { profile: type ? { type } : undefined };
  const modules: Record<string, unknown> = {
    electron: {
      shell: {
        openExternal: async (url: string) => {
          opened.push(url);
        },
      },
    },
    "@main/utilities/ipc-main": {
      IPCMain: {
        handle: (channel: string, action: (...args: unknown[]) => unknown) =>
          handlers.set(channel, action),
      },
    },
    "../workspaces/runtime": { WorkspaceRuntime: runtime },
    "../service/lecturer-directory-service": {
      lecturerCloud: {
        fetch: () => {
          fetched++;
          return { ok: true };
        },
      },
    },
    "../url/server-url": {
      ServerUrl: {
        instance: {
          resolve: (path: string) => new URL(path, "http://127.0.0.1:8000/"),
        },
      },
    },
  };
  const sandbox = {
    exports: {} as typeof import("../electron/handlers/hightex-handlers"),
    require: (name: string) => modules[name] ?? {},
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../electron/handlers/hightex-handlers.ts", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      },
    ).outputText,
    sandbox,
  );
  sandbox.exports.HighTexHandler.register();
  return {
    call: (channel: string) => handlers.get(channel)!(),
    opened,
    fetched: () => fetched,
    runtime,
  };
}

test("Local or unresolved workspaces report their restriction without fetching or opening login", async () => {
  for (const type of ["local", undefined] as const) {
    const f = fixture(type);
    expect(await f.call("hightex:lecturers:cloud")).toEqual({
      ok: false,
      error: "local_workspace",
    });
    expect(f.fetched()).toBe(0);
  }
  const cloud = fixture("cloud");
  expect(await cloud.call("hightex:lecturers:cloud")).toEqual({ ok: true });
  expect(cloud.fetched()).toBe(1);
});

test("browser download uses the configured website and leaves the Local workspace unchanged", async () => {
  const f = fixture("local");
  await f.call("hightex:lecturers:web-download");
  expect(f.opened).toEqual(["http://127.0.0.1:8000/lecturers/export"]);
  expect(f.runtime.profile?.type).toBe("local");
  expect(f.fetched()).toBe(0);
});
