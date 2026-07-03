import { Document } from "@/editor/document";
import { Parser } from "tjsn-parser";

export abstract class StaticChapterBuilder {
  protected abstract selector: string;
  protected abstract chapterId: string;

  async build(doc: Document) {
    if (doc.category?.min) return;
    const chap = doc.chapters.find(
      (c) => c.getId() === c.getDocumentId().concat(`.${this.chapterId}`),
    );
    if (!chap) {
      return;
    }
    const content = await chap.getContent();

    const firstChild = content[0];

    const hasHeading =
      firstChild?.type === "heading" && firstChild.attrs?.level === 1;

    if (hasHeading) {
      content.shift();
    }

    const parent = document.querySelector(this.selector);
    if (!parent) {
      return;
    }
    const parser = new Parser();

    parser.render(content as any, parent as HTMLElement);
  }
}
