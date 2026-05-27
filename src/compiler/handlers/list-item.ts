import BreakToken from "@/types/pagedjs/chunker/breaktoken";
import Page from "@/types/pagedjs/chunker/page";

export default class ListItem {
  afterPageLayout(pageElement: HTMLElement, page: Page, _?: BreakToken) {
    const li = this.selectMayCropped(pageElement);

    if (li) {
      const originalParentPageNumber = Number(page.id.split("-")[1]);
      const orParentPageEl = document.getElementById(
        "page-" + (originalParentPageNumber - 1),
      )!;

      const originalLi = orParentPageEl.querySelector(
        `li[data-ref="${li.getAttribute("data-split-from")}"]`,
      );
      // console.log(originalLi)
      if (originalLi?.textContent?.trim() == "") {
        originalLi.remove();
        li.removeAttribute("data-split-from");
      }
    }
  }

  selectMayCropped(element: HTMLElement) {
    return (
      element.querySelector("li[data-split-from]") ||
      element.querySelector("h2[data-split-from") ||
      element.querySelector("h3[data-split-from")
    );
  }
}
