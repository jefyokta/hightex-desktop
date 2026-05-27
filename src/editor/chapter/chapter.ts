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
        document: Document.instance ?? new Document(documentId, version),
        isolated,
      };
    }

    if (args.length === 1 && typeof args[0] === "string") {
      const chapterId = args[0];
      const [docId, , version] = chapterId.split(".");

      return {
        chapterId,
        document: Document.instance ?? new Document(docId, version),
      };
    }

    const [chapter, documentId, version] = args;

    const chapterName = String(chapter);

    return {
      chapterId: version
        ? `${documentId}.${chapterName}.${version}`
        : `${documentId}.${chapterName}`,
      document: Document.instance ?? new Document(documentId, version),
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
  get siblings() {
    return this.document.chapters.filter((c) => c.getId() !== this.getId());
  }

  getVersion() {
    return this.chapterId.split(".")[2] || null;
  }

  async getContent() {
    return await this.query.getContent();
  }
  private filterContent(content: JSONContent[]): JSONContent[] {
    let result = [...content];

    const firstNode = result[0];
    const isFirstNodeH1 =
      firstNode?.type === "heading" && firstNode?.attrs?.level === 1;

    if (!isFirstNodeH1) {
      result.unshift({
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: this.title }],
      });
    }

    return result.map((node, index) => {
      if (index > 0 && node.type === "heading" && node.attrs?.level === 1) {
        return {
          ...node,
          attrs: { ...node.attrs, level: 2 },
        };
      }
      return node;
    });
  }

  async setContent(content: JSONContent[] | JSONContent) {
    const c = Array.isArray(content) ? content : content?.content || [];
    const cleanContent = this.query.isAttachmentChapter()
      ? c
      : this.filterContent(c);

    await Storage.instance.setChapter({
      id: this.chapterId,
      content: cleanContent,
    });

    this.graph.extract(cleanContent);

    Manager.app.dispatch("chapter:update", {
      chapterId: this.chapterId,
      chapter: this,
    });
  }

  async warm() {
    this.title = (await this.query.getChapterTitle()) || "";

    await this.graph.sync();

    return this;
  }
  getNumber() {
    const num = Number(this.getChapter());
    if (Number.isNaN(num)) {
      return;
    }
    return num - 1;
  }
  getHtmlClass() {
    if (this.query.isAttachmentChapter()) {
      return "attachment-chapter";
    }
    if (this.query.isStaticChapter()) {
      if (this.getChapter() == "abstract-en") {
        return "static-chapter abstract";
      }
      return "static-chapter";
    }
    return "ch";
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

  createHeading() {
    return {
      type: "heading",
      attrs: {
        level: 1,
      },
      content: [
        {
          type: "text",
          text: this.title,
        },
      ],
    };
  }
}
