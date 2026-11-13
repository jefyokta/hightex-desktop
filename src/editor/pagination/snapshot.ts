import type { Node as ModelNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { DEFAULT_PAGINATION, applyPageGeometry, type PaginationGeometry } from "./options";

interface TextRun {
  from: number;
  node: Text;
}

/** An isolated, inert layout surface. It never owns an editor or writes data. */
export class LayoutSnapshot {
  readonly model: ModelNode;
  readonly host: HTMLElement;
  readonly root: HTMLElement;
  readonly elements = new Map<number, HTMLElement>();
  readonly runs: TextRun[] = [];
  /** Table subtrees delegated to their own pass; includes deferred children. */
  readonly completedTables = new Set<number>();
  readonly origin: number;
  readonly left: number;

  private copies = new Map<Node, Node>();

  constructor(view: EditorView, readonly geometry: PaginationGeometry = DEFAULT_PAGINATION) {
    this.model = view.state.doc;
    const page = view.dom.closest<HTMLElement>(".page");
    if (!page || !view.dom.isConnected) throw Error("Editor is not mounted");
    this.root = this.copy(view.dom) as HTMLElement;
    this.host = page.cloneNode(false) as HTMLElement;
    this.host.removeAttribute("id");
    this.host.setAttribute("aria-hidden", "true");
    this.host.setAttribute("data-pagination-measure", "");
    this.host.inert = true;
    this.host.style.cssText =
      "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;contain:layout style;";
    this.host.style.setProperty(
      "--start-counter",
      getComputedStyle(page).getPropertyValue("--start-counter"),
    );
    this.host.setAttribute("data-pagination-surface", "");
    applyPageGeometry(this.host, geometry);
    const wrapper = document.createElement("div");
    wrapper.append(this.root);
    this.host.append(wrapper);
    document.body.append(this.host);
    const bounds = this.host.getBoundingClientRect();
    this.origin = bounds.top + geometry.margins.top;
    this.left = bounds.left;
    this.model.descendants((node, pos) => {
      if (node.isText) return false;
      const dom = view.nodeDOM(pos);
      const copy = dom && this.copies.get(dom);
      if (copy instanceof HTMLElement) this.elements.set(pos, copy);
      return true;
    });
    const walker = document.createTreeWalker(view.dom, NodeFilter.SHOW_TEXT);
    let original: Node | null;
    while ((original = walker.nextNode())) {
      if (
        original.parentElement?.closest(
          '[data-editor-page-break], [contenteditable="false"]',
        )
      )
        continue;
      const copy = this.copies.get(original);
      if (copy instanceof Text && copy.length)
        this.runs.push({ from: view.posAtDOM(original, 0), node: copy });
    }
    this.runs.sort((a, b) => a.from - b.from);
  }

  private copy(node: Node): Node | null {
    if (node instanceof Element && node.hasAttribute("data-editor-page-break"))
      return null;
    const clone = node.cloneNode(false);
    this.copies.set(node, clone);
    if (clone instanceof HTMLElement) {
      clone.removeAttribute("id");
      clone.removeAttribute("contenteditable");
      clone.classList.remove(
        "editor-pagination-block",
        "editor-pagination-row",
        "editor-pagination-scaled",
      );
      // Decoration styles must disappear with their classes. Otherwise table
      // continuation HTML retains stale row heights and changes on every pass.
      for (const property of ["--editor-row-height", "--editor-break-height", "--editor-original-margin", "--editor-atom-scale"])
        clone.style.removeProperty(property);
      if (!clone.className) clone.removeAttribute("class");
      if (!clone.style.length) clone.removeAttribute("style");
    }
    if (node instanceof HTMLImageElement && clone instanceof HTMLImageElement) {
      clone.style.width = `${node.offsetWidth}px`;
      clone.style.height = `${node.offsetHeight}px`;
    }
    for (const child of node.childNodes) {
      const copy = this.copy(child);
      if (copy) clone.appendChild(copy);
    }
    return clone;
  }

  /** Only visit runs owned by this textblock, avoiding a chapter-wide scan. */
  *textRuns(from: number, to: number) {
    let low = 0;
    let high = this.runs.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.runs[middle].from < from) low = middle + 1;
      else high = middle;
    }
    for (let index = low; index < this.runs.length && this.runs[index].from < to; index++)
      yield this.runs[index];
  }

  point(from: number): { node: Text; offset: number } | null {
    let low = 0;
    let high = this.runs.length - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      const run = this.runs[middle];
      if (from < run.from) high = middle - 1;
      else if (from >= run.from + run.node.length) low = middle + 1;
      else return { node: run.node, offset: from - run.from };
    }
    return null;
  }

  charRect(from: number): DOMRect | null {
    const point = this.point(from);
    if (!point) return null;
    const range = document.createRange();
    range.setStart(point.node, point.offset);
    range.setEnd(point.node, point.offset + 1);
    return range.getBoundingClientRect();
  }

  spacer(from: number, height: number) {
    const spacer = document.createElement("span");
    spacer.setAttribute("data-editor-page-break", "");
    spacer.contentEditable = "false";
    spacer.textContent = "\u2060";
    spacer.style.height = `${height}px`;
    const point = this.point(from);
    if (point) {
      const right = point.node.splitText(point.offset);
      const run = { from, node: right };
      const index = this.runs.findIndex((item) => item.node === point.node);
      this.runs.splice(index + 1, 0, run);
      right.before(spacer);
      return;
    }
    const atom = this.elements.get(from);
    if (atom) {
      atom.before(spacer);
      return;
    }
    const $pos = this.model.resolve(from);
    const parent = this.elements.get($pos.before());
    if (!parent) throw Error("Unable to locate a page break");
    const content =
      parent.querySelector("[data-node-view-content-react]") ?? parent;
    content.prepend(spacer);
  }

  margin(from: number, height: number) {
    const element = this.elements.get(from);
    if (!element) throw Error("Unable to locate a block");
    const before = element.getBoundingClientRect().top;
    const original = parseFloat(getComputedStyle(element).marginTop) || 0;
    element.style.setProperty("--editor-original-margin", `${original}px`);
    element.classList.add("editor-pagination-block");
    // Margins are not additive: siblings and node-view descendants can collapse
    // with this margin. Calibrate the CSS margin against the actual displacement
    // instead of assuming that a 250px margin moves the block by 250px.
    let cssHeight = height;
    let previous: { css: number; moved: number } | undefined;
    // A table cell's minimum height can absorb part of the first displacement.
    // The slope then changes when its contents start growing the row. Allow the
    // bounded calibration to settle across that transition and pixel rounding.
    for (let attempt = 0; attempt < 8; attempt++) {
      element.style.setProperty("--editor-break-height", `${cssHeight}px`);
      const moved = element.getBoundingClientRect().top - before;
      const error = height - moved;
      if (Math.abs(error) <= 0.05)
        return { height: cssHeight, marginTop: original };
      const slope = previous
        ? (moved - previous.moved) / (cssHeight - previous.css)
        : 1;
      previous = { css: cssHeight, moved };
      cssHeight += error / (Number.isFinite(slope) && slope > 0 ? slope : 1);
    }
    throw Error("A block page break did not reach its measured position");
  }

  destroy() {
    this.host.remove();
    this.copies.clear();
    this.elements.clear();
    this.runs.length = 0;
  }
}

/** Yield only when a time slice is spent, and honor cancellation between slices. */
export function layoutCheckpoint(signal: AbortSignal) {
  let deadline = performance.now() + 6;
  return async () => {
    signal.throwIfAborted();
    if (performance.now() < deadline) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    signal.throwIfAborted();
    deadline = performance.now() + 6;
  };
}
