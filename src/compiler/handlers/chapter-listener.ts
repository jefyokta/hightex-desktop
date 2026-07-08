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
  private attachmentHasCounted = false;
  constructor() {
    window._chapters = false;
    ChapterListener.instance = this;
  }
  afterPageLayout(pageEl: HTMLElement, page: Page, _breakToken: BreakToken) {
    const content = pageEl.querySelector(".content");
    const attach = pageEl.querySelector(".attachment")
    if (!content && !attach) return;
    if(attach && attach.querySelector('h1') && !this.attachmentHasCounted){
      this.chapterNum ++;
      this.increase(this.chapterNum,page.position +1);
      this.attachmentHasCounted =true
      return;
    }
    if (!content?.querySelector("h1") || content.querySelector("#biblio")) return;
    this.chapterNum++;

    this.increase(this.chapterNum,page.position + 1)

  }

  increase(chapter:number,page:number){
    this.stack.push({chapter,page})

  }
  afterRendered(){}
}
