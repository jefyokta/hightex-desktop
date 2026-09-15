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

interface HeaderCell {
  rowIndex: number;
  rowPos: number;
  cellPos: number;
  cellNode: PMNode;
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

  if (!rows.length) {
    return;
  }

  const headers: HeaderCell[] = [];


  for (const row of rows) {
    let cellOffset = 0;

    row.node.forEach((cell) => {
      if (cell.type.name === "tableHeader") {
      

        headers.push({
          rowIndex: row.index,
          rowPos: row.pos,
          cellPos: row.pos + 1 + cellOffset,
          cellNode: cell,
        });
      }

      cellOffset += cell.nodeSize;
    });
  }

  if (!headers.length) {
    return;
  }


  const lastHeaderRow = Math.max(
    ...headers.map((header) => {
      const rowspan = Math.max(
        1,
        Number(header.cellNode.attrs.rowspan ?? 1),
      );

      return header.rowIndex + rowspan - 1;
    }),
  );

  const targetRow = rows[lastHeaderRow];

  if (!targetRow) {
    return;
  }

  git commit -m "fix:decrase margin between nested lists and fix rowspanned table header border-bottom"
  decorations.push(
    Decoration.node(
      targetRow.pos,
      targetRow.pos + targetRow.node.nodeSize,
      {
        class: "table-last-header",
      },
    ),
  );
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