import type { PaginationSourceRange } from "./types";
import type { Node as ModelNode } from "@tiptap/pm/model";
import type { PageLayout } from "@/editor/pagination/flow/page-planner";
import { tableFragmentCells } from "./table-fragments";
import { paginationNode } from "@/editor/pagination/measurement/node-layout";

/** Project source blocks and recorded cuts; the adapter reads their already placed page. */
export function pageFragmentRanges(
  source: ModelNode,
  layout: PageLayout,
  pageAt: (block: number, from: number, to: number) => number,
): PaginationSourceRange[] {
  if (layout.error || !Number.isInteger(layout.pages) || layout.pages < 1)
    throw Error("Cannot fragment a failed page plan");
  source.descendants((node) => {
    if (
      ["tableCell", "tableHeader"].includes(node.type.name) &&
      [node.attrs.colspan ?? 1, node.attrs.rowspan ?? 1].some(
        (value) => !Number.isInteger(value) || value < 1,
      )
    )
      throw Error("Invalid table cell span");
    if (node.type.name === "table") {
      tableFragmentCells(node, 0, node.childCount);
    }
  });
  for (const cut of layout.breaks) {
    if (
      !Number.isInteger(cut.from) ||
      cut.from < 0 ||
      cut.from > source.content.size
    )
      throw Error("Invalid source page range");
    const point = source.resolve(cut.from);
    if (point.parent.type.name === "heading")
      throw Error("Splitting a heading across pages is not supported");
    if (point.parent.type.name === "paragraph" && point.parentOffset === 0)
      throw Error("A first-line break must use its block boundary");
  }
  const result: PaginationSourceRange[] = [];
  let consumed = 0;
  source.descendants((node, block) => {
    const atomic = paginationNode(node, block)?.kind === "atomic";
    if (!node.isTextblock && !atomic && !node.isLeaf) return;
    const end = block + node.nodeSize;
    const cuts = [
      ...new Set(
        layout.breaks
          .filter((cut) => cut.from > block && cut.from < end)
          .map((cut) => cut.from),
      ),
      end,
    ].sort((a, b) => a - b);
    if (atomic && cuts.length > 1)
      throw Error("An image and caption must remain indivisible");
    let start = block;
    for (const to of cuts) {
      const page = pageAt(block, start, to);
      if (!Number.isInteger(page) || page < 1 || page > layout.pages)
        throw Error("Source range lies outside its recorded page plan");
      result.push({
        page,
        block,
        from: consumed,
        to,
        slice: source.slice(consumed, to, true),
      });
      consumed = to;
      start = to;
    }
    return false;
  });
  if (!result.length) {
    if (source.content.size) throw Error("No source fragments were captured");
    return [];
  }
  const last = result[result.length - 1];
  last.to = source.content.size;
  last.slice = source.slice(last.from, last.to, true);
  return result;
}
