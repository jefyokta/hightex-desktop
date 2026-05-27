import BreakToken from "@/types/pagedjs/chunker/breaktoken";
import Page from "@/types/pagedjs/chunker/page";

export default class FigureCaptionHandler {
  private ids: Record<string, HTMLElement> = {};
  afterPageLayout(_: HTMLElement, page: Page, _breakToken: BreakToken) {
    let styles = ``;
    page.element
      .querySelectorAll<HTMLElement>(
        ".content figcaption[data-type='imageFigure']",
      )
      .forEach((e) => {
        const ref = e.getAttribute("data-ref");
        const h1 = this.findLastH1Before(e);

        const id = e.getAttribute("id");
        if (id && this.ids[id]) {
          //  this.ids[id].remove();
        }
        if (id) {
          this.ids[id] = e;
        }
        e.setAttribute("data-counter-h1-counter-increment", "0");
        e.setAttribute(
          "data-counter-h1-counter-value",
          h1?.getAttribute("data-counter-h1-counter-value") || "",
        );
        styles += `[data-ref="${ref}"]:not([data-split-from]){counter-increment:fig-counter 1 h1-counter 0 !important}[data-ref="${ref}"]{counter-increment:fig-counter 1 h1-counter 0 !important}`;
      });
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  findLastH1Before(el: HTMLElement) {
    const all = [
      ...document.querySelectorAll(
        ".content h1[data-counter-h1-counter-value]",
      ),
    ];
    let last = null;
    for (const h1 of all) {
      if (h1.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
        last = h1;
      }
    }

    return last;
  }

  beforeParsed(fragment = document) {
    fragment
      .querySelectorAll("figcaption[data-type='imageFigure']")
      .forEach((_e) => {
        // const parent = e.parentElement;
      });
  }

  afterRendered() {
    document.querySelectorAll(".placeholder").forEach((e) => e.remove());
  }
}
