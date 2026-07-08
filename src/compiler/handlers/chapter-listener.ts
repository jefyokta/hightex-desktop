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

  detail:Record<number,{start:number,end:number}>= {}
  static instance: ChapterListener;
  constructor() {
    window._chapters = false;
    ChapterListener.instance = this;
  }
  afterPageLayout(pageEl: HTMLElement, page: Page, _breakToken: BreakToken) {
    const content = pageEl.querySelector(".content");
    if (!content || !content.querySelector("h1")) return;
    this.chapterNum++;
    this.detail[this.chapterNum] = {
      start:page.position+1,
      end:page.position+1
    };
    if(this.chapterNum > 1){
      this.detail[this.chapterNum -1].end = page.position
    }

    this.increase(this.chapterNum,page.position + 1)

  }

  increase(chapter:number,page:number){
    this.stack.push({chapter,page})

  }
  afterRendered(){
    this.detail[this.chapterNum].end = Array.from(document.querySelectorAll(".pagedjs_page")).length
  }
}
