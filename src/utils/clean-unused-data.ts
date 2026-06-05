import { HighTexDB } from "@/editor/storage/hightex-db";

export type CleanProgressStart = {
  type: "start";
  totals: { chapters: number; images: number };
};

export type CleanProgressChapter = {
  type: "chapter";
  index: number;
  total: number;
  id: string;
};

export type CleanProgressImage = {
  type: "image";
  index: number;
  total: number;
  id: string;
};

export type CleanProgressDone = {
  type: "done";
  deletedChapters: number;
  chapters: string[];
  deletedImages: number;
  images: string[];
};

export type CleanProgressEvent =
  | CleanProgressStart
  | CleanProgressChapter
  | CleanProgressImage
  | CleanProgressDone;

export async function* cleanUnusedProgress(): AsyncGenerator<
  CleanProgressEvent,
  void,
  unknown
> {
  const db = HighTexDB.getInstance();

  const docs = new Set((await HighTexDB.getDocuments()).map((d) => d.id));

  const unusedChapters: string[] = [];
  const usedImages: Set<string> = new Set();
  const chapters = await db.chapters.toArray();

  const traverse = (nodes?: any[]) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (!node) continue;
      if (node.type === "image") {
        const src = node.attrs?.src as string | undefined;
        if (src) usedImages.add(src);
      }
      if (Array.isArray(node.content) && node.content.length)
        traverse(node.content as any[]);
    }
  };

  for (const chapter of chapters) {
    const docId = chapter.id.split(".")[0];

    if (docs.has(docId)) {
      traverse(chapter.content as any[]);
      continue;
    }

    unusedChapters.push(chapter.id);
  }

  const allImages = await db.images.toArray();
  const unusedImages = allImages
    .filter((img) => !usedImages.has(img.id) || !docs.has(img.documentId))
    .map((i) => i.id);

  yield {
    type: "start",
    totals: { chapters: unusedChapters.length, images: unusedImages.length },
  };

  for (let i = 0; i < unusedChapters.length; i++) {
    const id = unusedChapters[i];
    await db.chapters.delete(id);
    await db.chapterGraphs.delete(id);
    yield { type: "chapter", index: i + 1, total: unusedChapters.length, id };
  }

  for (let i = 0; i < unusedImages.length; i++) {
    const id = unusedImages[i];
    await db.images.delete(id);
    yield { type: "image", index: i + 1, total: unusedImages.length, id };
  }

  yield {
    type: "done",
    deletedChapters: unusedChapters.length,
    chapters: unusedChapters,
    deletedImages: unusedImages.length,
    images: unusedImages,
  };
}

export const cleanUnused = async () => {
  let last: CleanProgressDone | null = null;
  for await (const ev of cleanUnusedProgress()) {
    if (ev.type === "done") last = ev;
  }
  return (
    last ?? {
      type: "done",
      deletedChapters: 0,
      chapters: [],
      deletedImages: 0,
      images: [],
    }
  );
};
