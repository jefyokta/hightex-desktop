export class TOFBuilder {
  create() {
    const figures = this.createFigures();
    const tables = this.createTables();
    return { figures, tables };
  }

  private createFigures() {
    const captions = Array.from(
      document.querySelectorAll("figcaption[data-type='imageFigure']"),
    );
    const wrapper = this.createWrapper("tof", "DAFTAR GAMBAR");

    for (const caption of captions) {
      const row = this.createRow(caption);
      wrapper.appendChild(row);
    }

    return wrapper;
  }

  private createTables() {
    const captions = Array.from(
      document.querySelectorAll("figcaption[data-type='figureTable']"),
    );
    const wrapper = this.createWrapper("tot", "DAFTAR TABEL");

    for (const caption of captions) {
      const row = this.createRow(caption);
      wrapper.appendChild(row);
    }

    return wrapper;
  }

  createWrapper(id: string, text: string) {
    const section = document.createElement("section");
    section.classList.add("introduction", "new-page");
    const h1 = document.createElement("h1");
    section.classList.add(id);
    h1.id = id;
    h1.textContent = text;
    h1.classList.add("chapter");
    section.append(h1);
    return section;
  }

  createRow(caption: Element) {
    const a = document.createElement("a");
    a.classList.add("toc-row", "sub");

    if (!caption.id) {
      caption.id = `caption-${Math.random().toString(36).slice(2, 8)}`;
    }
    a.href = `#${caption.id}`;
    a.dataset.captionId = caption.id;

    const num = document.createElement("div");
    num.classList.add("toc-number");
    num.textContent = caption.getAttribute("data-numbering") ?? "";

    const inner = document.createElement("div");
    inner.classList.add("toc-inner");

    const text = document.createElement("span");
    text.classList.add("toc-text");
    text.textContent = (caption.textContent ?? "").trim();

    const dots = document.createElement("span");
    dots.classList.add("toc-dots");

    const page = document.createElement("span");
    page.classList.add("toc-page");

    inner.append(text, dots);
    a.append(num, inner, page);

    return a;
  }

  static assignPageNumbers() {
    const rows = document.querySelectorAll<HTMLAnchorElement>(
      ".tof a.toc-row, .tot a.toc-row",
    );

    rows.forEach((row) => {
      const captionId = row.dataset.captionId;
      if (!captionId) return;

      const originalCaption = document.querySelector<HTMLElement>(
        `#${CSS.escape(captionId)} figcaption`,
      );
      const numEl = row.querySelector<HTMLElement>(".toc-number");
      if (numEl && originalCaption) {
        numEl.textContent =
          originalCaption.getAttribute("data-numbering") ?? "";
      }

      const pageEl = row.querySelector<HTMLElement>(".toc-page");
      if (!pageEl) return;

      const pagedCaption = document.querySelector<HTMLElement>(
        `.pagedjs_pages #${CSS.escape(captionId)}`,
      );

      if (pagedCaption) {
        const pagedPage = pagedCaption.closest<HTMLElement>(".pagedjs_page");
        pageEl.textContent = (
          pagedPage?.querySelector(".hasContent")?.textContent ?? ""
        ).trim();
      }
    });

    document.fonts.ready.then(() => {
      requestAnimationFrame(() => this.fillLeaders());
    });
  }

  private static fillLeaders() {
    document
      .querySelectorAll<HTMLElement>(".tof .toc-row, .tot .toc-row")
      .forEach((row) => {
        const dots = row.querySelector<HTMLElement>(".toc-dots");
        const page = row.querySelector<HTMLElement>(".toc-page");
        if (!dots || !page) return;

        dots.style.width = "0";

        const dotsRect = dots.getBoundingClientRect();
        const pageRect = page.getBoundingClientRect();
        const available = pageRect.left - dotsRect.left - 4;

        dots.style.width = `${Math.max(0, available)}px`;
      });
  }
}
