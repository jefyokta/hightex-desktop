import BreakToken from "@/types/pagedjs/chunker/breaktoken";
import Layout from "@/types/pagedjs/chunker/layout";
import Page from "@/types/pagedjs/chunker/page";

type NeededHeightProps = Record<
  string,
  { height: number; fragment: HTMLElement }
>;
export default class RepeatTableHeaderAndCaption {
  test = "";
  neededHeight: NeededHeightProps = {};
  currentPage = -1;
  heightcache: Record<string, number> = {};

  getActualCaption(fragmentRoot: HTMLElement, figure: HTMLElement | null) {
    if (!figure) return null;

    const direct = figure.querySelector(":scope > figcaption");
    if (direct) return direct;

    const ref = figure.getAttribute("data-ref");
    if (!ref) return null;

    const originalFigure = fragmentRoot.querySelector(
      `figure[data-ref="${ref}"][data-split-original="true"]`,
    ) as HTMLElement | null;

    if (!originalFigure) return null;

    return originalFigure.querySelector(":scope > figcaption");
  }

  afterPageLayout(fragment: HTMLElement, page: Page, breakToken: BreakToken) {
    if (breakToken && breakToken.node && this.getBreakRow(breakToken.node)) {
      const figure = page.element.querySelector(
        `figure[data-type="figureTable"]:last-of-type`,
      );
      // const breaktr =this.getBreakRow(breakToken.node)
      // console.log(breaktr?.closest("figure"))

      let nh = 0;
      const ref = figure?.getAttribute("data-ref");
      const he = this.heightcache[ref || ""];

      if (he) {
        nh = he;
      } else {
        const caption = figure?.children[0];
        const thead = figure?.querySelector("thead");

        const thh = (thead && thead.getBoundingClientRect()?.height) || 0;
        nh = (caption?.getBoundingClientRect()?.height || 0) + 21 + thh;

        this.heightcache[ref || ""] = nh;
      }

      this.neededHeight["page" + (page.position + 1).toString()] = {
        height: nh,
        fragment,
      };
    }
    page.element
      .querySelectorAll<HTMLElement>("figure[data-type='figureTable']")
      .forEach((fig) => {
        if (fig.dataset.splitFrom) {
          let continueing = true;

          const originalFigure = this.getOriginalFigure(
            fig.dataset.splitFrom,
          ) as HTMLElement;

          const originalTable = this.table(originalFigure);

          const table = this.table(fig);

          const originalHead = this.header(originalTable);
          const header = this.header(table);

          const caption = this.caption(fig);
          const originalCaption = originalFigure?.querySelector("figcaption");

          if (originalCaption) {
            if (caption) {
              continueing = false;
              originalCaption.remove();
            } else {
              const cloneCap = originalCaption.cloneNode(true) as HTMLElement;
              cloneCap.classList.add("continueing");
              cloneCap.setAttribute(
                "data-counter-caption-counter-increment",
                "0",
              );
              cloneCap.setAttribute("data-ref", "");
              cloneCap.style.setProperty(
                "counter-increament",
                "caption-counter",
                "0",
              );
              fig.insertBefore(cloneCap, fig.firstChild);
            }
          }
          if (originalHead) {
            if (header && this.assertHeader(originalHead, header)) {
              originalHead.remove();
            } else {
              table &&
                table.insertBefore(
                  originalHead.cloneNode(true),
                  this.body(table) as HTMLElement,
                );
            }
          }

          const originalColGroup = this.colgroup(originalTable);

          if (originalColGroup) {
            const colgroup = originalColGroup.cloneNode(true);
            table &&
              table.insertBefore(colgroup, table.firstChild as HTMLElement);
          }

          if (!continueing) {
            this.moveId(originalFigure, fig);
          }
        }
      });
  }
  getOriginalFigure(tableSource: string) {
    return document.querySelector(
      `[data-ref="${tableSource}"][data-split-original="true"]`,
    );
  }
  body(table: HTMLTableElement | null) {
    return table?.querySelector("tbody");
  }
  assertHeader(
    header1: HTMLHeadingElement | null,
    header2: HTMLHeadingElement | null,
  ) {
    return header1?.children?.length == header2?.children?.length;
  }

  caption(figure: HTMLElement | null) {
    return figure?.querySelector("figcaption");
  }
  table(figure: HTMLElement | null) {
    return figure?.querySelector("table") || null;
  }
  header(table: HTMLTableElement | null) {
    return table?.querySelector("thead");
  }
  colgroup(table: HTMLTableElement | null) {
    return table?.querySelector("colgroup");
  }

  moveId(elFrom: HTMLElement | null, elTo: HTMLElement | null) {
    const id = elFrom?.getAttribute("id");
    elTo?.setAttribute("id", id || "");
    elFrom?.setAttribute("id", `${id}-moved`);
  }

  getBreakRow(node: Node | null): HTMLTableRowElement | null {
    let current: Node | null = node;

    while (current) {
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        (current as HTMLElement).tagName === "TR"
      ) {
        return current as HTMLTableRowElement;
      }
      current = current.parentNode;
    }

    return null;
  }

  onPageLayout(_w: HTMLElement, _token: BreakToken, layout: Layout) {
    // console.log(token,layout)
    const h = this.neededHeight["page" + this.currentPage.toString()];
    // console.log(this.neededHeight, 'page' + this.currentPage.toString())
    // console.log(h)
    if (h) {
      layout.bounds.height = layout.bounds.height - h.height;
    }
    // console.log(token)
  }

  handleFigureTableBeforePageLayout(page: Page) {
    this.currentPage++;
    // console.log(this.neededHeight)
    const h = this.neededHeight["page" + this.currentPage.toString()];

    if (h) {
      // console.log(page.id,h.height)
      const div = document.createElement("div");
      div.classList.add("debug-el");
      div.style.height = h.height + "px";
      div.style.width = "100%";
      page.element.append(div);
    }
  }
}
