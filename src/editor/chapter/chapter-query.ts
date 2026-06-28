import { JSONContent } from "@tiptap/core";
import { HighTexDB } from "../storage/hightex-db";
import { Chapter } from "./chapter";

export class ChapterQuery {
  constructor(private chapter: Chapter) {}

  private staticChapterMap: Record<string, string> = {
    "abstract-en": "abstract",
    abstract: "abstrak",
    foreword: "kata pengantar",
    presentation: "lembar persembahan",
  };
  async isCreated() {
    return await HighTexDB.getInstance().chapters.get(this.chapter.getId());
  }

  async create() {
    return await HighTexDB.getInstance().chapters.put({
      id: this.chapter.getId(),
      content: [],
    });
  }

  isStaticChapter() {
    return this.chapter.getChapter() in this.staticChapterMap;
  }
  isAttachmentChapter() {
    return this.chapter.getChapter() == "attachment";
  }

  async getDocument() {
    return await HighTexDB.getInstance().documents.get(
      this.chapter.getDocumentId(),
    );
  }
  isNormalChapter() {
    return !this.isStaticChapter() && !this.isAttachmentChapter();
  }

  async getContent(): Promise<JSONContent[]> {
    const exists = await HighTexDB.getInstance().chapters.get(
      this.chapter.getId(),
    );
    if (!exists) {
      return [this.chapter.createHeading()];
    }
    if (!(exists.content || []).length) {
      return [this.chapter.createHeading()];
    }
    return exists.content;
  }

  async getChapterTitle() {
    const chapter = this.chapter.getChapter();
    if (this.isAttachmentChapter()) {
      return "Lampiran".toUpperCase();
    }

    if (this.isStaticChapter()) {
      return this.staticChapterMap[chapter];
    }

    const doc = await this.getDocument();

    if (!doc) return;

    const categories = await window.hightex.categories();

    const category = categories.find((c) => {
      return c.id == Number(doc.category);
    });

    if (!category) return;

    const chapterNumber = Number(chapter);

    if (Number.isNaN(chapterNumber)) {
      return;
    }

    return category.chapters?.find((c) => {
      return Number(c.chapter) === chapterNumber;
    })?.title;
  }

  async getSiblingChapters() {
    const db = HighTexDB.getInstance();

    const documentId = this.chapter.getDocumentId();

    const version = this.chapter.getVersion();

    const chapters = await db.chapters
      .where("id")
      .startsWith(`${documentId}.`)
      .toArray();

    return chapters.filter((c) => {
      const [doc, , ver] = c.id.split(".");

      if (doc !== documentId) {
        return false;
      }

      if (version && ver !== version) {
        return false;
      }

      return true;
    });
  }
  url() {
    return `/document/${this.chapter.getId().replace(".", "/")}`;
  }
}
