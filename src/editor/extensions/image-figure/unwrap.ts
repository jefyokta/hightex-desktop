import type { EditorState, Transaction } from "@tiptap/pm/state";

export function unwrapImageFigure(
  state: EditorState,
  position: number | undefined,
): Transaction | null {
  if (position === undefined) return null;
  const $pos = state.doc.resolve(position);
  const from =
    $pos.nodeAfter?.type.name === "imageFigure"
      ? position
      : $pos.parent.type.name === "imageFigure"
        ? $pos.before()
        : undefined;
  if (from === undefined) return null;

  const figure = state.doc.nodeAt(from)!;
  const image = figure.firstChild!;
  const $from = state.doc.resolve(from);
  if (!$from.parent.canReplaceWith($from.index(), $from.index() + 1, image.type, image.marks))
    return null;

  return state.tr.replaceWith(from, from + figure.nodeSize, image);
}
