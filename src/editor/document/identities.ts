import { HighTexDB } from "../storage/hightex-db";
import { identityNodes } from "../extensions/uuid/identity";
import { normalizeDocumentIdentities } from "./normalize-identities";

/** Document-local reservations; database maintenance runs only before editing starts. */
export class DocumentIdentities {
  private readonly chapters = new Map<string, Set<string>>();
  private readonly counts = new Map<string, number>();

  constructor(private readonly db = HighTexDB.getInstance()) {}

  remember(chapterId: string, ids: Iterable<string>) {
    const previous = this.chapters.get(chapterId) ?? new Set<string>();
    const next = new Set(ids);
    for (const id of previous)
      if (!next.has(id)) {
        const count = this.counts.get(id)! - 1;
        if (count) this.counts.set(id, count);
        else this.counts.delete(id);
      }
    for (const id of next)
      if (!previous.has(id))
        this.counts.set(id, (this.counts.get(id) ?? 0) + 1);
    this.chapters.set(chapterId, next);
  }

  reserved(chapterId: string) {
    return {
      has: (id: string) =>
        (this.counts.get(id) ?? 0) >
        (this.chapters.get(chapterId)?.has(id) ? 1 : 0),
    };
  }

  async load(chapterIds: string[]) {
    this.adopt(
      (await this.db.chapters.bulkGet(chapterIds)).filter(
        (chapter) => chapter !== undefined,
      ),
    );
  }

  async prepare(documentId: string, chapterIds: string[]) {
    const result = await this.db.transaction(
      "rw",
      this.db.documents,
      this.db.chapters,
      async () => {
        const stored = (await this.db.chapters.bulkGet(chapterIds)).filter(
          (chapter) => chapter !== undefined,
        );
        const chapters = normalizeDocumentIdentities(stored);
        const changed = chapters.filter(
          (chapter, index) =>
            JSON.stringify(chapter.content) !==
            JSON.stringify(stored[index].content),
        );
        if (changed.length) {
          await this.db.chapters.bulkPut(changed);
          await this.db.documents.update(documentId, { updatedAt: new Date() });
        }
        return { chapters, repaired: changed.length };
      },
    );
    this.adopt(result.chapters);
    return result.repaired;
  }

  private adopt(chapters: HighTexChapter[]) {
    this.chapters.clear();
    this.counts.clear();
    for (const chapter of chapters)
      this.remember(
        chapter.id,
        Array.from(
          identityNodes(chapter.content),
          (node) => node.attrs?.id,
        ).filter((id): id is string => typeof id === "string" && Boolean(id)),
      );
  }
}
