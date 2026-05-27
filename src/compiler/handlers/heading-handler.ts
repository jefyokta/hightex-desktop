import Page from "@/types/pagedjs/chunker/page";

export default class HeadingHandler {
  ids: Record<string, any> = {};
  afterRendered(pages: Page[], _chunk: any) {
    for (const num in pages) {
      // console.log(page)
      pages[num].element
        .querySelectorAll<HTMLHeadingElement>("h2, h3")
        .forEach((h) => {
          const id = h.getAttribute("id");
          if (id) {
            if (this.ids[id]) {
              this.ids[id].remove();
            }
            this.ids[id] = h;
          }
        });
    }
  }
}
