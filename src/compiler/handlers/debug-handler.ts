import BreakToken from "@/types/pagedjs/chunker/breaktoken";
import Page from "@/types/pagedjs/chunker/page";

export default class DebugHandler {
  afterPageLayout(el: HTMLElement, _page: Page, _breakToken: BreakToken) {
    console.log(el.querySelector(".pagedjs_page_content"));
  }
}
