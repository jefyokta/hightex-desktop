import type { Node as ModelNode } from "@tiptap/pm/model";

export interface PaginationListItem {
  from: number;
  to: number;
  number?: number;
}

/** Source ordinals survive slicing; DOM counters cannot infer omitted siblings. */
export function paginationListItems(source: ModelNode) {
  const items = new Map<number, PaginationListItem>();
  source.descendants((node, from, parent, index) => {
    if (node.type.name !== "listItem") return;
    items.set(from, {
      from,
      to: from + node.nodeSize,
      number: parent?.type.name === "orderedList"
        ? Number(parent.attrs.start ?? 1) + index : undefined,
    });
  });
  return items;
}
