import type { Node as ModelNode } from "@tiptap/pm/model";
import { TableMap } from "@tiptap/pm/tables";

/** Recover measured columns for native template tables without a colgroup. */
export function tableFragmentColumns(
  table: ModelNode,
  bounds: { left: number; width: number },
  cellBounds: (from: number) => { left: number; right: number },
): number[] {
  const width = TableMap.get(table).width;
  const edges = new Map<number, number>([
    [0, 0],
    [width, bounds.width],
  ]);
  for (const cell of tableFragmentCells(table, 0, table.childCount)) {
    const box = cellBounds(cell.from);
    if (cell.column) edges.set(cell.column, box.left - bounds.left);
    if (cell.column + cell.colspan < width)
      edges.set(cell.column + cell.colspan, box.right - bounds.left);
  }
  const known = [...edges.keys()].sort((a, b) => a - b);
  for (let index = 1; index < known.length; index++) {
    const first = known[index - 1],
      last = known[index];
    for (let column = first + 1; column < last; column++)
      edges.set(
        column,
        edges.get(first)! +
          ((edges.get(last)! - edges.get(first)!) * (column - first)) /
            (last - first),
      );
  }
  return Array.from(
    { length: width },
    (_, column) => edges.get(column + 1)! - edges.get(column)!,
  );
}

/** Project native grid ownership into included source rows; never paginate cells. */
export function tableFragmentCells(
  table: ModelNode,
  first: number,
  end: number,
) {
  const map = TableMap.get(table);
  if (map.problems?.length || first < 0 || end > map.height || first >= end)
    throw Error("Invalid table fragment grid");
  return Array.from(new Set(map.map))
    .flatMap((from) => {
      const cell = map.findCell(from);
      const top = Math.max(first, cell.top),
        bottom = Math.min(end, cell.bottom);
      return top >= bottom
        ? []
        : [
            {
              from,
              row: top,
              column: cell.left,
              colspan: cell.right - cell.left,
              rowspan: bottom - top,
            },
          ];
    })
    .sort((a, b) => a.row - b.row || a.column - b.column);
}
