import { HighTexDB } from "./hightex-db";

export class Storage {
  private db = HighTexDB.getInstance();
  public static instance = new Storage();

  async setChapter(chapter: HighTexChapter) {
    return await this.db.transaction(
      "rw",
      this.db.documents,
      this.db.chapters,
      async () => {
        await this.db.chapters.put(chapter);
        const documentId = chapter.id.split(".")[0];
        await this.db.documents.update(documentId, { updatedAt: new Date() });
      },
    );
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
}
