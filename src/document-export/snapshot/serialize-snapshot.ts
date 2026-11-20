import { sha256Text } from "@/utils/sha256";
import type { DocumentResourceContext } from "@/document-engine/resources/contracts";
import { editorPDFIdentity } from "../../../shared/editor-pdf-contract";
import { editorPDFPresentation } from "./presentation";
import { abortable } from "@/utils/abortable";
import { EditorPDFStateError } from "@/exception/editor-pdf-state-error";
import { t } from "@/utils/lang";

type SnapshotMetadata = Omit<
  EditorPDFSnapshot,
  "html" | "presentation" | "fingerprint" | "pages"
>;

/** Serialize ready content once; callers supply the context bank to record geometry. */
export async function serializePDFSnapshot(
  root: HTMLElement,
  metadata: SnapshotMetadata,
  resources: DocumentResourceContext,
  appearance: string,
  signal: AbortSignal,
  presentationRoot = root,
): Promise<EditorPDFSnapshot> {
  const css = await abortable(resources.styles(), signal);
  signal.throwIfAborted();
  const page = document.implementation.createHTMLDocument();
  page.documentElement.className = appearance;
  page.documentElement.lang = "id";
  const style = page.createElement("style");
  style.textContent = css;
  page.head.append(style);
  const content = root.cloneNode(true) as HTMLElement;
  content.removeAttribute("style");
  page.body.append(content);
  const snapshot: EditorPDFSnapshot = {
    ...metadata,
    pages: metadata.projection.views.length,
    html: "<!doctype html>" + page.documentElement.outerHTML,
    presentation: editorPDFPresentation(presentationRoot),
    fingerprint: "",
  };
  snapshot.fingerprint = await sha256Text(editorPDFIdentity(snapshot));
  resources.assertCurrent();
  if (document.documentElement.className !== appearance)
    throw new EditorPDFStateError(
      t("editor.pagination.pdf_presentation_changed"),
    );
  return snapshot;
}
