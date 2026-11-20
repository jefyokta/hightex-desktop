import type { Engine } from "../engine";

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

  static createItem(heading: Element) {
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
    num.textContent = heading.getAttribute("data-numbering")?.trim() ?? "";

    const inner = document.createElement("div");
    inner.classList.add("toc-inner");

    const text = document.createElement("span");
    text.classList.add("toc-text");
    text.textContent = (heading.textContent ?? "").trim();

    const dots = document.createElement("span");
    dots.classList.add("toc-dots");

    const page = document.createElement("span");
    page.classList.add("toc-page");
    // console.log(h1s)

    inner.append(text, dots);
    if (num.textContent) row.append(num);
    else row.classList.add("unnumbered");
    row.append(inner, page);
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
      return h.id && h.id !== "tof" && h.id != "tot" && h.id !== "toa";
    });
    const selfHeading = wrapper.querySelector("#toc")!;
    heads.push(
      selfHeading,
      document.getElementById("tot")!,
      document.getElementById("tof")!,
      document.getElementById("toa")!,
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

    // Share one number column per level. Digits occupy 1ch and periods 0.5ch
    // in the document's Times font; leave half an em before every title.
    for (const [level, selector] of [
      [1, ".toc-row:not(.sub):not(.subsub) .toc-number"],
      [2, ".toc-row.sub .toc-number"],
      [3, ".toc-row.subsub .toc-number"],
    ] as const) {
      const widths = Array.from(wrapper.querySelectorAll(selector), (number) =>
        Array.from(number.textContent ?? "").reduce(
          (width, character) => width + (character === "." ? 0.5 : 1),
          0,
        ),
      );
      wrapper.style.setProperty(
        `--toc-h${level}-number-width`,
        `calc(${Math.max(1, ...widths)}ch + 0.5em)`,
      );
    }

    return wrapper;
  }

  static async assignPageNumbers() {
    const rows = document.querySelectorAll<HTMLAnchorElement>("a.toc-row");

    rows.forEach((row) => {
      const headingId = row.dataset.headingId;
      if (!headingId) return;

      const pageEl = row.querySelector<HTMLElement>(".toc-page");
      if (!pageEl) return;

      const pagedHeading = document.querySelector<HTMLElement>(
        `.pagedjs_pages #${CSS.escape(headingId)}`,
      );
      if (pagedHeading) {
        const pagedPage = pagedHeading.closest<HTMLElement>(".pagedjs_page");

        pageEl.textContent = (
          pagedPage?.querySelector(".hasContent")?.textContent ?? ""
        ).trim();
      }
    });
    await TocBuilder.fillLeaders();
  }

  static fillLeaders(root: ParentNode = document): Promise<void> {
    return new Promise((resolve) => {
      const run = () => {
        root.querySelectorAll<HTMLElement>(".toc-row").forEach((row) => {
          const text = row.querySelector<HTMLElement>(".toc-text");
          const dots = row.querySelector<HTMLElement>(".toc-dots");
          const page = row.querySelector<HTMLElement>(".toc-page");
          if (!text || !dots || !page) return;

          if (!text.getClientRects().length) return;
          // Reserve a visible leader first. If the title fills its last line,
          // this moves the leader to the next line with the bottom-aligned page.
          dots.textContent = "...";
          const box = dots.getBoundingClientRect();
          const dotWidth = box.width / 3;
          if (!dotWidth) return;
          const available = page.getBoundingClientRect().left - box.left - 6;
          dots.textContent = ".".repeat(
            Math.max(3, Math.floor(available / dotWidth)),
          );
        });

        resolve();
      };

      if (document.fonts?.ready) {
        document.fonts.ready.then(() => {
          requestAnimationFrame(() => requestAnimationFrame(run));
        });
      } else {
        requestAnimationFrame(() => requestAnimationFrame(run));
      }
    });
  }
}
