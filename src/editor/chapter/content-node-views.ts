import type { Schema } from "@tiptap/pm/model";
import type { NodeViewConstructor } from "@tiptap/pm/view";
import { chapterTableView } from "../extensions/table/view";
import { chapterContentDOM } from "./content-dom";

/** Schema-owned content DOM, independent of mounted editor wrappers or host services. */
export function chapterContentNodeViews(
  schema: Schema,
  ownerDocument: Document,
) {
  const nodeViews: Record<string, NodeViewConstructor> = {};
  for (const [name, type] of Object.entries(schema.nodes)) {
    if (!type.spec.toDOM) continue;
    nodeViews[name] = (node, view, getPos) => {
      if (node.type.spec.tableRole === "table") {
        const position = getPos();
        const parent =
          position === undefined
            ? undefined
            : view.state.doc.resolve(position).parent;
        const table = chapterTableView(node, parent?.type.name);
        return {
          dom: table.dom,
          contentDOM: table.contentDOM,
          update: (node) => table.update(node),
          ignoreMutation: (mutation) => mutation.type === "attributes",
        };
      }
      const { dom, contentDOM } = chapterContentDOM(node, ownerDocument);
      return {
        dom,
        contentDOM,
        ignoreMutation: (mutation) =>
          node.isAtom || mutation.type === "attributes",
      };
    };
  }
  return nodeViews;
}
