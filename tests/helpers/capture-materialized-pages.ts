import type { DocumentResourceContext } from "../../src/document-engine/resources/contracts";
import { captureDocumentContexts } from "../../src/document-export/snapshot/capture-contexts";

type MaterializedMetadata = Omit<EditorPDFContent, "html" | "presentation" | "fingerprint" | "pages"> &
  { chapterId?: string; sections?: EditorPDFSection[] };

/** Adapt historical diagnostic pages to the same canonical transport used by the app. */
export async function captureMaterializedPages(
  root: HTMLElement,
  metadata: MaterializedMetadata,
  resources: DocumentResourceContext,
  appearance: string,
  signal: AbortSignal,
): Promise<EditorPDFSnapshot> {
  await resources.prepare(root);
  const pages = Array.from(root.children, element => ({
    element: element as HTMLElement,
    content: element as HTMLElement,
  }));
  const sections = metadata.sections ?? [{
    id: metadata.chapterId?.slice(metadata.documentId.length + 1) ?? "1", firstPage: 1,
    pages: pages.length,
    labels: pages.map(page => page.element.dataset.pageLabel ?? ""),
  }];
  const { documentId, title, author, sourceHash, planHash } = metadata;
  return captureDocumentContexts(pages,
    { documentId, title, author, sourceHash, planHash, sections },
    resources, appearance, signal);
}
