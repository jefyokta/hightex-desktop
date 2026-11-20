import type { Node as ModelNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import {
  DEFAULT_PAGINATION,
  applyPageGeometry,
  type PaginationGeometry,
} from "../options";
import {
  clearPaginationPresentation,
  editorNonContentSelector,
  paginationSpacer,
} from "../presentation/decorations";
import { PageImageSnapshot } from "./image-snapshot";
import { freezeReadOnlyBoundary } from "../presentation/read-only-content";
import { calibratePageMargin } from "./block-margin";
import type { SectionComposition } from "@/document-engine/composition/section-composition";

import { textPoint, textPointRect } from "../flow/text-lines";

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
  readonly images = new Map<number, { width: number; height: number }>();
  readonly runs: TextRun[] = [];
  /** Table subtrees delegated to their own pass; includes deferred children. */
  readonly completedTables = new Set<number>();
  readonly origin: number;
  readonly left: number;
  readonly generated = new Map<string, HTMLElement>();

  private copies = new Map<Node, Node>();
  private authoredImages: ReadonlySet<HTMLImageElement>;

  constructor(
    view: EditorView,
    readonly geometry: PaginationGeometry = DEFAULT_PAGINATION,
    composition?: SectionComposition,
  ) {
    this.model = view.state.doc;
    const page = view.dom.closest<HTMLElement>(".page");
    if (!page || !view.dom.isConnected) throw Error("Editor is not mounted");
    this.authoredImages = new Set(new PageImageSnapshot(view).images);
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
    if (composition) {
      if (!composition.body.contains(view.dom))
        throw Error("Composition does not own this editor");
      const shell = this.copy(composition.element) as HTMLElement;
      const body = this.copies.get(composition.body) as HTMLElement;
      // Reuse the canonical copy mapping of the editor after copying the shell.
      this.root = this.copies.get(view.dom) as HTMLElement;
      if (!body.contains(this.root))
        throw Error("Missing composition body copy");
      this.host.append(shell);
      for (const [slot, block] of composition.blocks)
        this.generated.set(slot, this.copies.get(block) as HTMLElement);
    } else {
      this.root = this.copy(view.dom) as HTMLElement;
      const wrapper = document.createElement("div");
      wrapper.append(this.root);
      this.host.append(wrapper);
    }
    document.body.append(this.host);
    this.root.inert = true;
    const bounds = this.host.getBoundingClientRect();
    this.origin = bounds.top + geometry.margins.top;
    this.left = bounds.left;
    this.model.descendants((node, pos) => {
      if (node.isText) return false;
      const dom = view.nodeDOM(pos);
      const copy = dom && this.copies.get(dom);
      if (copy instanceof HTMLElement) this.elements.set(pos, copy);
      if (node.type.name === "image" && dom instanceof HTMLElement) {
        const image =
          dom instanceof HTMLImageElement ? dom : dom.querySelector("img");
        if (image?.naturalWidth && image.naturalHeight)
          this.images.set(pos, {
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
      }
      return true;
    });
    const walker = document.createTreeWalker(view.dom, NodeFilter.SHOW_TEXT);
    let original: Node | null;
    while ((original = walker.nextNode())) {
      // A read-only editor marks its root non-editable. Only descendant atom
      // views are opaque; authored text still needs the same line measurement.
      const nonEditable = original.parentElement?.closest(
        '[contenteditable="false"]',
      );
      if (
        original.parentElement?.closest(editorNonContentSelector) ||
        (nonEditable && nonEditable !== view.dom)
      )
        continue;
      const copy = this.copies.get(original);
      if (copy instanceof Text && copy.length)
        this.runs.push({ from: view.posAtDOM(original, 0), node: copy });
    }
    this.runs.sort((a, b) => a.from - b.from);
  }

  private copy(node: Node): Node | null {
    if (node instanceof Element && node.matches(editorNonContentSelector))
      return null;
    // Native deep cloning avoids rebuilding every text/element subtree through
    // JS DOM mutations. Pair the trees once to retain exact source mappings.
    const clone = node.cloneNode(true);
    this.prepareCopy(node, clone);
    return clone;
  }

  private prepareCopy(node: Node, clone: Node) {
    this.copies.set(node, clone);
    if (clone instanceof HTMLElement) {
      if (node instanceof HTMLElement && node.hasAttribute("contenteditable"))
        freezeReadOnlyBoundary(clone, getComputedStyle(node).whiteSpace);
      clone.removeAttribute("id");
      // Decoration styles must disappear with their classes. Otherwise table
      // continuation HTML retains stale row heights and changes on every pass.
      clearPaginationPresentation(clone);
      if (!clone.className) clone.removeAttribute("class");
      if (!clone.style.length) clone.removeAttribute("style");
    }
    if (
      node instanceof HTMLImageElement &&
      clone instanceof HTMLImageElement &&
      this.authoredImages.has(node)
    ) {
      // Preserve the authored width and intrinsic ratio. Freezing the current
      // responsive size makes subsequent measurements depend on prior effects.
      if (node.naturalWidth && node.naturalHeight)
        clone.style.aspectRatio = `${node.naturalWidth} / ${node.naturalHeight}`;
      clone.style.height = "auto";
    }
    const children = Array.from(clone.childNodes);
    Array.from(node.childNodes).forEach((child, index) => {
      const copy = children[index];
      if (child instanceof Element && child.matches(editorNonContentSelector))
        copy.remove();
      else this.prepareCopy(child, copy);
    });
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
    for (
      let index = low;
      index < this.runs.length && this.runs[index].from < to;
      index++
    )
      yield this.runs[index];
  }

  point(from: number): { node: Text; offset: number } | null {
    return textPoint(this.runs, from);
  }

  charRect(from: number): DOMRect | null {
    return textPointRect(this.point(from));
  }

  spacer(from: number, height: number) {
    const spacer = paginationSpacer(height);
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
    return calibratePageMargin(element, height);
  }

  destroy() {
    this.host.remove();
    this.copies.clear();
    this.elements.clear();
    this.images.clear();
    this.generated.clear();
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
