import { expect, test } from "bun:test";
import { loadSource, loadIPCModule } from "./helpers/load-source";

function fixture() {
  const calls: string[] = [], reports: unknown[] = [];
  let resolve!: (bytes: Uint8Array) => void;
  const generated = new Promise<Uint8Array>(done => { resolve = done; });
  const snapshot = { documentId: "doc" } as EditorPDFSnapshot;
  const host = { crypto: { randomUUID: () => "request-fixture" }, window: { editorPDFExperimental: {
    generate: (input: EditorPDFSnapshot, id: string) => { expect(input).toBe(snapshot); calls.push("generate:" + id); return generated; },
    cancel: async (id: string) => { calls.push("cancel:" + id); },
  } } };
  const api = loadSource<{ generateDocumentPDF(id: string, signal: AbortSignal): Promise<Uint8Array> }>(
    new URL("../src/document-export/generate.ts", import.meta.url), {
      "./capture": { captureDocumentPDF: async (id: string, signal: AbortSignal) => { signal.throwIfAborted(); calls.push("capture:" + id); return snapshot; } },
      "@/editor/pagination/report-error": { paginationReport: (error: unknown) => { reports.push(error); } },
      "@/hooks/use-ipc": loadIPCModule(host),
    },
    host,
  );
  return { api, calls, reports, resolve, generated, snapshot };
}

test("stored-document generation returns canonical bytes and releases cancellation ownership", async () => {
  const { api, calls, resolve, reports } = fixture();
  const controller = new AbortController(), bytes = new Uint8Array([1, 2, 3]);
  const result = api.generateDocumentPDF("doc", controller.signal);
  await Promise.resolve();resolve(bytes);
  expect(await result).toBe(bytes);
  controller.abort();
  expect(calls).toEqual(["capture:doc", "generate:request-fixture"]);
  expect(reports).toEqual([]);
});

test("cancellation aborts its native request and cannot return late PDF bytes", async () => {
  const { api, calls, resolve } = fixture(), controller = new AbortController();
  const result = api.generateDocumentPDF("doc", controller.signal);
  await Promise.resolve();controller.abort();resolve(new Uint8Array([1]));
  await expect(result).rejects.toHaveProperty("name", "AbortError");
  expect(calls).toEqual(["capture:doc", "generate:request-fixture", "cancel:request-fixture"]);
});
