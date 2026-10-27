import { CiteUtils } from "bibtex.js";
import { HighTexDB } from "./hightex-db";

export class Storage {
  private db = HighTexDB.getInstance();
  private static _instance: Storage | null = null;
  private chapterWrites = new Map<string, Promise<unknown>>();

  public static get instance() {
    if (!Storage._instance) {
      Storage._instance = new Storage();
    }

    return Storage._instance;
  }

  async setChapter(chapter: HighTexChapter) {
    const persist = () =>
      this.db.transaction(
        "rw",
        this.db.documents,
        this.db.chapters,
        async () => {
          await this.db.chapters.put(chapter);
          const documentId = chapter.id.split(".")[0];
          await this.db.documents.update(documentId, { updatedAt: new Date() });
        },
      );
    const previous = this.chapterWrites.get(chapter.id);
    // A failed write must be reported to its caller, while allowing the next save.
    const write = previous ? previous.then(persist, persist) : persist();
    this.chapterWrites.set(chapter.id, write);
    try {
      return await write;
    } finally {
      if (this.chapterWrites.get(chapter.id) === write) {
        this.chapterWrites.delete(chapter.id);
      }
    }
  }

  async waitForChapter(chapterId: string): Promise<void> {
    await this.chapterWrites.get(chapterId);
  }

  async getChapter(id: string) {
    return this.db.chapters.get(id);
  }

  async setDocument(document: HighTexDocument) {
    const existing = await this.db.documents.get(document.id);

    return this.db.documents.put({
      ...existing,
      ...document,
    });
  }

  async getDocument(id: string) {
    return this.db.documents.get(id);
  }

  async getCite(key: string) {
    return this.db.cite.get(key);
  }

  async setCite(cite: CiteRecord) {
    return this.db.cite.put(cite);
  }
  async getCites() {
    return (await this.db.cite.toArray()).map((c) =>
      new CiteUtils(c.bib).setId(c.key),
    );
  }
}
