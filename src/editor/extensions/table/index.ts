import {
  Table,
  TableRow,
  TableCell,
  TableHeader,
  TableView,
} from "@tiptap/extension-table";

import { CommandProps } from "@tiptap/react";
import { CellSelection } from "@tiptap/pm/tables";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tableCell: {
      setCellAlignmentLeft: () => ReturnType;
      setCellAlignmentRight: () => ReturnType;
      setCellAlignmentCenter: () => ReturnType;
    };
  }
}

const getJustifyContent = (align: "center" | "left") => {
  return align === "center" ? "center" : "flex-start";
};
const TableCommands = {
  setCellAlignment:
    (alignment: "left" | "center" | "right") =>
    ({ commands, state }: CommandProps) => {
      const { selection } = state;

      if (selection instanceof CellSelection) {
        return commands.command(({ tr }) => {
          selection.forEachCell((node, pos) => {
            tr.setNodeMarkup(pos, node.type, {
              ...node.attrs,
              align: alignment,
            });
          });
          return true;
        });
      }

      const node = selection.$from.node(selection.$from.depth - 1);

      if (!node) return false;

      if (["tableHeader", "tableCell"].includes(node.type.name)) {
        return commands.updateAttributes(node.type.name, { align: alignment });
      }

      return false;
    },
};

const CustomTableCell = TableCell.extend({
  // draggable:false,
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "left",
        parseHTML: (element) => element.style.textAlign || "left",
        renderHTML: (attributes) => ({
          style: `text-align: ${getJustifyContent(attributes.align)};`,
          class: attributes.align,
        }),
      },
    };
  },
  addCommands() {
    return {
      setCellAlignmentLeft: () => TableCommands.setCellAlignment("left"),
      setCellAlignmentRight: () => TableCommands.setCellAlignment("right"),
      setCellAlignmentCenter: () => TableCommands.setCellAlignment("center"),
    };
  },
});

const CustomTableHeader = TableHeader.extend({
  draggable: false,
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "left",
        parseHTML: (element) => element.style.textAlign || "left",
        renderHTML: (attributes) => ({
          style: `text-align: ${getJustifyContent(attributes.align)};`,
          class: `${attributes.align} dark:border-white!`,
        }),
      },
    };
  },
  addCommands(): Partial<any> {
    return {
      setCellAlignmentLeft: () => TableCommands.setCellAlignment("left"),
      setCellAlignmentRight: () => TableCommands.setCellAlignment("right"),
      setCellAlignmentCenter: () => TableCommands.setCellAlignment("center"),
    };
  },
});

const CustomTable = Table.extend({
  addCommands(): Partial<any> {
    return {
      ...this.parent?.(),
    };
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const view = new TableView(node, this.options.cellMinWidth);
      if (typeof getPos === "function") {
        const pos = getPos();

        if (pos) {
          const $pos = editor.state.doc.resolve(pos);
          const parent = $pos.node($pos.depth);
          if (parent.type.name !== "figureTable") {
            view.dom.classList.add("node-grid");
            view.table.setAttribute("data-type", "grid");
            return view;
          }
        }
      }
      view.table.setAttribute("data-type", "table");
      view.dom.classList.add("node-table");

      return view;
    };
  },
}).configure({
  resizable: true,
});
const CustomTableRow = TableRow.extend({});

export {
  CustomTableCell as TableCell,
  CustomTableHeader as TableHeader,
  CustomTable as Table,
  CustomTableRow,
};
