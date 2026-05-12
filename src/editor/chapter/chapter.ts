import { JSONContent } from "@tiptap/core";

import { Storage } from "../storage";

import { ChapterExtensions } from "./chapter-extensions";
import { ChapterGraph } from "./chapter-graph";
import { ChapterQuery } from "./chapter-query";
import { Manager } from "../manager";
import { Document } from "../document";
import { useChapterStore } from "@/hooks/use-chapter";

export class Chapter {
  static instance?: Chapter;

  public title = "";

  private chapterId: string;

  readonly extensions = new ChapterExtensions(this);

  public graph = new ChapterGraph(this);

  readonly query = new ChapterQuery(this);

  readonly document: Document;

  constructor(chapterId: string, isolate?: boolean);
  constructor(option: ChapterOptions);
  constructor(chapter: string | number, documentId: string, version?: string);

  constructor(...args: any[]) {
    const { chapterId, document, isolated } = this.resolve(args);

    this.chapterId = chapterId;
    this.document = document;

    const shouldRegister = isolated !== true;

    if (shouldRegister) {
      Chapter.setInstance(this);
    }
  }
  private resolve(args: any[]): {
    chapterId: string;
    document: Document;
    isolated?: boolean;
  } {
    if (args.length === 1 && typeof args[0] === "object") {
      const { chapter, documentId, version, isolated } =
        args[0] as ChapterOptions;

      const chapterName = String(chapter);

      return {
        chapterId: version
          ? `${documentId}.${chapterName}.${version}`
          : `${documentId}.${chapterName}`,
        document: new Document(documentId, version),
        isolated,
      };
    }

    if (args.length === 1 && typeof args[0] === "string") {
      const chapterId = args[0];
      const [docId, , version] = chapterId.split(".");

      return {
        chapterId,
        document: new Document(docId, version),
      };
    }

    const [chapter, documentId, version] = args;

    const chapterName = String(chapter);

    return {
      chapterId: version
        ? `${documentId}.${chapterName}.${version}`
        : `${documentId}.${chapterName}`,
      document: new Document(documentId, version),
    };
  }
  getId() {
    return this.chapterId;
  }

  getDocumentId() {
    return this.chapterId.split(".")[0];
  }

  getChapter() {
    return this.chapterId.split(".")[1];
  }

  getVersion() {
    return this.chapterId.split(".")[2] || null;
  }

  async getContent() {
    return await this.query.getContent();
  }

  async setContent(content: JSONContent[]) {
    await Storage.instance.setChapter({
      id: this.chapterId,
      content,
    });
    this.graph.extract(content);
    Manager.app.dispatch("chapter:update", { chapterId: this.chapterId });
  }

  get siblings(): Chapter[] {
    return this.document.chapters.filter((c) => c.getId() == this.getId());
  }

  async warm() {
    this.title = (await this.query.getChapterTitle()) || "";
    // await this.document.warm();
    await this.graph.sync();

    return this
  }

  setTitle(title: string) {
    this.title = title;

    return this;
  }
  static setInstance(chapter: Chapter) {
    Chapter.instance = chapter;

    Manager.app.dispatch("chapter:created", {
      chapter: chapter,
    });
    useChapterStore.getState().setChapter(chapter);
  }
}
