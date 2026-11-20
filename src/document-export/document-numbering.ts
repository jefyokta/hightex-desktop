import type { Editor } from "@tiptap/core";
import { prepareEditorExport } from "./source/prepare-editor";
import { DocumentRenderSession } from "./document-render";

/** Reuse final document assembly, returning metadata without packaging or printing a PDF. */
export async function editorDocumentNumbers(
  editor: Editor,
  signal: AbortSignal,
) {
  const input = await prepareEditorExport(editor, signal);
  const rendering = new DocumentRenderSession(input);
  try {
    const engine = await rendering.render(signal);
    const sections = engine.sections;
    const current = sections.find((section) => section.id === input.active.id);
    if (!current)
      throw Error("Active chapter is absent from document numbering");
    return { labels: [...current.labels] };
  } finally {
    rendering.destroy();
  }
}
