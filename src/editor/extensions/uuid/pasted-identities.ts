import { Fragment, Slice, type Node as ModelNode } from "@tiptap/pm/model";
import { needsNodeIdentity, NodeIdentityAllocator } from "./identity";

/** Resolve incoming collisions before insertion, preserving the existing target owner. */
export function pastedIdentities(
  slice: Slice,
  reserved: Pick<ReadonlySet<string>, "has">,
  generate?: () => string,
) {
  const candidates: string[] = [];
  slice.content.descendants((node) => {
    if (needsNodeIdentity(node.attrs) && typeof node.attrs.id === "string")
      candidates.push(node.attrs.id);
  });
  const allocator = new NodeIdentityAllocator(reserved, candidates, generate);
  const map = (
    fragment: Fragment,
    change: (node: ModelNode) => ModelNode,
  ): Fragment => {
    const nodes: ModelNode[] = [];
    fragment.forEach((node) => {
      const next = change(node);
      nodes.push(next.isLeaf ? next : next.copy(map(next.content, change)));
    });
    return Fragment.fromArray(nodes);
  };
  const identified = map(slice.content, (node) => {
    if (!needsNodeIdentity(node.attrs)) return node;
    const id = allocator.assign(node.type.name, node.attrs.id);
    return id === node.attrs.id
      ? node
      : node.type.create({ ...node.attrs, id }, node.content, node.marks);
  });
  const linked = map(identified, (node) => {
    if (node.type.name !== "refComponent") return node;
    const link = allocator.reference(node.attrs.link);
    return link && link !== node.attrs.link
      ? node.type.create({ ...node.attrs, link }, node.content, node.marks)
      : node;
  });
  return new Slice(linked, slice.openStart, slice.openEnd);
}
