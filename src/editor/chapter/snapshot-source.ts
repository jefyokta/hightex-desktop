import { migrateGridContent } from "../extensions/table/legacy-content";
import type { JSONContent } from "@tiptap/core";
import type { Schema, Node as ModelNode } from "@tiptap/pm/model";

/** Missing IDs belong to this immutable rendering; explicit source IDs stay intact. */
export function chapterSnapshotSource(
  schema: Schema,
  content: readonly JSONContent[],
  scope: string,
  presentation?: ModelNode,
) {
  const visit = (
    node: JSONContent,
    path: string,
    visible?: ModelNode,
  ): JSONContent => {
    const type = node.type && schema.nodes[node.type];
    if (!type) throw Error(`Unsupported document node: ${node.type}`);
    const attrs = { ...node.attrs };
    if (
      Object.prototype.hasOwnProperty.call(type.spec.attrs ?? {}, "id") &&
      !attrs.id
    )
      attrs.id =
        visible && visible.type.name === node.type && visible.attrs.id
          ? visible.attrs.id
          : `snapshot-${encodeURIComponent(scope)}-${path}`;
    return {
      ...node,
      attrs,
      content: node.content?.map((child, index) =>
        visit(
          child,
          `${path}-${index}`,
          visible?.maybeChild(index) ?? undefined,
        ),
      ),
    };
  };
  const source = schema.nodeFromJSON({
    type: "doc",
    content: migrateGridContent(content).map((node, index) =>
      visit(node, String(index), presentation?.maybeChild(index) ?? undefined),
    ),
  });
  source.check();
  return source;
}
