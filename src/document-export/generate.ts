import { useIPC } from "@/hooks/use-ipc";
import { captureDocumentPDF, type DocumentPDFOptions } from "./capture";
import { paginationReport } from "@/editor/pagination/report-error";

/** Read-only stored-document compilation for consumers that need PDF bytes. */
export async function generateDocumentPDF(documentId: string, signal: AbortSignal, options: DocumentPDFOptions = {}) {
  const snapshot = await captureDocumentPDF(documentId, signal, undefined, options);
  const requestId = crypto.randomUUID();
  const cancel = () => {
    void useIPC("editorPDFExperimental").editorPDFExperimental.cancel(requestId).catch(error => {
      const report = paginationReport(error, "Membatalkan kompilasi PDF Split");
      if (report) throw report;
    });
  };
  signal.throwIfAborted();
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const buffer = await useIPC("editorPDFExperimental").editorPDFExperimental.generate(snapshot, requestId);
    signal.throwIfAborted();
    return buffer;
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
