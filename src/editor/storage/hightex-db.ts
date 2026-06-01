import { defaulBib } from "@/data/default-bib";
import Dexie, { Table } from "dexie";
import { Manager } from "../manager";

export class HighTexDB extends Dexie {
  documents!: Table<HighTexDocument, string>;
  chapters!: Table<HighTexChapter, string>;
  cite!: Table<CiteRecord, string>;
  chapterGraphs!: Table<ChapterGraph, string>;
  images!: Table<ImageRecord, string>;

  private static instance?: HighTexDB;

  private constructor() {
    super("HighTexDB");

    this.version(1).stores({
      documents: "id",
      chapters: "id",
      cite: "key, documentId",
      chapterGraphs: "id",
      images: "id, documentId",
    });
    this.cite.bulkPut(defaulBib);
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new HighTexDB();
    }
    return this.instance;
  }

  static async getDocuments() {
    return await this.getInstance().documents.toArray();
  }

  async updateDocument(document: HighTexDocument) {
    await this.documents.put(document);
    const fresh = await this.documents.get(document.id);

    Manager.app.dispatch("document:updated", { document: fresh! });
  }
  async deleteDocument(documentId: string) {
    await this.documents.delete(documentId);

    const chapters = await this.chapters
      .where("id")
      .startsWith(documentId)
      .toArray();

    const chapterIds = chapters.map((c) => c.id);
    await this.images.where("documentId").equals(documentId).delete()
    await Promise.all([
      this.chapters.bulkDelete(chapterIds),
      this.deleteChapterGraphs(chapterIds),
    ]);
  }
  async saveImage(blob: Blob, documentId: string): Promise<string> {
    const id = crypto.randomUUID();
    const record: ImageRecord = { id, blob, documentId, createdAt: Date.now() };
    await this.images.add(record);
    return id;
  }
  async getBlobUrl(id: string): Promise<string | null> {
    const record = await this.images.get(id);
    if (record === undefined) return null;
    return URL.createObjectURL(record.blob);
  }

  async getBlob(id: string): Promise<Blob | null> {
    const record = await this.images.get(id);
    return record?.blob ?? null;
  }

  async deleteImageById(id: string): Promise<void> {
    await this.images.delete(id);
  }
  private async deleteChapterGraphs(chapterIds: string[]) {
    const graphs = await this.chapterGraphs.bulkGet(chapterIds);

    const validGraphs = graphs.filter((g) => g !== undefined);

    await Promise.all(validGraphs.map((g) => this.chapterGraphs.delete(g.id)));
  }
}
