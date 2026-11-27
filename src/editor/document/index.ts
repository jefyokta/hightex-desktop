import { useIPC } from "@/hooks/use-ipc";
import { Table } from "dexie";
import type { JSONContent } from "@tiptap/core";
import { HighTexDB } from "../storage/hightex-db";
import { Chapter } from "../chapter";
import { ChapterGraph } from "../chapter/chapter-graph";
import { DocumentNotFound } from "../../exception/document-not-found";
import { Manager } from "../manager";
import { CategoryEmpty } from "@/exception/categories-empty";
import { Symbols } from "@/utils/symbol";
import { DocumentIdentities } from "./identities";
import {
  getWorkspaceAuthorProfile,
  resolveAuthorProfile,
} from "@/utils/document-profile";

export class Document {
  static current?: Chapter;
  static instance?: Document;

  readonly id: string;
  public readonly table: Table<HighTexDocument, string, HighTexDocument>;
  private version?: string;
  public ready = false;
  public category?: Category;

  private doc?: HighTexDocument;

  public scheme?: Category["chapters"];
  public chapters: Chapter[] = [];
  readonly identities = new DocumentIdentities();

  public counters = {
    equations: 0,
  };

  public async setFilePath(file?: string) {
    if (!this.doc) return;
    this.doc.file = file;
    return await this.table.update(this.id, { file });
  }

  constructor(documentId: string, version?: string) {
    this.table = HighTexDB.getInstance().documents;
    this.id = documentId;
    this.version = version;
  }

  getVersion() {
    return this.version;
  }

  /** Read-only rendering context; never warm, activate or write the draft store. */
  static fromSnapshot(
    data: HighTexDocument,
    category: Category,
    version?: string,
  ) {
    const snapshot = new Document(data.id, version);
    snapshot.doc = structuredClone(data);
    snapshot.category = structuredClone(category);
    snapshot.scheme = snapshot.category.chapters;
    snapshot.chapters = snapshot.buildChaptersFromScheme();
    snapshot.ready = true;
    return snapshot;
  }

  orderedSnapshotChapters<Content extends JSONContent>(
    chapters: readonly { id: string; content: Content[] }[],
  ) {
    const content = new Map(
      chapters.map((chapter) => [chapter.id, chapter.content]),
    );
    return this.chapters.map((chapter) => ({
      id: chapter.getChapter(),
      content: content.get(chapter.getId().slice(this.id.length + 1)) ?? [],
    }));
  }

  async get(): Promise<HighTexDocument> {
    const doc = await this.table.get(this.id);

    if (!doc) throw new DocumentNotFound(this);

    return doc;
  }
  private async createVars() {
    const db = HighTexDB.getInstance();

    await db.setVar("title", this.doc?.title || "", this.id);
    await db.setVar("altTitle", this.doc?.altTitle || "", this.id);
    if (!this.scheme) return;
    for (const chapter of this.scheme) {
      await db.setVar(`chapter${chapter.chapter}`, chapter.title, this.id);
    }
    await Promise.all(
      Symbols.map(([name, value]) =>
        db.documentVariables.put({ name, value, documentId: "global" }),
      ),
    );
  }

  async warm({
    activate = true,
    workspaceIdentity = true,
    forEditing = false,
  }: {
    activate?: boolean;
    workspaceIdentity?: boolean;
    forEditing?: boolean;
  } = {}) {
    try {
      this.doc = await this.get();
      if (workspaceIdentity) {
        this.doc.profile = resolveAuthorProfile(
          this.doc,
          await getWorkspaceAuthorProfile(),
        );
        this.doc.authorProfileMode = "workspace";
      }
      this.scheme = await this.loadSchemeFromExternal();
      this.chapters = this.buildChaptersFromScheme();
      const chapterIds = this.chapters
        .filter((chapter) => !chapter.frozen)
        .map((chapter) => chapter.getId());
      // Only the editing entry point repairs storage, before a live editor exists.
      if (forEditing) await this.identities.prepare(this.id, chapterIds);
      else await this.identities.load(chapterIds);
      await this.createVars();
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

      if (activate) this.activate();

      return this;
    } catch (e) {
      console.error("WARM FAILED:", e);
      throw e;
    }
  }

  activate() {
    Document.instance = this;
    Manager.app.dispatch("document:warmed", { document: this });
  }

  async getGraphs(): Promise<ChapterGraphData[]> {
    await this.ensureWarmed();

    const result: ChapterGraphData[] = [];

    for (const c of this.chapters) {
      if (c.frozen) continue;
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

  async getEquations(): Promise<EquationGraph[]> {
    return ChapterGraph.numberEquations(await this.getGraphs());
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

  async refreshWorkspaceIdentity() {
    if (!this.doc) return;
    const document = this.doc;
    const profile = await getWorkspaceAuthorProfile();
    if (this.doc !== document) return;
    this.doc = {
      ...document,
      authorProfileMode: "workspace",
      profile: resolveAuthorProfile(document, profile),
    };
    Manager.app.dispatch("document:updated", { document: this.doc });
  }

  private async loadSchemeFromExternal() {
    this.category = await Document.resolveCategory(this.getDocument().category);
    return this.category.chapters;
  }

  /** Resolve the same category for editing and read-only stored-document export. */
  static async resolveCategory(categoryId: string) {
    const categories = await useIPC("hightex").hightex.categories();
    if (categories.length == 0) {
      throw new CategoryEmpty();
    }

    const category =
      categories.find((c) => c.id.toString() === categoryId) ??
      (await useIPC("hightex").hightex.category?.(categoryId));
    if (!category) {
      throw new CategoryEmpty(categoryId);
    }
    return category;
  }

  private buildChaptersFromScheme(): Chapter[] {
    if (!this.scheme) return [];

    const chapters: Chapter[] = this.getDefaultChapter();

    for (const c of this.scheme) {
      chapters.push(
        new Chapter({
          documentId: this.id,
          document: this,
          chapter: c.chapter,
          version: this.version,
          isolated: true,
        }).setTitle(c.title),
      );
    }

    chapters.push(
      new Chapter({
        documentId: this.id,
        document: this,
        chapter: "attachment",
        version: this.version,
        isolated: true,
      }).setTitle("Lampiran"),
    );
    chapters.push(
      new Chapter({
        documentId: this.id,
        document: this,
        chapter: "cv",
        version: this.version,
        isolated: true,
        frozen: true,
      }).setTitle("DAFTAR RIWAYAT HIDUP"),
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
    const isIntern = this.category?.variant === "intern";
    const def: Chapter[] = [];

    def.push(
      new Chapter({
        documentId: this.id,
        document: this,
        chapter: "foreword",
        version: this.version,
        isolated: true,
      }).setTitle("KATA PENGANTAR"),
    );
    if (!isIntern) {
      def.push(
        new Chapter({
          documentId: this.id,
          document: this,
          chapter: "presentation",
          version: this.version,
          isolated: true,
        }).setTitle("LEMBAR PERSEMBAHAN"),
      );
    }
    def.push(
      new Chapter({
        documentId: this.id,
        document: this,
        chapter: "abstract",
        version: this.version,
        isolated: true,
      }).setTitle("ABSTRAK"),
      new Chapter({
        documentId: this.id,
        document: this,
        chapter: "abstract-en",
        version: this.version,
        isolated: true,
      }).setTitle("ABSTRACT"),
    );
    def.push(
      new Chapter({
        documentId: this.id,
        document: this,
        chapter: "abbrevation",
        version: this.version,
        isolated: true,
        frozen: true,
      }).setTitle("DAFTAR SINGKATAN"),
    );
    return def;
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
