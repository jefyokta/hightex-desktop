import type { JSONContent } from "@tiptap/core";
import { isReferenceKind, type RefKind } from "../extensions/ref/label";
import { textOf } from "@/utils/text-of";

export type UsageKind = "citation" | RefKind;
export interface UsageLocation {
  documentId?: string;
  documentTitle?: string;
  chapterId: string;
  chapterTitle: string;
  path: number[];
  nodeId?: string;
  excerpt: string;
}
export interface ReferenceUsageEntry {
  kind: UsageKind;
  key: string;
  title: string;
  occurrences: UsageLocation[];
}
export interface UsageChapter {
  id: string;
  documentId?: string;
  documentTitle?: string;
  content: readonly JSONContent[];
}

/** Index authored rujukan, including grouped citations and nested table/list content. */
export function documentReferenceUsage(
  chapters: readonly UsageChapter[],
  references: Readonly<Record<string, string>> = {},
): ReferenceUsageEntry[] {
  const entries = new Map<string, ReferenceUsageEntry>();
  const entry = (kind: UsageKind, key: string) => {
    const identity = `${kind}:${key}`;
    let value = entries.get(identity);
    if (!value) {
      value = { kind, key, title: key, occurrences: [] };
      entries.set(identity, value);
    }
    return value;
  };
  Object.keys(references).forEach(key => entry("citation", key));

  for (const chapter of chapters) {
    const chapterTitle = textOf(chapter.content.find(node => node.type === "heading"))
      || chapter.id.split(".").slice(1).join(".") || chapter.id;
    const visit = (node: JSONContent, path: number[], context: string) => {
      const attrs = node.attrs ?? {};
      const excerpt = ["paragraph", "heading", "figcaption"].includes(node.type ?? "")
        ? textOf(node).slice(0, 200) : context;
      const location: UsageLocation = {
        documentId: chapter.documentId,
        documentTitle: chapter.documentTitle,
        chapterId: chapter.id, chapterTitle, path,
        nodeId: typeof attrs.id === "string" && attrs.id ? attrs.id : undefined,
        excerpt,
      };
      const targetKind = node.type === "imageFigure" ? "imageFigure"
        : node.type === "figureTable" ? "figureTable"
          : node.type === "blockMath" ? "equation"
            : node.type === "heading" ? "head" : undefined;
      if (targetKind && typeof attrs.id === "string" && attrs.id) {
        const target = entry(targetKind, attrs.id);
        if (target.title === target.key) {
          const label = textOf(node.type === "imageFigure" || node.type === "figureTable"
            ? node.content?.find(child => child.type === "figcaption") : node);
          target.title = label || (typeof attrs.latex === "string" ? attrs.latex : target.key);
        }
      }
      if (node.type === "cite" && !attrs.manual && typeof attrs.cite === "string") {
        for (const key of new Set(attrs.cite.split("|").filter(Boolean))) {
          entry("citation", key).occurrences.push(location);
        }
      }
      if ((node.type === "refComponent" || node.type === "ref") && typeof attrs.link === "string" && attrs.link && isReferenceKind(attrs.ref)) {
        entry(attrs.ref, attrs.link).occurrences.push(location);
      }
      node.content?.forEach((child, index) => visit(child, [...path, index], excerpt));
    };
    chapter.content.forEach((node, index) => visit(node, [index], ""));
  }
  return [...entries.values()];
}

export function citationUsageIndex(chapters: readonly UsageChapter[]): Map<string, UsageLocation[]> {
  return new Map(documentReferenceUsage(chapters)
    .filter(entry => entry.kind === "citation")
    .map(entry => [entry.key, entry.occurrences] as const));
}
