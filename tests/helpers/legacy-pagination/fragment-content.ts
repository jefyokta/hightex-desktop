import type { EditorView } from "@tiptap/pm/view";
import { paginationNode } from "@/editor/pagination/measurement/node-layout";

type FragmentView = Pick<EditorView, "state" | "nodeDOM" | "coordsAtPos">;

export { chapterRenderedText as fragmentText } from "@/editor/chapter/rendered-text";

/** First authored text/inline atom; generated labels and pagination widgets do not count. */
export function fragmentTextPosition(
  view: Pick<EditorView, "state" | "nodeDOM">,
  block: number,
  from: number,
  to: number,
) {
  const source = view.state.doc;
  const owner = source.nodeAt(block);
  if (owner?.isBlock && paginationNode(owner, block)?.kind === "atomic")
    return undefined;
  let first: number | undefined;
  source.nodesBetween(Math.max(block, from), to, (node, position) => {
    if (first !== undefined) return false;
    if (
      node.isInline &&
      node.isAtom &&
      !node.isText &&
      node.type.name !== "hardBreak"
    ) {
      const dom = view.nodeDOM(position);
      // Empty inline math/variables still belong to the source range, but their
      // zero-width DOM cannot locate a page. Keep looking for visible content.
      if (
        dom instanceof HTMLElement &&
        !dom.getBoundingClientRect().width &&
        !firstFragmentGlyph(dom)
      )
        return false;
    }
    if (
      first === undefined &&
      ((node.isText && node.text?.length) ||
        (node.isInline && node.isAtom && node.type.name !== "hardBreak"))
    )
      first = Math.max(from, position);
    return first === undefined;
  });
  return first;
}

export function firstFragmentGlyph(root: HTMLElement): DOMRect | undefined {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!(node instanceof Text) || !node.length) continue;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, Array.from(node.data)[0].length);
    const rect = range.getBoundingClientRect();
    if (rect.width && rect.height) return rect;
  }
}

export function fragmentAnchor(
  view: FragmentView,
  position: number,
): DOMRect | { top: number } {
  const model = view.state.doc.nodeAt(position);
  if (
    model?.isInline &&
    model.isAtom &&
    !model.isText &&
    model.type.name !== "hardBreak"
  ) {
    const dom = view.nodeDOM(position);
    const rect =
      dom instanceof HTMLElement ? firstFragmentGlyph(dom) : undefined;
    if (!rect) throw Error("Missing inline content anchor");
    return rect;
  }
  return view.coordsAtPos(position, 1);
}
