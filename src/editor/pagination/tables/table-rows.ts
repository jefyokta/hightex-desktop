import type { LayoutSnapshot } from "../measurement/layout-snapshot";
import type { PageLayout } from "../flow/page-planner";
import type { TableBreakChange } from "./table-breaks";

/** Own frozen heights and their final recorded effects for one table. */
export class TableRows {
  readonly effects = new Map<number, NonNullable<PageLayout["rows"]>[number]>();
  constructor(
    private readonly snapshot: LayoutSnapshot,
    private readonly rows: PaginationTableRow[],
  ) {}

  freeze() {
    if (this.effects.size) return;
    for (const row of this.rows) {
      row.element.style.setProperty("--editor-row-height", `${row.height}px`);
      row.element.classList.add("editor-pagination-row");
      this.effects.set(row.from, {
        from: row.from,
        to: row.from + row.node.nodeSize,
        height: row.height,
      });
    }
  }

  refresh() {
    for (const row of this.rows) {
      row.height = row.element.getBoundingClientRect().height;
      this.effects.get(row.from)!.height = row.height;
      row.element.style.setProperty("--editor-row-height", `${row.height}px`);
    }
  }

  grow(row: PaginationTableRow, changes: TableBreakChange[]): boolean {
    let growth = 0;
    for (const { cell } of changes) {
      const element = this.snapshot.elements.get(cell.from)!;
      const box = element.getBoundingClientRect();
      let contentBottom = box.top;
      for (const child of Array.from(element.children)) {
        const bounds = child.getBoundingClientRect();
        contentBottom = Math.max(
          contentBottom,
          bounds.bottom +
            (parseFloat(getComputedStyle(child).marginBottom) || 0),
        );
      }
      const required =
        contentBottom -
        box.top +
        (parseFloat(getComputedStyle(element).paddingBottom) || 0);
      const available = this.rows
        .slice(cell.row, cell.end)
        .reduce((sum, item) => sum + item.height, 0);
      growth = Math.max(growth, required - available);
    }
    if (growth > 0) {
      row.height += growth;
      row.element.style.setProperty("--editor-row-height", `${row.height}px`);
      this.effects.get(row.from)!.height = row.height;
      return true;
    }
    return false;
  }
}
