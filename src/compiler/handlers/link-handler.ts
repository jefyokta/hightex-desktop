import BreakToken from "@/types/pagedjs/chunker/breaktoken";
import Page from "@/types/pagedjs/chunker/page";

declare global {
  interface Window {
    chapter?: string | number;
  }
}
export default class LinkHandler {
  links: Record<string, HTMLElement[]> = {};
  fig: Record<string, string> = {};
  afterPageLayout(_: HTMLElement, _page: Page, _breakToken: BreakToken) {
    // page.element.querySelectorAll<HTMLElement>(".imagefigure").forEach((e) => {
    //   const href = e.getAttribute("href");
    //   if (href) {
    //     if (this.fig[href]) {
    //       e.textContent = this.fig[href];
    //     } else {
    //       if (!this.links[href]) {
    //         this.links[href] = [];
    //       }
    //       this.links[href].push(e);
    //     }
    //   }
    // });
    // page.element
    //   .querySelectorAll("figcaption[data-type='imageFigure']")
    //   .forEach((e) => {
    //     const id = e.getAttribute("id");
    //     const key = `#${id}`;
    //     const h1 =
    //       window.chapter && typeof Number(window.chapter) == "number"
    //         ? window.chapter
    //         : e.getAttribute("data-counter-h1-counter-value");
    //     const fig = e.getAttribute("data-counter-fig-counter-value");
    //     const label = `Gambar ${h1}.${fig}`;
    //     this.fig[key] = label;
    //     if (this.links[key]) {
    //       for (const link of this.links[key]) {
    //         link.textContent = label;
    //       }
    //     }
    //   });
  }

  beforeParsed() {
    // console.log(document.body)
    // document.querySelectorAll(".imagefigure").forEach(e=>console.log("memek"))
  }
}
