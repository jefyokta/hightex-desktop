import { defaulBib } from "@/data/default-bib";
import Dexie, { Table } from "dexie";
import { Manager } from "../manager";

export class HighTexDB extends Dexie {
  documents!: Table<HighTexDocument, string>;
  chapters!: Table<HighTexChapter, string>;
  cite!: Table<CiteRecord, string>;
  chapterGraphs!: Table<ChapterGraph, string>;

  private static instance?: HighTexDB;

  constructor() {
    super("HighTexDB");

    this.version(1).stores({
      documents: "id",
      chapters: "id",
      cite: "key, documentId",
      chapterGraphs: "id",
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
}
