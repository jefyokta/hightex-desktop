import type { JSONContent } from "@tiptap/core";
import {
  identityNodes,
  needsNodeIdentity,
  NodeIdentityAllocator,
} from "../extensions/uuid/identity";

/** First occurrence owns an ambiguous ID; never guess a different reference target. */
export function normalizeDocumentIdentities(
  chapters: readonly HighTexChapter[],
  generate?: () => string,
) {
  const existing = new Set<string>();
  for (const chapter of chapters)
    for (const node of identityNodes(chapter.content)) {
      const id = node.attrs?.id;
      if (typeof id === "string" && id) existing.add(id);
    }
  const allocator = new NodeIdentityAllocator(undefined, existing, generate);
  const normalize = (nodes: readonly JSONContent[]): JSONContent[] =>
    nodes.map((node) => {
      let attrs = node.attrs;
      if (needsNodeIdentity(attrs)) {
        const id = allocator.assign(node.type ?? "node", attrs?.id);
        if (id !== attrs?.id) {
          attrs = { ...attrs, id };
        }
      }
      return {
        ...node,
        attrs,
        ...(node.content ? { content: normalize(node.content) } : {}),
      };
    });
  const normalized = chapters.map((chapter) => ({
    ...chapter,
    content: normalize(chapter.content),
  }));
  const references = (nodes: JSONContent[]): JSONContent[] =>
    nodes.map((node) => {
      const link =
        node.type === "refComponent" && allocator.reference(node.attrs?.link);
      return {
        ...node,
        ...(link && link !== node.attrs?.link
          ? { attrs: { ...node.attrs, link } }
          : {}),
        ...(node.content ? { content: references(node.content) } : {}),
      };
    });
  return normalized.map((chapter) => ({
    ...chapter,
    content: references(chapter.content),
  }));
}
