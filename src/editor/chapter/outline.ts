import type { JSONContent } from "@tiptap/core";
import type { Chapter } from ".";
import { Counter } from "tjsn-parser";

export type ChapterOutlineNode = HeadingGraph & { children: ChapterOutlineNode[] };

export function chapterOutline(headings: readonly HeadingGraph[]): ChapterOutlineNode[] {
  const roots: ChapterOutlineNode[] = [];
  const stack: ChapterOutlineNode[] = [];
  for (const heading of headings) {
    const node: ChapterOutlineNode = { ...heading, children: [] };
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

export const chapterLabel = (chapter: Chapter) =>
  chapter.query.isNormalChapter()
    ? `${chapter.getChapter()}. ${chapter.title}`
    : chapter.title;

export const headingNumber = (heading: HeadingGraph) =>
  heading.chapterId.split(".")[1] === "attachment" && heading.level === 1
    ? `LAMPIRAN ${Counter.getAlpha(Number(heading.numbering))}`
    : heading.numbering;

/** Search authored heading text without loading citation records during typing. */
export const outlineText = (nodes: readonly JSONContent[]): string =>
  nodes.map(node => node.text ?? (node.content ? outlineText(node.content) : "")).join("");
