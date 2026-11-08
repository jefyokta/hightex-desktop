import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function fixture() {
  const flushed: string[] = [];
  let compared = 0,
    stopped = 0,
    removed = 0;
  let read: () => Promise<unknown> = async () => ({
    id: "branch",
    parentId: "main",
  });
  let flush: (id: string) => Promise<void> = async () => {};
  let complete: (result: unknown) => void = () => {};
  let observer: { next(snapshot: unknown): void } | undefined;
  const modules: Record<string, unknown> = {
    dexie: {
      liveQuery: () => ({
        subscribe: (listener: typeof observer) => {
          observer = listener;
          return { unsubscribe: () => stopped++ };
        },
      }),
    },
    "./hightex-db": {
      HighTexDB: { getInstance: () => ({ documents: { get: () => read() } }) },
    },
    "./document-comparison": {
      compareDocumentBranch: () => {
        compared++;
        return new Promise((resolve) => {
          complete = resolve;
        });
      },
    },
    "@/utils/content-assets": {},
    "@/utils/is-static-var": {},
  };
  const sandbox = {
    exports: {} as typeof import("../src/editor/storage/comparison-session"),
    require: (name: string) => modules[name],
    DOMException,
    window: {
      editor: {
        flush: async (id: string) => {
          flushed.push(id);
          await flush(id);
        },
      },
      profile: { onChange: () => () => removed++ },
      session: { onChange: () => () => removed++ },
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../src/editor/storage/comparison-session.ts", import.meta.url),
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
  return {
    api: sandbox.exports,
    flushed,
    compared: () => compared,
    stopped: () => stopped,
    removed: () => removed,
    read: (action: typeof read) => {
      read = action;
    },
    flush: (action: typeof flush) => {
      flush = action;
    },
    emit: (snapshot: unknown) => observer!.next(snapshot),
    complete: (result: unknown) => complete(result),
    observing: () => Boolean(observer),
  };
}
const tick = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
const snapshot = (title: string) => ({
  documents: [{ title }],
  chapters: [],
  references: [],
  aliases: [],
  variables: [],
  images: [],
});

test("closing comparison during its initial read never flushes or activates another editor", async () => {
  const f = fixture();
  let finish!: (value: unknown) => void;
  f.read(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const controller = new AbortController();
  const work = f.api.openDocumentComparison(
    "branch",
    () => {},
    controller.signal,
  );
  controller.abort();
  finish({ id: "branch", parentId: "main" });
  await expect(work).rejects.toThrow();
  expect(f.flushed).toEqual([]);
  expect(f.compared()).toBe(0);
});

test("an editor that is not ready stops capture instead of comparing placeholder content", async () => {
  const f = fixture();
  f.flush(async () => {
    throw Error("Editor is not ready");
  });
  await expect(
    f.api.openDocumentComparison(
      "branch",
      () => {},
      new AbortController().signal,
    ),
  ).rejects.toThrow("Editor is not ready");
  expect(f.compared()).toBe(0);
  expect(f.observing()).toBe(false);
});

test("source changes during capture are reported, and cancellation discards a late comparison", async () => {
  const f = fixture();
  const controller = new AbortController();
  let changed = 0;
  const work = f.api.openDocumentComparison(
    "branch",
    () => changed++,
    controller.signal,
  );
  await tick();
  f.emit(snapshot("Before"));
  await tick();
  expect(f.compared()).toBe(1);
  f.emit(snapshot("After"));
  await tick();
  expect(changed).toBe(1);
  controller.abort();
  f.complete({ main: { id: "main" } });
  await expect(work).rejects.toThrow();
  expect(f.stopped()).toBe(1);
  expect(f.removed()).toBe(2);
  f.emit(snapshot("Later"));
  await tick();
  expect(changed).toBe(1);
});
