import type { Editor } from "@tiptap/core";
import { needsNodeIdentity, NodeIdentityAllocator } from "./identity";

/** Change node attributes through the current transaction, preserving authored content. */
export function ensureUniqueId(
  editor: Editor,
  reserved?: Pick<ReadonlySet<string>, "has">,
) {
  const existing: string[] = [];
  editor.state.doc.descendants((node) => {
    if (typeof node.attrs.id === "string") existing.push(node.attrs.id);
  });
  const allocator = new NodeIdentityAllocator(reserved, existing);
  const transaction = editor.state.tr;
  const ids = new Set<string>();
  editor.state.doc.descendants((node, pos) => {
    if (!needsNodeIdentity(node.attrs)) return;
    const id = allocator.assign(node.type.name, node.attrs.id);
    ids.add(id);
    if (id !== node.attrs.id)
      transaction.setNodeMarkup(pos, undefined, { ...node.attrs, id });
  });
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "refComponent") return;
    const link = allocator.reference(node.attrs.link);
    if (link && link !== node.attrs.link)
      transaction.setNodeMarkup(pos, undefined, { ...node.attrs, link });
  });
  if (transaction.docChanged)
    editor.view.dispatch(transaction.setMeta("addToHistory", false));
  return ids;
}
