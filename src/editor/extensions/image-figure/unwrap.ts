import { Fragment } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

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
  const caption = figure.lastChild!;
  const nodes = [image];
  if (caption.content.size > 0)
    nodes.push(
      state.schema.nodes.paragraph.create(
        caption.attrs,
        caption.content,
        caption.marks,
      ),
    );

  const $from = state.doc.resolve(from);
  const replacement = Fragment.fromArray(nodes);
  if (!$from.parent.canReplace($from.index(), $from.index() + 1, replacement))
    return null;

  const tr = state.tr.replaceWith(from, from + figure.nodeSize, replacement);
  const { selection } = state;
  const captionStart = from + image.nodeSize + 2;
  if (
    caption.content.size > 0 &&
    selection instanceof TextSelection &&
    selection.from >= captionStart &&
    selection.to <= captionStart + caption.content.size
  )
    tr.setSelection(
      TextSelection.create(tr.doc, selection.anchor - 1, selection.head - 1),
    );
  return tr;
}
