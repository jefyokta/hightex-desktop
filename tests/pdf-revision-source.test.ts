import { expect, test } from "bun:test";
import { loadSource } from "./helpers/load-source";

test("PDF source selects current or historical chapters without changing the archive records", async () => {
  const stored = { document: { id: "doc" }, chapters: [
    { id: "doc.1", content: ["CURRENT"] }, { id: "doc.1.v1", content: ["HISTORY"] },
    { id: "doc.abstract", content: ["CURRENT ABSTRACT"] }, { id: "doc.abstract.v1", content: ["OLD ABSTRACT"] },
    { id: "doc.1.v2", content: ["OTHER REVISION"] },
  ] };
  const { readExportDocument } = loadSource<{ readExportDocument(id: string, signal: AbortSignal, version?: string): Promise<{ model: { chapters: typeof stored.chapters } }> }>(
    new URL("../src/document-export/source/document-snapshot.ts", import.meta.url), {
      "@/utils/abortable": { abortable: async (work: unknown, signal: AbortSignal) => { signal.throwIfAborted(); return work; } },
      "@/editor/storage": { Storage: { instance: { waitForDocument: async () => {} } } },
      "@/editor/storage/document-render-snapshot": { readDocumentRenderSnapshot: async () => structuredClone(stored) },
      "@/editor/document/render-model": { documentRenderModel: async (snapshot: unknown) => snapshot, documentRenderFingerprint: async () => "hash" },
    },
  );
  const signal = new AbortController().signal;
  expect((await readExportDocument("doc", signal)).model.chapters.map(item => item.id)).toEqual(["doc.1", "doc.abstract"]);
  expect((await readExportDocument("doc", signal, "v1")).model.chapters.map(item => item.id)).toEqual(["doc.1.v1", "doc.abstract.v1"]);
  expect((await readExportDocument("doc", signal, "missing")).model.chapters).toEqual([]);
  expect(stored.chapters).toHaveLength(5);
});
