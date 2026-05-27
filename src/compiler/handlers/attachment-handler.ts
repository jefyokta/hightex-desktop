import BreakToken from "@/types/pagedjs/chunker/breaktoken";
import Page from "@/types/pagedjs/chunker/page";
import { Counter } from "tjsn-parser";

export default class AttachmentHandler {
  private attachIndex = 0;
  private pageIndex = 0;

  afterPageLayout(pageEl: HTMLElement, _page: Page, _breakToken: BreakToken) {
    if (!pageEl.querySelector(".attachment")) return;

    pageEl.classList.add("is-attachment-page");

    const isFirstPageOfAttachment = !!pageEl.querySelector(".attachment > h1");

    if (isFirstPageOfAttachment) {
      this.attachIndex++;
      this.pageIndex = 2;
    } else {
      this.pageIndex++;
    }

    pageEl.dataset.att = String(this.attachIndex);
    pageEl.dataset.attPage = String(this.pageIndex);
  }

  afterRendered() {
    document.querySelectorAll<HTMLElement>(".hasContent").forEach((pn) => {
      const page = pn.closest<HTMLElement>(".is-attachment-page");
      if (!page) return;

      const head = Number(page.dataset.att);
      const pageNum = Number(page.dataset.attPage);

      if (!head || !pageNum) return;

      const alpha = Counter.getAlpha(head);

      const textNode = pn.firstChild;
      if (!textNode) return;

      if (page.querySelector(".attachment > h1")) {
        textNode.textContent = "";
      } else {
        textNode.textContent = `${alpha} - ${pageNum}`;
      }
    });

    this.fixToc();
  }

  fixToc() {
    document.querySelectorAll<HTMLUListElement>(".listed ul").forEach((ul) => {
      const isAttachmentList = Array.from(
        ul.querySelectorAll("[data-toc-counter]"),
      ).some((el) =>
        /^[A-Z]\./.test(el.getAttribute("data-toc-counter") || ""),
      );

      if (!isAttachmentList) return;

      ul.querySelectorAll("li").forEach((li) => {
        const link = li.querySelector<HTMLAnchorElement>(".link-number");
        if (!link) return;

        const href = link.getAttribute("href");
        if (!href) return;

        const target = document.querySelector<HTMLElement>(href);
        if (!target) return;

        const page = target.closest<HTMLElement>(".is-attachment-page");
        if (!page) return;

        const head = Number(page.dataset.att);
        const pageNum = Number(page.dataset.attPage);
        if (!head || !pageNum) return;

        const alpha = Counter.getAlpha(head);
        link.textContent = `${alpha} - ${pageNum}`;
      });
    });
  }
}
