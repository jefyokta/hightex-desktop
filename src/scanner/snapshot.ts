import type { Document } from "@/editor/document";
import type { JSONContent } from "@tiptap/core";
import {
  createScanContext,
  type DocumentNode,
  type ScanContext,
} from "@hightex/scanner";

const INLINE_ATOMS = new Set([
  "refComponent",
  "cite",
  "variable",
  "mathInline",
  "dots",
]);

function scannerNodes(nodes: JSONContent[]): DocumentNode[] {
  return nodes.map((node) => {
    if (!node.type) throw new Error("Scanner content requires a node type");
    const { content, ...rest } = node;
    // The scanner masks non-text content, but empty atoms otherwise disappear.
    // Keep their identity and reference attributes; add text only to this snapshot.
    const scanContent = INLINE_ATOMS.has(node.type)
      ? [{ type: "text", text: `<node:${node.type}>` }]
      : content;
    return {
      ...rest,
      type: node.type,
      ...(scanContent ? { content: scannerNodes(scanContent) } : {}),
    };
  });
}

/** Adapt live editor content; the library derives graphs without cached DB state. */
export async function createSnapshot(doc: Document): Promise<ScanContext> {
  const chapters = await Promise.all(
    doc.chapters
      .filter((chapter) => !chapter.frozen)
      .map(async (chapter) => {
        const content = await chapter.getContent();
        return {
          id: chapter.getId(),
          title: chapter.title,
          numbering: String(chapter.getChapter()),
          attachment: chapter.query.isAttachmentChapter(),
          content: scannerNodes(content),
        };
      }),
  );
  return createScanContext({ chapters });
}
