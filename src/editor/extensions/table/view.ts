import { TableView } from "@tiptap/extension-table";
import type { Node } from "@tiptap/pm/model";
import { TABLE_CELL_MIN_WIDTH, fittedTableColumns, tableColumnWidths } from "./widths";

/** Read the resolved widths owned by the presenter, including fractional columns. */
export function presentedTableColumns(table: HTMLTableElement) {
  return Array.from(
    table.querySelectorAll<HTMLElement>(":scope > colgroup > col"),
    (column) => Number(column.dataset.columnWidth),
  );
}

export function tableWidthBudget(table: HTMLTableElement) {
  const wrapper = table.parentElement!;
  const style = getComputedStyle(wrapper);
  const insets = style.boxSizing === "border-box"
    ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
    : 0;
  return parseFloat(style.width) - insets;
}

/** Responsive column presentation shared by initial render, updates and drag preview. */
export function presentTableColumns(
  table: HTMLTableElement,
  node: Node,
  preview?: readonly number[],
) {
  const widths = preview ?? tableColumnWidths(node);
  const available = tableWidthBudget(table);
  const fitted = available > 0
    ? fittedTableColumns(widths, available)
    : widths.map((width) => width ?? TABLE_CELL_MIN_WIDTH);
  const columns = table.querySelector("colgroup")!;
  while (columns.children.length > widths.length) columns.lastElementChild!.remove();
  fitted.forEach((width, index) => {
    const column = (columns.children[index] ?? columns.appendChild(document.createElement("col"))) as HTMLTableColElement;
    // Clear both properties: native TableView leaves width behind when it sets min-width.
    const css = `width: ${width}px;`;
    if (column.dataset.columnWidth !== String(width) || column.style.minWidth || column.style.maxWidth) {
      column.style.cssText = css;
      column.dataset.columnWidth = String(width);
    }
  });
  if (!table.classList.contains("chapter-table")) table.classList.add("chapter-table");
  const total = fitted.reduce((sum, width) => sum + width, 0);
  if (table.dataset.columnWidth !== String(total) || table.style.minWidth) {
    table.style.width = `${total}px`;
    table.style.minWidth = "";
    table.dataset.columnWidth = String(total);
  }
}

class ChapterTableView extends TableView {
  constructor(node: Node) {
    super(node, TABLE_CELL_MIN_WIDTH);
    presentTableColumns(this.table, node);
  }

  update(node: Node) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    presentTableColumns(this.table, node);
    return true;
  }
}

/** The same native columns and wrapper are used for editable and snapshot tables. */
export function chapterTableView(
  node: Node,
  parentType?: string,
) {
  const view = new ChapterTableView(node);
  const kind = parentType === "figureTable" ? "table" : "grid";
  view.dom.classList.add(kind === "table" ? "node-table" : "node-grid");
  view.table.dataset.type = kind;
  return view;
}
