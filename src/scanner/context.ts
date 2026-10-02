import type { JSONContent } from "@tiptap/core";

export type ChapterMeta = { id: string; title: string };

export type ScanContext = {
  chapters: ChapterMeta[];
  contents: Record<string, JSONContent[]>;
  images: ImageGraph[];
  tables: TableGraph[];
  equations: EquationGraph[];
};

export function walk(nodes: JSONContent[], visit: (node: JSONContent) => void) {
  for (const node of nodes) {
    visit(node);
    if (node.content) walk(node.content, visit);
  }
}
