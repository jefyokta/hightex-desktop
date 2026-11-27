import { abortable } from "@/utils/abortable";
import { Storage } from "@/editor/storage";
import { documentRenderFingerprint, documentRenderModel } from "@/editor/document/render-model";
import { readDocumentRenderSnapshot } from "@/editor/storage/document-render-snapshot";

/** Committed, portable export input. Live layout reads keep their own observer lifecycle. */
export async function readExportDocument(documentId: string, signal: AbortSignal, version?: string) {
  // Export cancels its wait, never the document's queued autosave.
  await abortable(Storage.instance.waitForDocument(documentId), signal);
  const snapshot = await readDocumentRenderSnapshot(documentId, signal);
  // Archives retain every revision; one PDF contains only its selected revision.
  const suffix = version ? `.${version}` : "";
  snapshot.chapters = snapshot.chapters.filter(chapter => {
    const key = chapter.id.slice(documentId.length + 1);
    return suffix
      ? key.endsWith(suffix) && !key.slice(0, -suffix.length).includes(".")
      : !key.includes(".");
  });
  const model = await abortable(documentRenderModel(snapshot), signal);
  const sourceHash = await abortable(documentRenderFingerprint(model), signal);
  return { data: snapshot.document, model, sourceHash };
}
