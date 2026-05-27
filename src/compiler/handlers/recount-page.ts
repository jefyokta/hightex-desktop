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
    if (typeof num !== "number" || num < 1 || num > 3999) {
      return num.toString();
    }

    const lookup = {
      M: 1000,
      CM: 900,
      D: 500,
      CD: 400,
      C: 100,
      XC: 90,
      L: 50,
      XL: 40,
      X: 10,
      IX: 9,
      V: 5,
      IV: 4,
      I: 1,
    };

    let roman = "";
    for (const i in lookup) {
      //@ts-ignore
      while (num >= lookup[i as any]) {
        roman += i;
        //@ts-ignore
        num -= lookup[i as any];
      }
    }

    return roman.toLowerCase();
  }
}
