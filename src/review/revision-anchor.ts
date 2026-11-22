import type { JSONContent } from "@tiptap/core";
import type { RevisionAnchor } from "../../shared/guidance-contract";
import type { SnapshotReadModel } from "./snapshot-reader";
import { textOf } from "@/utils/text-of";

export interface RevisionLocation {
  label: string;
  anchor: RevisionAnchor;
}

export function revisionLocations(snapshot: SnapshotReadModel): RevisionLocation[] {
  const locations: RevisionLocation[] = [];
  for (const chapter of snapshot.chapters) {
    const visit = (node: JSONContent, path: number[]) => {
      const text = textOf(node);
      if (["paragraph", "heading", "figcaption", "blockMath", "imageFigure", "figureTable"].includes(node.type ?? "")) {
        const quote = (text || String(node.attrs?.latex ?? "") || node.type || "").slice(0, 1000);
        if (quote) locations.push({
          label: `${chapter.id} · ${quote.slice(0, 110)}`,
          anchor: {
            snapshotSha256: snapshot.sha256, chapterId: chapter.id, path,
            ...(typeof node.attrs?.id === "string" && node.attrs.id ? { nodeId: node.attrs.id } : {}),
            quote,
          },
        });
      }
      node.content?.forEach((child, index) => visit(child, [...path, index]));
    };
    chapter.content.forEach((node, index) => visit(node, [index]));
  }
  return locations;
}

/** A source link belongs to its original immutable snapshot, not to the current editor. */
export function resolveRevisionAnchor(snapshot: SnapshotReadModel, anchor: RevisionAnchor): JSONContent | undefined {
  if (snapshot.sha256 !== anchor.snapshotSha256) return;
  let content = snapshot.chapters.find(chapter => chapter.id === anchor.chapterId)?.content;
  let node: JSONContent | undefined;
  for (const index of anchor.path) {
    node = content?.[index];
    content = node?.content;
  }
  if (!node || (anchor.nodeId && node.attrs?.id !== anchor.nodeId)) return;
  const quote = (textOf(node) || String(node.attrs?.latex ?? "") || node.type || "").slice(0, 1000);
  return quote === anchor.quote ? node : undefined;
}
