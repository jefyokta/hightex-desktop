import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const tableBorderPluginKey = new PluginKey<DecorationSet>(
  "table-header-border",
);

interface TableRow {
  node: PMNode;
  pos: number;
  index: number;
}

interface TableCell {
  node: PMNode;
  pos: number;
  index: number;
}

/** Rowspan boundaries shared by the live editor and static comparison rendering. */
export function headerLikeRowIndexes(
  rows: readonly (readonly { header: boolean; rowspan: number }[])[],
): number[] {
  const indexes = new Set<number>();
  rows.forEach((row, index) =>
    row.forEach((cell) => {
      const end = index + Math.max(1, cell.rowspan) - 1;
      if (cell.header && end > index && end < rows.length) indexes.add(end);
    }),
  );
  return [...indexes];
}

export function createTableBorderPlugin() {
  return new Plugin<DecorationSet>({
    key: tableBorderPluginKey,

    state: {
      init(_, state) {
        return buildDecorations(state.doc);
      },

      apply(tr, oldDecorations, _oldState, newState) {
        if (!tr.docChanged) {
          return oldDecorations;
        }

        return buildDecorations(newState.doc);
      },
    },

    props: {
      decorations(state) {
        return tableBorderPluginKey.getState(state) ?? DecorationSet.empty;
      },
    },
  });
}

function buildDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "table") {
      return;
    }

    decorateTable(node, pos, decorations);
  });

  return DecorationSet.create(doc, decorations);
}

function decorateTable(
  table: PMNode,
  tablePos: number,
  decorations: Decoration[],
) {
  const rows = getRows(table, tablePos);
  const indexes = headerLikeRowIndexes(
    rows.map((row) =>
      getCells(row).map((cell) => ({
        header: cell.node.type.name === "tableHeader",
        rowspan: Number(cell.node.attrs.rowspan ?? 1),
      })),
    ),
  );
  for (const index of indexes) decorateRow(rows[index], decorations);
}

function decorateRow(row: TableRow, decorations: Decoration[]) {
  const cells = getCells(row);

  for (const cell of cells) {
    decorations.push(
      Decoration.node(cell.pos, cell.pos + cell.node.nodeSize, {
        class: "table-header-like",
        tableHeaderLike: "1",
      }),
    );
  }
}

function getRows(table: PMNode, tablePos: number): TableRow[] {
  const rows: TableRow[] = [];

  let offset = 0;
  let index = 0;

  table.forEach((row) => {
    if (row.type.name === "tableRow") {
      rows.push({
        node: row,
        pos: tablePos + 1 + offset,
        index,
      });

      index++;
    }

    offset += row.nodeSize;
  });

  return rows;
}

function getCells(row: TableRow): TableCell[] {
  const cells: TableCell[] = [];

  let offset = 0;
  let index = 0;

  row.node.forEach((cell) => {
    if (cell.type.name !== "tableCell" && cell.type.name !== "tableHeader") {
      offset += cell.nodeSize;
      return;
    }

    cells.push({
      node: cell,
      pos: row.pos + 1 + offset,
      index,
    });

    index++;
    offset += cell.nodeSize;
  });

  return cells;
}
