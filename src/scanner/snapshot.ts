import type { Document } from "@/editor/document";
import type { ChapterMeta, ScanContext } from "./context";

export async function createSnapshot(doc: Document): Promise<ScanContext> {
  const chapters: ChapterMeta[] = doc.chapters.map((c, i) => ({
    id: String(c.getChapter()),
    title: c.title ?? `Chapter ${i + 1}`,
  }));

  const [contentList, images, tables, equations] = await Promise.all([
    Promise.all(
      doc.chapters.map(async (c) => {
        const content = await c.getContent();
        return Array.isArray(content) ? content : [content];
      }),
    ),
    doc.getImages(),
    doc.getTables(),
    doc.getEquations(),
  ]);

  const contents = Object.fromEntries(
    chapters.map((c, i) => [c.id, contentList[i]]),
  );

  return { chapters, contents, images, tables, equations };
}
