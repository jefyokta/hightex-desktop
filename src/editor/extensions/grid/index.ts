import { Table, TableView } from "@tiptap/extension-table";
import { TableCell,CustomTableRow as TableRow } from "../table";

export const Grid = Table.extend({
  name: "grid",
  content:"gridRow+",

  addAttributes() {
    return {
      ...this.parent?.(), 
      "data-type": {
        default: "grid",
        parseHTML: el => el.getAttribute("data-type"),
        renderHTML: () => ({ "data-type": "grid" }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "table[data-type='grid']" }]
  },
  addProseMirrorPlugins() {
  return  []
  },



  addNodeView() {
    return ({ node}) => {
      const view = new TableView(node, this.options.cellMinWidth)
      view.table.setAttribute("data-type", "grid")
      view.dom.classList.add("node-grid")
      return view
    }
  },


}).configure({resizable:true});
export const GridRow = TableRow.extend({
  name: "gridRow",
  content:"gridCell+"
});

export const GridCell = TableCell.extend({
  name: "gridCell",
});