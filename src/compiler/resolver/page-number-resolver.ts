import { Counter } from "tjsn-parser";

export class PageNumberResolver {
  private counter = 1;

  resolve() {
    this.resolvePageContent();
    // this.resolvePageIntro()
    this.resolvePageAttachment();
  }

  resolvePageContent() {
    const pages = Array.from(
      document.querySelectorAll(".pagedjs_page:has(.content)"),
    );

    for (const page of pages) {
      const pageNumWrapper = page.querySelector(
        ".hasContent .pagedjs_margin-content",
      );
      if (!pageNumWrapper) {
        continue;
      }
      pageNumWrapper.textContent = (this.counter++).toString();
    }
  }
  // resolvePageIntro(){
  //    const pages=Array.from(document.querySelectorAll(".pagedjs_page:has(.introduction)"))

  //     for (const page of pages) {
  //         const pageNumWrapper =page.querySelector(".hasContent .pagedjs_margin-content")
  //         if (!pageNumWrapper) {
  //             continue;
  //         }

  //         pageNumWrapper.textContent = Counter.getAlpha(this.counterIntro++)

  //     }

  // }
  resolvePageAttachment() {
    const pages = Array.from(
      document.querySelectorAll<HTMLElement>(".pagedjs_page:has(.attachment)"),
    );

    let pageNum = 0;
    let chapterNum = 0;

    for (const page of pages) {
      if (page.querySelector("h1")) {
        chapterNum++;
        pageNum = 0;
      }

      pageNum++;

      const pageNumWrapper = page.querySelector(
        ".hasContent .pagedjs_margin-content",
      );
      if (!pageNumWrapper) {
        continue;
      }

      pageNumWrapper.textContent = `${Counter.getAlpha(chapterNum)} - ${pageNum}`;
    }
  }
}
