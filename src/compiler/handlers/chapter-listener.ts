import BreakToken from "@/types/pagedjs/chunker/breaktoken";
import Page from "@/types/pagedjs/chunker/page";

declare global {
  interface Window {
    _chapters: false | any[];
  }
}
export default class ChapterListener {
  private chapterNum = 0;
  stack: { chapter: number; page: number }[] = [];
  static instance: ChapterListener;
  constructor() {
    window._chapters = false;
    ChapterListener.instance = this;
  }
  afterPageLayout(pageEl: HTMLElement, page: Page, _breakToken: BreakToken) {
    const content = pageEl.querySelector(".content");
    if (!content) return;
    if (!content.querySelector("h1") || content.querySelector("#biblio"))
      return;
    this.chapterNum++;
    const obj = {
      chapter: this.chapterNum,
      page: page.position + 1,
    };
    this.stack.push(obj);
  }
  afterRendered() {}
}
