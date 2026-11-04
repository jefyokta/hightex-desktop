import Layout from "@/types/pagedjs/chunker/layout";
import BreakToken from "@/types/pagedjs/chunker/breaktoken";

const TABLE_FIGURE = 'figure[data-type="figureTable"]';

type TableParts = {
  source: HTMLTableElement;
  caption: HTMLElement | null;
  header: HTMLTableSectionElement | null;
  columns: HTMLTableColElement;
  width: number;
  rowHeights: Map<string, number>;
};

/** Repeat furniture before Paged.js checks overflow, never after it cuts a page. */
export default class RepeatTableHeaderAndCaption {
  private tables = new Map<string, TableParts>();
  private startToken?: BreakToken;

  beginPage(token: BreakToken | undefined) {
    this.startToken = token;
  }

  onBreakToken(token: BreakToken | undefined, overflow: Range | undefined) {
    if (
      !token?.node ||
      !overflow ||
      token.node.nodeType !== Node.TEXT_NODE ||
      overflow.startContainer.nodeType !== Node.TEXT_NODE ||
      !token.node.parentElement?.closest(TABLE_FIGURE)
    )
      return;
    const start =
      this.startToken?.node === token.node
        ? Number(this.startToken.offset) || 0
        : 0;
    const source = token.node.textContent || "";
    // Paged.js uses indexOf(renderedText) to recover the source offset. In a
    // multi-page cell with repeated phrases, that can select an earlier copy
    // and render the same text forever. The page's input token is unambiguous.
    if (source.slice(start) === overflow.startContainer.textContent) {
      token.offset = start + overflow.startOffset;
    }
    return token;
  }

  afterParsed(parsed: HTMLElement) {
    this.tables.clear();
    const measurement = document.createElement("section");
    measurement.style.cssText =
      "position:absolute;left:-100000px;top:0;width:15cm;visibility:hidden;pointer-events:none";
    document.body.append(measurement);
    try {
      for (const figure of parsed.querySelectorAll<HTMLElement>(TABLE_FIGURE)) {
        const table = figure.querySelector("table");
        const ref = figure.dataset.ref;
        if (!table || !ref) continue;
        measurement.className = figure.closest(".attachment")
          ? "attachment"
          : "content";
        const clone = figure.cloneNode(true) as HTMLElement;
        measurement.replaceChildren(clone);
        const measuredTable = clone.querySelector("table")!;
        const bounds = measuredTable.getBoundingClientRect();
        if (!bounds.width) continue;

        // Cell boundaries also describe columns below merged header cells.
        const edges = Array.from(measuredTable.querySelectorAll("th,td"))
          .filter((cell) => cell.closest("table") === measuredTable)
          .flatMap((cell) => {
            const box = cell.getBoundingClientRect();
            return [box.left, box.right];
          })
          .sort((a, b) => a - b)
          .filter(
            (edge, index, all) => index === 0 || edge - all[index - 1] > 1,
          );
        if (edges.length < 2) continue;
        const columns = document.createElement("colgroup");
        columns.dataset.ref = `${table.dataset.ref}-columns`;
        for (let index = 1; index < edges.length; index++) {
          const col = document.createElement("col");
          col.style.width = `${edges[index] - edges[index - 1]}px`;
          col.dataset.ref = `${table.dataset.ref}-column-${index}`;
          columns.append(col);
        }
        const parts: TableParts = {
          source: table,
          caption: figure.querySelector(":scope > figcaption"),
          header: table.querySelector(":scope > thead"),
          columns,
          width: bounds.width,
          rowHeights: new Map(
            Array.from(measuredTable.rows, (row) => [
              row.dataset.ref || "",
              row.getBoundingClientRect().height,
            ]),
          ),
        };
        this.tables.set(ref, parts);
        this.setColumns(table, parts);
      }
    } finally {
      measurement.remove();
    }
  }

