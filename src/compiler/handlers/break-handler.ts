import * as Paged from "pagedjs";

export class BreakHandler extends Paged.Handler {
  beforeParsed(content: HTMLElement) {
    content
      .querySelectorAll<HTMLElement>(
        "#bibliography, .new-page, [data-force-break]",
      )
      .forEach((el) => {
        el.setAttribute("data-break-before", "page");
        el.style.breakBefore = "page";
        el.style.pageBreakBefore = "always";
      });
  }
}
