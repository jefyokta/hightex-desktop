import type { DocumentExportInput } from "../document-render";
import { paginationGeometry } from "../../editor/pagination/options";
import { readExportDocument } from "./document-snapshot";
import { DocumentResources } from "../../document-engine/resources/document-resources";
import { t } from "@/utils/lang";
import { Document } from "../../editor/document";
import { documentSnapshotModel } from "../../editor/document/snapshot-model";
import { EditorPDFStateError } from "@/exception/editor-pdf-state-error";

export async function prepareDocumentExport(
  source: Document | string,
  signal: AbortSignal,
): Promise<DocumentExportInput> {
  const frozenCategory = typeof source === "string" ? undefined :
    source.category && structuredClone(source.category);
  if (typeof source !== "string" && !frozenCategory)
    throw new EditorPDFStateError(t("editor.pagination.pdf_editor_not_ready"));
  const appearance = document.documentElement.className;
  const version = typeof source === "string" ? undefined : source.getVersion();
  const { data, model, sourceHash } = await readExportDocument(
    typeof source === "string" ? source : source.id, signal, version,
  );
  const category = frozenCategory ?? structuredClone(await Document.resolveCategory(data.category));
  signal.throwIfAborted();
  return {
    data,
    model: documentSnapshotModel(
      Document.fromSnapshot(data, category, version),
      model,
    ),
    category,
    baseGeometry: paginationGeometry(),
    resources: new DocumentResources(signal),
    appearance,
    sourceHash,
    version,
  };
}
