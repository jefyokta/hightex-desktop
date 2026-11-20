import { getSchema } from "@tiptap/core";
import type { DocumentRenderModel } from "@/types/document-snapshot";
import type { Document } from "./index";
import { ChapterExtensions } from "../chapter/chapter-extensions";
import { chapterSnapshotSource } from "../chapter/snapshot-source";

/** Use the same native source IDs for context labels and unopened chapter views. */
export function documentSnapshotModel(
  document: Document,
  model: DocumentRenderModel,
): DocumentRenderModel {
  const ordered = document.orderedSnapshotChapters(model.chapters);
  return {
    ...model,
    chapters: ordered.map(({ id, content }, index) => {
      const chapter = document.chapters[index];
      if (chapter.frozen) return { id, content };
      const source = chapterSnapshotSource(
        getSchema(ChapterExtensions.contentSchema(id)),
        chapter.sourceContent(content),
        id,
      );
      return { id, content: source.toJSON().content ?? [] };
    }),
  };
}
