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

  async getContent() {
    return (await HighTexDB.getInstance().chapters.get(this.chapter.getId()))
      ?.content;
  }

  async getChapterTitle() {
    const chapter = this.chapter.getChapter();

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
