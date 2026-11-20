import type { Editor } from "@tiptap/core";
import { getEditorChapter } from "../../editor/event";
import { paginationKey } from "../../editor/pagination/state";
import { paginationGeometry } from "../../editor/pagination/options";
import { PageImageSnapshot } from "../../editor/pagination/measurement/image-snapshot";
import { readExportDocument } from "./document-snapshot";
import { DocumentResources } from "../../document-engine/resources/document-resources";
import { t } from "@/utils/lang";
import { waitForEditorExport } from "./editor-readiness";
import { chapterRenderedText } from "../../editor/chapter/rendered-text";
import { Document } from "../../editor/document";
import { chapterSnapshotSource } from "../../editor/chapter/snapshot-source";
import { documentSnapshotModel } from "../../editor/document/snapshot-model";
import { paginationSection } from "../../editor/pagination/section-context";
import { mergeSectionOptions } from "@/utils/section-options";
import { EditorPDFStateError } from "@/exception/editor-pdf-state-error";
import type { DocumentExportInput } from "../document-render";

/** Flush and validate the edited revision; compile every section from the stored snapshot. */
export async function prepareEditorExport(editor: Editor, signal: AbortSignal): Promise<
  DocumentExportInput & { active: NonNullable<DocumentExportInput["active"]> }
> {
  const { chapter, source, plan, options } = await waitForEditorExport(
    editor,
    signal,
  );
  const appearance = document.documentElement.className;
  const category = chapter.document.category;
  if (!category)
    throw new EditorPDFStateError(t("editor.pagination.pdf_editor_not_ready"));
  const frozenCategory = structuredClone(category);
  const version = chapter.getVersion() ?? undefined;
  const images = new PageImageSnapshot(editor.view);
  const visibleText = chapterRenderedText(editor.view, 0, source.content.size);
  const { data, model, sourceHash } = await readExportDocument(chapter.getDocumentId(), signal);
  signal.throwIfAborted();
  const next = !editor.isDestroyed && paginationKey.getState(editor.state);
  if (
    !next ||
    editor.view.composing ||
    !next.enabled ||
    next.pending ||
    next.layout !== plan ||
    next.options !== options ||
    document.documentElement.className !== appearance ||
    editor.state.doc !== source ||
    getEditorChapter(editor) !== chapter ||
    chapter.document.category !== category
  )
    throw new EditorPDFStateError(t("editor.pagination.pdf_source_changed"));
  if (document.fonts.status !== "loaded")
    throw new EditorPDFStateError(
      t("editor.pagination.pdf_resources_loading"),
    );
  if (
    chapterRenderedText(editor.view, 0, source.content.size) !== visibleText
  )
    throw new EditorPDFStateError(
      t("editor.pagination.pdf_citations_changed"),
    );
  const issue = images.issue;
  if (issue)
    throw new EditorPDFStateError(
      t(
        issue.reason === "unavailable"
          ? "editor.pagination.pdf_image_unavailable"
          : "editor.pagination.pdf_image_changed",
        { image: issue.image },
      ),
    );
  const documentContext = Document.fromSnapshot(
    data,
    frozenCategory,
    version,
  );
  const key = chapter.getId().slice(chapter.getDocumentId().length + 1);
  const stored = model.chapters.find((item) => item.id === key);
  const content = chapter.sourceContent(stored?.content);
  // Query-generated headings have no stored ID until the first edit. The text
  // must still match the chapter's own fallback before adopting its presentation ID.
  if (
    stored?.content[0]?.type !== "heading" &&
    source.firstChild?.type.name === "heading" &&
    source.firstChild.textContent === chapter.title
  )
    content[0] = source.firstChild.toJSON();
  if (
    !source.eq(
      chapterSnapshotSource(
        source.type.schema,
        content,
        chapter.getId(),
        source,
      ),
    )
  )
    throw new EditorPDFStateError(t("editor.pagination.pdf_source_changed"));
  const renderModel = documentSnapshotModel(documentContext, model);
  const group = paginationSection(editor.view.dom.closest(".page"));
  return {
    version,
    model: renderModel,
    active: {
      id: chapter.getChapter(),
      group,
      options:
        options.section || options.sections?.[group]
          ? mergeSectionOptions(options.sections?.[group], options.section)
          : undefined,
    },
    sectionOptions: structuredClone(options.sections),
    data,
    category: frozenCategory,
    baseGeometry: paginationGeometry({
      ...options,
      section: undefined,
      sections: undefined,
    }),
    resources: new DocumentResources(signal),
    appearance,
    sourceHash,
  };
}
