import type { Node as ModelNode } from "@tiptap/pm/model";

type NodeLayout =
  | { kind: "atomic" | "image-figure" }
  | { kind: "table"; content?: string };

/** Extensions own wrapper behavior; ordinary nodes use text/container flow. */
export function paginationNode(node: ModelNode, position: number) {
  const rule = node.type.spec.editorPagination as NodeLayout | undefined;
  if (rule?.kind === "table" || node.type.spec.tableRole === "table") {
    const content = rule?.kind === "table" ? rule.content : undefined;
    if (!content) return { kind: "table" as const, node, position };
    let target: { node: ModelNode; position: number } | undefined;
    node.forEach((child, offset) => {
      if (child.type.name === content)
        target = { node: child, position: position + 1 + offset };
    });
    if (!target) throw Error("Missing pagination table content");
    return { kind: "table" as const, ...target };
  }
  if (rule?.kind === "image-figure")
    return { kind: "image-figure" as const, node, position };
  if (rule?.kind === "atomic" || node.isAtom)
    return { kind: "atomic" as const, node, position };
}
