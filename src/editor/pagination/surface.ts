import { applyPageGeometry, paginationGeometry } from "./options";
import { paginationFurniture, paginationPageNumber } from "./presentation/decorations";
import { formatPageNumber } from "@/utils/page-number";
import type { PaginationState } from "./state";
import { paginationSection } from "./section-context";

/** Own page chrome and its styles; source content belongs to ProseMirror. */
export class PaginationSurface {
  private page: HTMLElement | null;
  private sheets = document.createElement("div");
  private chromeSignature = "";

  constructor(private readonly editor: HTMLElement) {
    this.page = editor.closest<HTMLElement>(".page");
    this.sheets.className = "editor-pagination-sheets";
    this.sheets.inert = true;
    this.sheets.setAttribute("aria-hidden", "true");
  }

  update(
    state: Pick<
      PaginationState,
      "enabled" | "layout" | "options" | "numbering"
    >,
  ) {
    const section = paginationSection(this.editor.closest(".page"));
    const geometry = paginationGeometry(state.options, section);
    const active = state.enabled && !state.layout.error;
    this.page ??= this.editor.closest<HTMLElement>(".page");
    this.page?.toggleAttribute("data-paginated-editor", active);
    this.page?.toggleAttribute("data-pagination-surface", active);
    if (active && this.page) {
      applyPageGeometry(this.page, geometry);
      this.page.style.setProperty(
        "--editor-page-height",
        `${geometry.height}px`,
      );
      this.page.style.setProperty("--editor-page-gap", `${geometry.gap}px`);
      this.page.style.setProperty(
        "--editor-page-count",
        String(state.layout.pages),
      );
      if (!this.sheets.isConnected) this.page.append(this.sheets);
      const group = this.page.classList.contains("static-chapter")
        ? "introduction"
        : this.page.classList.contains("attachment-chapter")
          ? "appendix"
          : "chapters";
      const chromeSignature = JSON.stringify([
        state.layout.pages,
        state.layout.furniture,
        geometry,
        group,
        state.numbering,
      ]);
      if (chromeSignature !== this.chromeSignature) {
        this.chromeSignature = chromeSignature;
        this.sheets.replaceChildren();
        for (let index = 0; index < state.layout.pages; index++) {
          const sheet = document.createElement("div");
          sheet.className = "editor-pagination-sheet";
          const top = index * geometry.stride;
          const label =
            state.options.documentNumbering !== false
              ? state.numbering?.labels?.[index]
              : formatPageNumber(
                  index + 1,
                  geometry.pageNumberFormat ??
                    (group === "introduction" ? "roman-lower" : "decimal"),
                );
          sheet.style.top = `${top}px`;
          this.sheets.append(sheet);
          if (label)
            this.sheets.append(
              paginationPageNumber(
                label,
                geometry,
                top,
                geometry.pageNumber ?? geometry.pageNumbers[group],
              ),
            );
          if (index < state.layout.pages - 1) {
            const boundary = document.createElement("div");
            boundary.className = "editor-pagination-boundary";
            boundary.style.top = `${top + geometry.height - geometry.margins.bottom}px`;
            this.sheets.append(boundary);
          }
        }
        this.sheets.append(paginationFurniture(state.layout.furniture ?? []));
      }
    } else {
      this.sheets.remove();
      this.chromeSignature = "";
      this.clearPageStyle();
    }
  }

  private clearPageStyle() {
    for (const key of ["height", "gap", "count"])
      this.page?.style.removeProperty(`--editor-page-${key}`);
    for (const side of ["top", "right", "bottom", "left"])
      this.page?.style.removeProperty(`--editor-margin-${side}`);
    this.page?.style.removeProperty("--editor-content-width");
  }

  destroy() {
    this.sheets.remove();
    this.page?.removeAttribute("data-paginated-editor");
    this.page?.removeAttribute("data-pagination-surface");
    this.clearPageStyle();
  }
}
