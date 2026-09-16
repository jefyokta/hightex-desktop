import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  Decoration,
  DecorationSet,
} from "@tiptap/pm/view";

const tableBorderPluginKey =
  new PluginKey<DecorationSet>("table-header-border");

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
        return (
          tableBorderPluginKey.getState(state) ??
          DecorationSet.empty
        );
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

  for (const row of rows) {
    const cells = getCells(row);

    for (const cell of cells) {
      if (cell.node.type.name !== "tableHeader") {
        continue;
      }

      const rowspan = Math.max(
        1,
        Number(cell.node.attrs.rowspan ?? 1),
      );

      if (rowspan <= 1) {
        continue;
      }


      const targetRowIndex =
        row.index + rowspan - 1;

      const targetRow =
        rows[targetRowIndex];

      if (!targetRow) {
        continue;
      }

      decorateRow(
        targetRow,
        decorations,
      );
    }
  }
}

function decorateRow(
  row: TableRow,
  decorations: Decoration[],
) {
  const cells = getCells(row);

  for (const cell of cells) {
    decorations.push(
      Decoration.node(
        cell.pos,
        cell.pos + cell.node.nodeSize,
        {
          class: "table-header-like",
        },
      ),
    );
  }
}

function getRows(
  table: PMNode,
  tablePos: number,
): TableRow[] {
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

function getCells(
  row: TableRow,
): TableCell[] {
  const cells: TableCell[] = [];

  let offset = 0;
  let index = 0;

  row.node.forEach((cell) => {
    if (
      cell.type.name !== "tableCell" &&
      cell.type.name !== "tableHeader"
    ) {
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