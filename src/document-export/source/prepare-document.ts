import type { DocumentExportInput } from "../document-render";
import { paginationGeometry } from "../../editor/pagination/options";
import { readExportDocument } from "./document-snapshot";
import { DocumentResources } from "../../document-engine/resources/document-resources";
import { t } from "@/utils/lang";
import { Document } from "../../editor/document";
import { documentSnapshotModel } from "../../editor/document/snapshot-model";
import { EditorPDFStateError } from "@/exception/editor-pdf-state-error";

export async function prepareDocumentExport(
  source: Document,
  signal: AbortSignal,
): Promise<DocumentExportInput> {
  if (!source.category)
    throw new EditorPDFStateError(t("editor.pagination.pdf_editor_not_ready"));
  const category = structuredClone(source.category);
  const appearance = document.documentElement.className;
  const version = source.getVersion();
  const { data, model, sourceHash } = await readExportDocument(source.id, signal, version);
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
