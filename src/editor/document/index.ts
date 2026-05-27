import { Table } from "dexie";
import { HighTexDB } from "../storage/hightex-db";
import { Chapter } from "../chapter";
import { DocumentNotFound } from "../../exception/document-not-found";
import { Manager } from "../manager";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { CategoryEmpty } from "@/exception/categories-empty";
import { DocumentBroken } from "@/exception/documet-broken";

export class Document {
  static current?: Chapter;
  static instance?: Document;

  readonly id: string;
  private table: Table<HighTexDocument, string, HighTexDocument>;
  private version?: string;
  public ready = false;

  private doc?: HighTexDocument;

  public scheme?: Category["chapters"];
  public chapters: Chapter[] = [];

  constructor(documentId: string, version?: string) {
    this.table = HighTexDB.getInstance().documents;
    this.id = documentId;
    this.version = version;
  }

  async get(): Promise<HighTexDocument> {
    const doc = await this.table.get(this.id);

    if (!doc) throw new DocumentNotFound(this);

    return doc;
  }

  async warm() {
    try {
      Document.instance = this;

      this.doc = await this.get();
      this.scheme = await this.loadSchemeFromExternal();

      this.chapters = this.buildChaptersFromScheme();

      await Promise.all(
        this.chapters.map(async (c) => {
          if (!(await c.query.isCreated())) {
            await c.query.create();
          }
          await c.warm();
          // await c.graph.sync();
        }),
      );
      this.ready = true;
      Manager.app.dispatch("document:warmed", { document: this });

      return this;
    } catch (e) {
      console.error("WARM FAILED:", e);
      throw e;
    }
  }

  async getGraphs(): Promise<ChapterGraphData[]> {
    await this.ensureWarmed();

    const result: ChapterGraphData[] = [];

    for (const c of this.chapters) {
      const data = c.graph.data;
      if (data) result.push(data);
    }

    return result;
  }

  async getHeadings(): Promise<HeadingGraph[]> {
    const graphs = await this.getGraphs();
    return graphs.flatMap((g) => g.headings);
  }

  async getImages(): Promise<ImageGraph[]> {
    const graphs = await this.getGraphs();
    return graphs.flatMap((g) => g.images);
  }

  async getTables(): Promise<TableGraph[]> {
    const graphs = await this.getGraphs();
    return graphs.flatMap((g) => g.tables);
  }

  private async ensureWarmed() {
    if (!this.doc) {
      throw new Error("Document not warmed. Call warm() first.");
    }
  }

  getDocument(): HighTexDocument {
    if (!this.doc) throw new Error("Document not warmed");
    return this.doc;
  }

  private async loadSchemeFromExternal() {
    const categories = await window.hightex.categories();

    const doc = this.getDocument();
    if (categories.length == 0) {
      throw new CategoryEmpty();
    }

    const category = categories.find((c) => c.id.toString() === doc.category);
    if (!category) {
      throw new DocumentBroken(this.id);
    }

    return category?.chapters;
  }

  private buildChaptersFromScheme(): Chapter[] {
    if (!this.scheme) return [];

    const chapters: Chapter[] = this.getDefaultChapter();

    for (const c of this.scheme) {
      chapters.push(
        new Chapter({
          documentId: this.id,
          chapter: c.chapter,
          version: this.version,
          isolated: true,
        }).setTitle(c.title),
      );
    }

    chapters.push(
      new Chapter({
        documentId: this.id,
        chapter: "attachment",
        version: this.version,
        isolated: true,
      }).setTitle("Lampiran"),
    );

    return chapters;
  }

  static getCurrentChapter() {
    if (!this.current) throw new Error("No active chapter");
    return this.current;
  }

  static setCurrentChapter(chapter: Chapter) {
    this.current = chapter;
    Chapter.setInstance(chapter);
  }

  private getDefaultChapter() {
    return [
      new Chapter({
        documentId: this.id,
        chapter: "foreword",
        isolated: true,
      }).setTitle("KATA PENGANTAR"),

      new Chapter({
        documentId: this.id,
        chapter: "presentation",
        isolated: true,
      }).setTitle("LEMBAR PERSEMBAHAN"),
      new Chapter({
        documentId: this.id,
        chapter: "abstract",
        isolated: true,
      }).setTitle("ABSTRAK"),
      new Chapter({
        documentId: this.id,
        chapter: "abstract-en",
        isolated: true,
      }).setTitle("ABSTRACT"),
    ];
  }

  destroy() {
    Document.current = undefined;
    Document.instance = undefined;
    this.ready = false;
  }
  async save() {
    if (!this.doc) throw new Error("Document not loaded");

    await this.table.put(this.doc);
  }
}
