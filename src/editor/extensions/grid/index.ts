import { TableView } from "@tiptap/extension-table";
import { TableCell, CustomTableRow as TableRow , Table} from "../table";
import { createColumnResizing } from "@/editor/plugins/column-resizing";

export const Grid = Table.extend({
  name: "grid",
  content: "gridRow+",
  // tableRole:"grid",

  addAttributes() {
    return {
      ...this.parent?.(),
      "data-type": {
        default: "grid",
        parseHTML: (el) => el.getAttribute("data-type"),
        renderHTML: () => ({ "data-type": "grid" }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "table[data-type='grid']" }];
  },
  addProseMirrorPlugins() {
    return [
      createColumnResizing({
        tableTypeName: "grid",
        cellTypeNames: ["gridCell"],
      }),
      //   createColumnResizing({
      //   tableTypeName: "table",
      //   cellTypeNames: ["tableCell", "tableHeader"],
      // }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const view = new TableView(node, this.options.cellMinWidth);
      view.table.setAttribute("data-type", "grid");
      view.dom.classList.add("node-grid");
      return view;
    };
  },
}).configure({ resizable: false });
export const GridRow = TableRow.extend({
  name: "gridRow",
  content: "gridCell+",
    // tableRole:undefined,

});
export const GridCell = TableCell.extend({
  name: "gridCell",
    // tableRole:undefined,

});