  layout(wrapper: HTMLElement, layout: Layout) {
    for (const figure of wrapper.querySelectorAll<HTMLElement>(TABLE_FIGURE)) {
      const parts = this.tables.get(figure.dataset.ref || "");
      const table = figure.querySelector("table");
      if (!parts || !table) continue;
      this.setColumns(table, parts);
      if (figure.dataset.splitFrom) {
        if (!figure.querySelector(":scope > figcaption") && parts.caption) {
          const caption = this.copyFurniture(parts.caption);
          caption.classList.add("continueing");
          caption.setAttribute("data-counter-caption-counter-increment", "0");
          figure.prepend(caption);
        }
        if (!table.querySelector(":scope > thead") && parts.header) {
          const head = this.copyFurniture(parts.header);
          table.insertBefore(head, table.tBodies[0] || null);
        }
      }
      const captionHeight =
        figure.querySelector("figcaption")?.getBoundingClientRect().height || 0;
      const headerHeight = table.tHead?.getBoundingClientRect().height || 0;
      const style = getComputedStyle(figure);
      const available =
        layout.bounds.height -
        captionHeight -
        headerHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      for (const row of Array.from(table.tBodies).flatMap((body) =>
        Array.from(body.rows),
      )) {
        const height =
          parts.rowHeights.get(row.dataset.ref || "") ||
          row.getBoundingClientRect().height;
        // A row taller than a whole page must still be allowed to split.
        row.style.breakInside = height <= available ? "avoid" : "auto";
      }
    }
  }

  onOverflow(
    overflow: Range | undefined,
    _wrapper: HTMLElement,
    bounds: DOMRect,
  ) {
    if (!overflow) return;
    const container = overflow.startContainer;
    const start =
      container.nodeType === Node.ELEMENT_NODE
        ? container.childNodes[overflow.startOffset] || container
        : container;
    const element =
      start.nodeType === Node.ELEMENT_NODE
        ? (start as Element)
        : start.parentElement;
    const figure = element?.closest<HTMLElement>(TABLE_FIGURE);
    const row = figure?.querySelector("tbody tr");
    if (!figure) return;
    let startsBeforeBody = !row;
    if (row) {
      const firstRow = document.createRange();
      firstRow.selectNode(row);
      startsBeforeBody =
        overflow.compareBoundaryPoints(Range.START_TO_START, firstRow) <= 0;
    }
    const startsInFirstRow = row?.contains(start);
    // A figure spanning CSS overflow columns has a union box starting at the
    // page top. Its caption still marks where it actually began on this page.
    const caption = figure.querySelector(":scope > figcaption");
    const top = caption
      ? caption.getBoundingClientRect().top -
        parseFloat(getComputedStyle(figure).paddingTop)
      : figure.getBoundingClientRect().top;
    const parts = this.tables.get(figure.dataset.ref || "");
    const sourceRow = row || parts?.source.tBodies[0]?.rows[0];
    const rowHeight =
      parts?.rowHeights.get(sourceRow?.getAttribute("data-ref") || "") || 0;
    // Keep the first body row with its caption/header when starting lower on a
    // page. At the top, let an oversized row make progress instead of looping.
    if (
      (startsBeforeBody || startsInFirstRow) &&
      top > bounds.top + 2 &&
      rowHeight < bounds.height
    ) {
      overflow.setStartBefore(figure);
    }
    return overflow;
  }

  private setColumns(table: HTMLTableElement, parts: TableParts) {
    table.style.width = `${parts.width}px`;
    table.style.tableLayout = "fixed";
    if (!table.querySelector(":scope > colgroup[data-hightex-columns]")) {
      table
        .querySelectorAll(":scope > colgroup")
        .forEach((group) => group.remove());
      const columns = parts.columns.cloneNode(true) as HTMLElement;
      columns.dataset.hightexColumns = "true";
      table.prepend(columns);
    }
  }

  private copyFurniture<T extends HTMLElement>(source: T): T {
    const clone = source.cloneNode(true) as T;
    for (const element of [
      clone,
      ...clone.querySelectorAll<HTMLElement>("*"),
    ]) {
      element.removeAttribute("id");
      element.removeAttribute("data-ref");
      element.removeAttribute("data-split-from");
      element.removeAttribute("data-split-to");
    }
    return clone;
  }
}
