import type { Node } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import type { Attribute } from "@tiptap/core";
import { TableMap } from "@tiptap/pm/tables";

export const TABLE_CELL_MIN_WIDTH = 1;

/** Retain fractional widths from automatic/fitted columns through HTML clipboard round trips. */
export function fractionalColumnWidth(attribute: Attribute): Attribute {
  return {
    ...attribute,
    parseHTML: (element) => {
      const authored = element.getAttribute("colwidth");
      return authored
        ? authored.split(",").map((width) => parseFloat(width))
        : attribute.parseHTML?.(element);
    },
  };
}

/** Column order includes each part of a merged cell, just as TableMap does. */
export function tableColumnWidths(node: Node): (number | null)[] {
  const widths: (number | null)[] = [];
  node.firstChild?.forEach((cell) => {
    for (let index = 0; index < cell.attrs.colspan; index++) {
      const width = cell.attrs.colwidth?.[index];
      widths.push(
        typeof width === "number" && Number.isFinite(width) && width > 0
          ? Math.max(TABLE_CELL_MIN_WIDTH, width)
          : null,
      );
    }
  });
  return widths;
}

/** Preserve explicit widths when they fit; share remaining room between automatic columns. */
export function fittedTableColumns(
  widths: readonly (number | null)[],
  available: number,
): number[] {
  const automatic = widths.filter((width) => width === null).length;
  const total = widths.reduce<number>((sum, width) => sum + (width ?? 0), 0);
  if (total + automatic * TABLE_CELL_MIN_WIDTH <= available) {
    const free = automatic ? (available - total) / automatic : 0;
    return widths.map((width) => width ?? free);
  }
  const fitted = widths.map((width) => width ?? TABLE_CELL_MIN_WIDTH);
  let remaining = available;
  const pending = new Set(widths.map((_, index) => index));
  while (pending.size) {
    const weight = Array.from(pending).reduce((sum, index) => sum + fitted[index], 0);
    const scale = remaining / weight;
    const small = Array.from(pending).filter(
      (index) => fitted[index] * scale < TABLE_CELL_MIN_WIDTH,
    );
    if (!small.length) {
      for (const index of pending) fitted[index] *= scale;
      break;
    }
    for (const index of small) {
      fitted[index] = TABLE_CELL_MIN_WIDTH;
      remaining -= TABLE_CELL_MIN_WIDTH;
      pending.delete(index);
    }
  }
  return fitted;
}

/** A gesture starts from visible columns, including fitted and automatic widths. */
export function resizedTableColumns(
  widths: readonly number[],
  column: number,
  requested: number,
  available: number,
): number[] {
  const next = [...widths];
  const neighbor = column + 1;
  if (neighbor < widths.length) {
    const pair = widths[column] + widths[neighbor];
    next[column] = Math.max(
      TABLE_CELL_MIN_WIDTH, Math.min(pair - TABLE_CELL_MIN_WIDTH, requested),
    );
    next[neighbor] = pair - next[column];
    return next;
  }
  const otherWidth = next.reduce(
    (sum, width, index) => sum + (index === column ? 0 : width), 0,
  );
  const maximum = Math.max(
    TABLE_CELL_MIN_WIDTH, available - otherWidth,
  );
  next[column] = Math.max(
    TABLE_CELL_MIN_WIDTH, Math.min(maximum, requested),
  );
  return next;
}

/** Match every logical column to the clicked cell's per-column visible width. */
export function equalTableColumns(
  widths: readonly number[],
  column: number,
  colspan: number,
  available: number,
): number[] {
  const width = widths.slice(column, column + colspan).reduce((sum, value) => sum + value, 0) / colspan;
  return fittedTableColumns(widths.map(() => width), available);
}

/** One authored resize transaction; colspan/rowspan owners are written once. */
export function setTableColumnWidths(
  transaction: Transaction,
  tablePos: number,
  widths: readonly number[],
) {
  const table = transaction.doc.nodeAt(tablePos)!;
  const map = TableMap.get(table);
  for (const offset of new Set(map.map)) {
    const cell = table.nodeAt(offset)!;
    const column = map.colCount(offset);
    const colwidth = widths.slice(column, column + cell.attrs.colspan);
    if (cell.attrs.colwidth?.every(
      (width: number, index: number) => width === colwidth[index],
    ))
      continue;
    transaction.setNodeMarkup(tablePos + 1 + offset, undefined, {
      ...cell.attrs,
      colwidth,
    });
  }
}
