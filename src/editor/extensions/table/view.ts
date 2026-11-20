import { Table, TableView } from "@tiptap/extension-table";
import type { Node } from "@tiptap/pm/model";

/** The same native columns and wrapper are used for editable and snapshot tables. */
export function chapterTableView(
  node: Node,
  parentType?: string,
  cellMinWidth = Table.options.cellMinWidth,
) {
  const view = new TableView(node, cellMinWidth);
  const kind = parentType === "figureTable" ? "table" : "grid";
  view.dom.classList.add(kind === "table" ? "node-table" : "node-grid");
  view.table.dataset.type = kind;
  return view;
}
