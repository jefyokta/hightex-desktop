import { abortable } from "@/utils/abortable";
import { Storage } from "@/editor/storage";
import { documentRenderFingerprint, documentRenderModel } from "@/editor/document/render-model";
import { readDocumentRenderSnapshot } from "@/editor/storage/document-render-snapshot";

/** Committed, portable export input. Live layout reads keep their own observer lifecycle. */
export async function readExportDocument(documentId: string, signal: AbortSignal) {
  // Export cancels its wait, never the document's queued autosave.
  await abortable(Storage.instance.waitForDocument(documentId), signal);
  const snapshot = await readDocumentRenderSnapshot(documentId, signal);
  const model = await abortable(documentRenderModel(snapshot), signal);
  const sourceHash = await abortable(documentRenderFingerprint(model), signal);
  return { data: snapshot.document, model, sourceHash };
}
