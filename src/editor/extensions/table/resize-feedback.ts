import { getCurrentLanguage, t } from "@/utils/lang";

/** Temporary editor UI, outside the content tree and removed with its gesture. */
export class TableResizeFeedback {
  private element: HTMLDivElement;
  private values: HTMLDivElement;
  private hint: HTMLDivElement;
  private format = new Intl.NumberFormat(getCurrentLanguage(), { maximumFractionDigits: 1 });

  constructor(private readonly table: HTMLTableElement) {
    const document = table.ownerDocument;
    this.element = document.createElement("div");
    this.element.className = "table-column-resize-feedback";
    this.element.setAttribute("data-editor-ui", "");
    this.element.setAttribute("aria-hidden", "true");
    this.values = document.createElement("div");
    this.values.className = "table-column-resize-values";
    this.hint = document.createElement("div");
    this.hint.className = "table-column-resize-hint";
    this.element.append(this.values, this.hint);
    document.body.append(this.element);
    document.body.classList.add("table-column-resizing");
    table.setAttribute("data-column-resizing", "");
  }

  update(cell: HTMLElement, column: number, widths: readonly number[], limited: boolean, pointerY: number) {
    const labels = [column, column + 1].filter((index) => index < widths.length);
    this.values.textContent = labels.map((index) => t("editor.inline.column_width", {
      column: index + 1,
      width: this.format.format(widths[index]),
    })).join("  ·  ");
    this.hint.textContent = [
      ...(limited ? [t("editor.inline.column_resize_limit")] : []),
      t("editor.inline.column_resize_cancel"),
    ].join(" · ");
    this.element.dataset.limited = String(limited);
    this.table.dataset.columnResizeLimit = String(limited);
    const window = this.table.ownerDocument.defaultView!;
    const edge = cell.getBoundingClientRect().right;
    const box = this.element.getBoundingClientRect();
    const left = edge + 12 + box.width > window.innerWidth ? edge - 12 - box.width : edge + 12;
    this.element.style.left = `${Math.max(8, Math.min(left, window.innerWidth - box.width - 8))}px`;
    this.element.style.top = `${Math.max(8, Math.min(pointerY + 20, window.innerHeight - box.height - 8))}px`;
  }

  destroy() {
    this.element.remove();
    this.table.ownerDocument.body.classList.remove("table-column-resizing");
    this.table.removeAttribute("data-column-resizing");
    this.table.removeAttribute("data-column-resize-limit");
  }
}
