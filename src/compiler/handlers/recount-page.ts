import { toLowerRoman } from "@/utils/page-number";

export default class RecountPage {
  getIntroductionTotalPage() {
    return (
      document.querySelectorAll(".introduction").length +
      document.querySelectorAll(".listed").length -
      1
    );
  }
  afterRendered() {
    document.querySelectorAll<HTMLDivElement>(".hasContent").forEach((a) => {
      if (a.closest(".pagedjs_margin-top")) {
        return;
      }
      const el = a.firstChild;
      const num = this.getPageNumber(a);
      el && el?.appendChild(document.createTextNode(num));
    });

    document.querySelectorAll(".page-num").forEach((e) => {
      const href = e.getAttribute("href");
      const dontFix = e.getAttribute("data-dont-fix");
      if (href && !dontFix) {
        const target = document.querySelector(href);
        if (target) {
          const pageNum = this.getPageNumber(target as HTMLElement);

          e.nextSibling &&
            e.nextSibling.appendChild(document.createTextNode(pageNum));
        }
      }
    });
    // this.tocFixed()
  }
  tocFixed() {
    document.querySelectorAll(".listed").forEach((e) => {
      const pageEl = e.closest("[data-page-number]");
      const pageNum = this.toLowerRoman(
        Number(pageEl?.getAttribute("data-page-number")) || 0,
      );
      const pageFooter = pageEl?.querySelector(
        "pagedjs_margin_bottom_content",
      )?.firstChild;
      if (pageFooter) pageFooter.textContent = pageNum;
    });
  }
  getPageNumber(target: HTMLElement) {
    let pageWrapper = target;
    while (true) {
      if (!pageWrapper.parentElement) {
        break;
      }
      pageWrapper = pageWrapper.parentElement;
      if (pageWrapper.hasAttribute("data-page-number")) {
        break;
      }
    }

    if (pageWrapper.querySelector(".cover")) {
      return "";
    }
    let forContent =
      pageWrapper.querySelector(".introduction") ||
      pageWrapper.querySelector(".listed")
        ? false
        : true;
    const pageNum = forContent
      ? (
          Number(pageWrapper.getAttribute("data-page-number")) -
          this.getIntroductionTotalPage()
        ).toString()
      : this.toLowerRoman(Number(pageWrapper.getAttribute("data-page-number")));
    return pageNum;
  }

  isPageContent(el: HTMLElement) {
    let tmp = el;
    let isContent = false;

    while (true) {
      if (tmp.classList.contains("content")) {
        isContent = true;
        break;
      }
      if (!tmp.parentElement) {
        break;
      }
      if (tmp.classList.contains("introduction")) {
        isContent = false;
        break;
      }
      tmp = tmp.parentElement;
    }

    return isContent;
  }

  toLowerRoman(num: number) {
    return toLowerRoman(num);
  }
}
