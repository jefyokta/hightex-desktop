import { defaulBib } from "@/data/default-bib";
import Dexie, { Table } from "dexie";
import { Manager } from "../manager";
import { CiteUtils } from "bibtex.js";

export class HighTexDB extends Dexie {
  documents!: Table<HighTexDocument, string>;
  chapters!: Table<HighTexChapter, string>;
  cite!: Table<CiteRecord, string>;
  chapterGraphs!: Table<ChapterGraph, string>;
  images!: Table<ImageRecord, string>;
  variables!: Table<Variable, string>;

  private static instance?: HighTexDB;

  private constructor() {
    super("HighTexDB");

    this.version(1).stores({
      documents: "id",
      chapters: "id",
      cite: "key, documentId",
      chapterGraphs: "id",
      images: "id, documentId",
      variables: "name, documentId",
    });
    this.cite.bulkPut(defaulBib);
    this.createGlobalVars()
  }
  async warm(){
    await this.cite.bulkPut(defaulBib);
    await this.createGlobalVars()

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
    await this.images.where("documentId").equals(documentId).delete();
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

  async getCites() {
    return (await this.cite.toArray()).map((c) => {
      return new CiteUtils(c.bib).setId(c.key);
    });
  }

  async getVars(documentId: string) {
    return await this.variables
      .where("documentId")
      .anyOf([documentId, "global"])
      .toArray();
  }

  async getVar(name: string, documentId = "global") {
    const scope = documentId == "global" ? ["global"] : [documentId, "global"];
    console.log(name);
    const v = await this.variables
      .where("documentId")
      .anyOf(scope)
      .and((v) => v.name === name)
      .first();
    return v?.value;
  }

  async getGlobalVars() {
    return await this.variables.where("documentId").equals("global").toArray();
  }
  private async createGlobalVars(){
    const api = window.profile ||  window.parent.profile
    const profile = await api.get()
    const entries = Object.entries(profile)
    for(const [key, val] of entries){
      await  this.setVar(key,String(val))
    }

  }
  async setVar(
    name: string,
    value: string,
    documentId = "global",
  ): Promise<void> {
    await this.variables.put({
      name,
      value,
      documentId,
    });
  }
}
