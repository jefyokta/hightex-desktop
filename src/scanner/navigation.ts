import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";

export const SCANNER_PARAGRAPH_PREFIX = "scanner:paragraph:";

/** Match the punctuation plugin's one-based paragraph order, including empty ones. */
export function findPunctuationParagraph(
  doc: Node,
  paragraph: number,
): number | undefined {
  if (!Number.isInteger(paragraph) || paragraph < 1) return;

  let count = 0;
  let position: number | undefined;
  doc.descendants((node, pos) => {
    if (position !== undefined || node.type.name === "codeBlock") return false;
    if (node.type.name === "paragraph") {
      if (++count === paragraph) position = pos + 1;
      return false;
    }
  });
  return position;
}

export function scrollToPunctuationParagraph(
  editor: Editor,
  paragraph: number,
): void {
  if (editor.isDestroyed) return;
  const position = findPunctuationParagraph(editor.state.doc, paragraph);
  if (position !== undefined) editor.commands.focus(position);
}
