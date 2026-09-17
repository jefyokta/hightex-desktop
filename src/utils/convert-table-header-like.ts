import { tableBorderPluginKey } from "@/editor/plugins/table-border";
import type { Editor } from "@tiptap/core";
// import type { DecorationSet } from "@tiptap/pm/view";

export const convertTableHeaderLikeCells = (editor: Editor): void => {
  const { state, view } = editor;
  const decorations = tableBorderPluginKey.getState(state);

  if (!decorations) {
    return;
  }

  const tr = state.tr;
  const tableHeader = state.schema.nodes.tableHeader;

  decorations.find().forEach((decoration) => {
    console.log(decoration)
    if ((decoration as any).type.attrs.tableHeaderLike !== '1') {
      return;
    }

    const node = state.doc.nodeAt(decoration.from);

    if (!node || node.type.name !== "tableCell") {
      return;
    }

    tr.setNodeMarkup(
      decoration.from,
      tableHeader,
      node.attrs,
    );
  });

  if (tr.docChanged) {
    view.dispatch(tr);
  }
};