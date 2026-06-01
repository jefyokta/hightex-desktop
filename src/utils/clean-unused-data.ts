import { HighTexDB } from "@/editor/storage/hightex-db";

export const cleanUnused = async () => {
  const db = HighTexDB.getInstance();

  const docs = new Set((await HighTexDB.getDocuments()).map((d) => d.id));

  const unused: string[] = [];

  const chapters = await db.chapters.toArray();

  for (const chapter of chapters) {
    const docId = chapter.id.split(".")[0];

    if (docs.has(docId)) continue;

    unused.push(chapter.id);
  }

  if (!unused.length) {
    return {
      deleted: 0,
      chapters: [],
    };
  }

  await Promise.all([
    db.chapters.bulkDelete(unused),
    db.chapterGraphs.bulkDelete(unused),
  ]);

  return {
    deleted: unused.length,
    chapters: unused,
  };
};
