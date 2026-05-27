import BreakToken from "@/types/pagedjs/chunker/breaktoken";
import Layout from "@/types/pagedjs/chunker/layout";
import Page from "@/types/pagedjs/chunker/page";
export default class PreventImageOverflow {
  private overFlowImages: Record<
    string,
    { el: HTMLElement | Element; parentRef?: string }
  > = {};
  private currentPage: number = 0;
  // private actualLayoutHeight = 857.9453125;
  afterPageLayout(pageElement: HTMLElement, _page: Page, __?: BreakToken) {
    const contentWrapper = pageElement.querySelector(".content");
    if (contentWrapper) {
      if (this.overFlowImages[this.currentPage.toString()]) {
        const el = this.overFlowImages[this.currentPage.toString()];
        let parent = null;
        parent = contentWrapper.querySelector(`[data-ref="${el.parentRef}"]`);
        if (!parent) {
          parent = contentWrapper;
        }

        parent.insertBefore(el.el!, parent.firstChild);
      }
      const figureOrFalse = this.figureInLastOfPage(contentWrapper);

      if (figureOrFalse) {
        const img = figureOrFalse.querySelector("img");
        const pageY = pageElement
          .querySelector(".pagedjs_page_content")
          ?.getBoundingClientRect().bottom;
        if (img && pageY) {
          const isOverflow =
            figureOrFalse.getBoundingClientRect().bottom - pageY > 0;
          if (isOverflow) {
            this.overFlowImages[(this.currentPage + 1).toString()] = {
              el: figureOrFalse,
              parentRef: figureOrFalse.getAttribute("data-ref") || undefined,
            };
          }
        }
      }
    }
  }
  onPageLayout(_w: HTMLElement, _: BreakToken, layout: Layout) {
    this.currentPage++;
    const overflowImage = this.overFlowImages[this.currentPage.toString()]?.el;
    // console.log(overflowImage)

    if (overflowImage) {
      layout.bounds.height =
        layout.bounds.height -
        (overflowImage.getBoundingClientRect().height + 1000);
    }
  }
  // private decreased(height:number){
  //     height !== this.actualLayoutHeight
  // }

  isMayOverflow(figure: Element) {
    return !figure.querySelector("figcaption[data-type='imageFigure']");
  }

  figureInLastOfPage(contentElement: HTMLElement | Element): Element | false {
    const lastElementChild = contentElement.lastElementChild || false;
    if (!lastElementChild) return false;
    if (
      lastElementChild.nodeName == "FIGURE" &&
      (lastElementChild.getAttribute("data-type") || "") == "imageFigure"
    ) {
      return lastElementChild;
    }

    return this.figureInLastOfPage(lastElementChild);
  }
}
