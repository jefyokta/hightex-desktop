import type { CommandProps } from "@tiptap/core";
import { CellSelection, TableMap, cellAround } from "@tiptap/pm/tables";
import { equalTableColumns, setTableColumnWidths } from "./widths";
import { presentedTableColumns, tableWidthBudget } from "./view";

export const applyCellWidthToTable = (position?: number) =>
  ({ state, view, tr, dispatch }: CommandProps) => {
    if (position !== undefined && (position < 0 || position > state.doc.content.size)) return false;
    const selection = state.selection;
    const cell = position !== undefined
      ? state.doc.resolve(position)
      : selection instanceof CellSelection
        ? selection.$anchorCell
        : cellAround(selection.$from);
    const role = cell?.nodeAfter?.type.spec.tableRole;
    if (!cell || (role !== "cell" && role !== "header_cell")) return false;
    const table = cell.node(-1);
    const tablePos = cell.before(-1);
    const wrapper = view.nodeDOM(tablePos) as HTMLElement;
    const element = wrapper.querySelector<HTMLTableElement>(":scope > table");
    if (!element) return false;
    const widths = equalTableColumns(
      presentedTableColumns(element),
      TableMap.get(table).colCount(cell.pos - cell.start(-1)),
      cell.nodeAfter!.attrs.colspan,
      tableWidthBudget(element),
    );
    if (dispatch) setTableColumnWidths(tr, tablePos, widths);
    return true;
  };
