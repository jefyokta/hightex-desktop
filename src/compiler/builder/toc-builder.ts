import { Engine } from "../engine";

export class TocBuilder {
  private static createWrapper(id: string) {
    const section = document.createElement("section");
    section.classList.add("introduction", "toc", "breakable", "new-page");

    const heading = document.createElement("h1");
    heading.textContent = "DAFTAR ISI";
    heading.classList.add("chapter");
    heading.id = id;
    section.append(heading);
    return section;
  }

  private static createItem(heading: Element) {
    const tag = heading.tagName.toLowerCase();

    const row = document.createElement("a");
    row.classList.add("toc-row");
    if (tag === "h2") row.classList.add("sub");
    if (tag === "h3") row.classList.add("subsub");

    if (!heading.id) {
      heading.id = `heading-${Math.random().toString(36).slice(2, 8)}`;
    }
    row.href = `#${heading.id}`;
    row.dataset.headingId = heading.id;

    const num = document.createElement("div");
    num.classList.add("toc-number");

    const inner = document.createElement("div");
    inner.classList.add("toc-inner");

    const text = document.createElement("span");
    text.classList.add("toc-text");
    text.textContent = heading.textContent ?? "";

    const dots = document.createElement("span");
    dots.classList.add("toc-dots");

    const page = document.createElement("span");
    page.classList.add("toc-page");
    // console.log(h1s)

    inner.append(text, dots);
    row.append(num, inner, page);
    const div = document.createElement("div");
    div.append(row);
    return div;
  }

  static create(engine: Engine) {
    const headings = Array.from(
      engine.root.querySelectorAll(".content h1, .content h2, .content h3"),
    );

    const wrapper = this.createWrapper("toc");
    const heads = Array.from(
      document.querySelectorAll(".introduction h1"),
    ).filter((h) => {
      return h.id && h.id !== "tof" && h.id != "tot";
    });
    const selfHeading = wrapper.querySelector("#toc")!;
    heads.push(
      selfHeading,
      document.getElementById("tot")!,
      document.getElementById("tof")!,
    );
    heads.push(
      ...headings,
      document.getElementById("biblio")!,
      document.querySelector("#attachment")!,
    );

    for (const heading of heads) {
      const item = TocBuilder.createItem(heading);
      wrapper.appendChild(item);
    }

    return wrapper;
  }

  static assignPageNumbers() {
    const rows = document.querySelectorAll<HTMLAnchorElement>("a.toc-row");

    rows.forEach((row) => {
      const headingId = row.dataset.headingId;
      if (!headingId) return;

      const originalHeading = document.querySelector<HTMLElement>(
        `#${CSS.escape(headingId)}`,
      );

      const numEl = row.querySelector<HTMLElement>(".toc-number");
      if (numEl && originalHeading) {
        const num = originalHeading.getAttribute("data-numbering");
        if (!num) {
          numEl.remove();
        } else {
          numEl.textContent = num;
        }
      }

      const pageEl = row.querySelector<HTMLElement>(".toc-page");
      if (!pageEl) return;

      const pagedHeading = document.querySelector<HTMLElement>(
        `.pagedjs_pages #${CSS.escape(headingId)}`,
      );
      if (pagedHeading) {
        const pagedPage = pagedHeading.closest<HTMLElement>(".pagedjs_page");

        pageEl.textContent =
          pagedPage?.querySelector(".hasContent")?.textContent ?? "";
      }
    });

    document.fonts.ready.then(() => {
      requestAnimationFrame(() => TocBuilder.fillLeaders());
    });
  }

  private static fillLeaders() {
    document
      .querySelectorAll<HTMLElement>(".toc-row.sub , .toc-row.subsub")
      .forEach((row) => {
        const text = row.querySelector<HTMLElement>(".toc-text");
        const dots = row.querySelector<HTMLElement>(".toc-dots");
        const page = row.querySelector<HTMLElement>(".toc-page");
        if (!text || !dots || !page) return;

        dots.textContent = "";

        const textRects = text.getClientRects();
        if (!textRects.length) return;

        const lastLine = textRects[textRects.length - 1];
        const pageRect = page.getBoundingClientRect();
        const available = pageRect.left - lastLine.right - 6;

        if (available <= 4) return;

        dots.textContent = ".";
        const dotW = dots.getBoundingClientRect().width;
        dots.textContent = "";

        if (dotW > 0) {
          const n = Math.floor(available / dotW);
          if (n > 0) dots.textContent = ".".repeat(n);
        }
      });
  }
}
