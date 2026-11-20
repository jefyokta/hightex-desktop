import type { JSONContent } from "@tiptap/core";

const legacyTableNodes: Record<string, string> = {
  grid: "table",
  gridRow: "tableRow",
  gridCell: "tableCell",
};

/** Shared read-only normalization for the editor load path and captured sources. */
export function migrateGridContent(
  content: readonly JSONContent[],
  migrated?: (node: JSONContent) => void,
): JSONContent[] {
  const visit = (node: JSONContent): JSONContent => {
    const type = node.type && legacyTableNodes[node.type];
    let result = node;
    if (type) {
      result = {
        ...node,
        type,
        ...(type === "tableRow"
          ? {}
          : { attrs: { ...node.attrs, type: "grid" } }),
      };
      migrated?.(result);
    }
    return result.content?.length
      ? { ...result, content: result.content.map(visit) }
      : result;
  };
  return content.map(visit);
}
