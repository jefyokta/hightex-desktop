import type { PaginationPageFragment } from "./types";
import { abortable } from "@/utils/abortable";
import type { Node as ModelNode } from "@tiptap/pm/model";
import type { ReadOnlyChapter } from "@/editor/chapter/read-only-chapter";
import { paginationFurniture } from "@/editor/pagination/presentation/decorations";
import { layoutCheckpoint } from "@/editor/pagination/measurement/layout-snapshot";
import { applyPageGeometry, type PaginationGeometry } from "@/editor/pagination/options";
import "./editor-page-fragments.css";
import { pageFragmentRanges } from "./fragment-ranges";
import { FragmentSurface } from "./fragment-surface";
import { tableFragmentColumns } from "./table-fragments";
import {
  fragmentText,
  fragmentTextPosition,
  fragmentAnchor,
} from "./fragment-content";
import { PageImageSnapshot } from "@/editor/pagination/measurement/image-snapshot";
import { waitForPrintImages } from "@/compiler/print-resources";
import { PaginationImageError } from "@/exception/pagination-image-error";
import { PaginationAnchorError } from "./anchor-error";
import { assertPageImagePlacement } from "@/editor/pagination/measurement/image-placement";
import { freezeReadOnlyPresentation } from "@/editor/pagination/presentation/read-only-content";
import { paginationListItems, type PaginationListItem } from "./list-items";

/** Materialize source fragments from recorded placement, without choosing page breaks. */
export class PageFragments {
  readonly pages: PaginationPageFragment[] = [];
  readonly targets = new Map<string, number>();
  private readonly geometry: PaginationGeometry;
  private destroyed = false;

  constructor(
    private readonly chapter: Pick<
      ReadOnlyChapter,
      "source" | "view" | "layout" | "layoutRevision" | "headingNumbers"
    >,
    geometry: PaginationGeometry,
  ) {
    this.geometry = structuredClone(geometry);
  }

  async render(
    host: HTMLElement,
    signal: AbortSignal,
    validateLinks = true,
  ): Promise<void> {
    if (this.destroyed) throw Error("Page fragments are destroyed");
    if (host.childNodes.length || this.pages.length)
      throw Error("Page fragments require an empty output host");
    const { source, view } = this.chapter;
    const layout = this.chapter.layout;
    const revision = this.chapter.layoutRevision;
    const sourcePage = view.dom.closest<HTMLElement>(".page");
    if (!sourcePage) throw Error("Missing source page surface");
    const images = new PageImageSnapshot(view);
    const current = () => {
      signal.throwIfAborted();
      if (
        this.destroyed ||
        view.isDestroyed ||
        view.state.doc !== source ||
        this.chapter.layoutRevision !== revision
      )
        throw Error("Page fragment source or plan changed");
      if (document.fonts.status === "loading")
        throw Error("Page fonts are not ready");
      const issue = images.issue;
      if (issue)
        throw new PaginationImageError({
          code:
            issue.reason === "unavailable"
              ? "pagination.image.unavailable"
              : "pagination.image.changed",
          image: issue.image,
        });
      if (
        Math.abs(
          sourcePage.getBoundingClientRect().width - this.geometry.width,
        ) > 0.5
      )
        throw Error("Page source geometry changed");
      const style = getComputedStyle(sourcePage);
      for (const [side, margin] of Object.entries(this.geometry.margins))
        if (
          Math.abs(
            parseFloat(style.getPropertyValue(`padding-${side}`)) - margin,
          ) > 0.1
        )
          throw Error("Page source geometry changed");
      const paper = sourcePage.getBoundingClientRect();
      // An image may fit one page and still be misplaced across a recorded cut.
      for (const [index, image] of images.images.entries())
        assertPageImagePlacement(
          image.getBoundingClientRect(),
          paper,
          this.geometry,
          index + 1,
        );
    };
    current();
    const sourceTop = sourcePage.getBoundingClientRect().top;
    const ranges = pageFragmentRanges(source, layout, (block, from, to) => {
      const first = fragmentTextPosition(view, block, from, to);
      const top =
        first === undefined
          ? (view.nodeDOM(block) as HTMLElement).getBoundingClientRect().top
          : fragmentAnchor(view, first).top;
      return Math.floor((top - sourceTop) / this.geometry.stride) + 1;
    });
    const leaves = new Set<HTMLElement>();
    const listItems = new Map<HTMLElement, PaginationListItem>();
    for (const [pos, item] of paginationListItems(source)) {
      const element = view.nodeDOM(pos);
      const listItem = element instanceof HTMLElement
        ? element.matches("li") ? element : element.querySelector("li")
        : null;
      if (!listItem) throw Error("Missing list item presentation");
      listItems.set(listItem, item);
    }
    const tables = new Map<
      HTMLTableElement,
      { node: ModelNode; pos: number; columns?: number[] }
    >();
    source.descendants((node, pos) => {
      if (node.type.name !== "table") return;
      const dom = view.nodeDOM(pos);
      const table =
        dom instanceof HTMLTableElement
          ? dom
          : dom instanceof HTMLElement
            ? dom.querySelector("table")
            : null;
      if (!table) throw Error("Missing source table surface");
      const columns = table.querySelector("colgroup")
        ? undefined
        : tableFragmentColumns(node, table.getBoundingClientRect(), (from) => {
            const cell = view.nodeDOM(pos + 1 + from);
            if (!(cell instanceof HTMLTableCellElement))
              throw Error("Missing source column geometry");
            return cell.getBoundingClientRect();
          });
      tables.set(table, { node, pos, columns });
    });
    for (const range of ranges) {
      const dom = view.nodeDOM(range.block);
      if (!(dom instanceof HTMLElement))
        throw Error("Missing fragment source block");
      leaves.add(dom);
    }
    const ids = new Set<string>();
    for (const element of view.dom.querySelectorAll<HTMLElement>("[id]")) {
      if (!element.id) continue;
      if (ids.has(element.id)) throw new PaginationAnchorError(element.id);
      ids.add(element.id);
    }
    const checkpoint = layoutCheckpoint(signal);
    const headings = this.chapter.headingNumbers;
    try {
      for (let index = 0; index < layout.pages; index++) {
        current();
        const selected = ranges.filter((range) => range.page === index + 1);
        const surface = new FragmentSurface(
          view,
          sourcePage,
          index + 1,
          this.geometry,
          selected,
          leaves,
          tables,
          listItems,
        );
        const element = sourcePage.cloneNode(false) as HTMLElement;
        element.removeAttribute("id");
        element.removeAttribute("data-paginated-editor");
        element.classList.add("editor-page-fragment");
        element.style.position = "relative";
        element.style.left = element.style.top = "";
        element.style.margin = "0";
        element.style.width = `${this.geometry.width}px`;
        element.style.height =
          element.style.minHeight = `${this.geometry.height}px`;
        element.style.boxShadow = "none";
        element.style.borderRadius = "0";
        applyPageGeometry(element, this.geometry);
        const content = surface.clone();
        content.removeAttribute("id");
        // The print host need not load Tiptap's injected editor stylesheet.
        const style = getComputedStyle(view.dom);
        for (const property of [
          "white-space",
          "overflow-wrap",
          "word-break",
          "font-variant-ligatures",
          "font-feature-settings",
        ])
          content.style.setProperty(property, style.getPropertyValue(property));
        content.inert = true;
        element.append(content);
        if (
          content.textContent !==
          selected
            .map((range) => fragmentText(view, range.from, range.to))
            .join("")
        )
          throw Error(
            "Page fragments did not preserve their complete source text",
          );
        for (const node of content.querySelectorAll<HTMLElement>("*")) {
          if (node.id) {
            const id = node.id;
            node.dataset.fragmentSourceId = id;
            if (this.targets.has(id)) node.removeAttribute("id");
            else this.targets.set(id, index + 1);
            const number = headings.get(id);
            if (number && node.matches("h2,h3"))
              node.dataset.fragmentHeading = number;
            if (number && node.matches("h1")) {
              node.style.counterSet = `h1-counter ${number}`;
              node.style.counterIncrement = "none";
            }
          }
        }
        const furniture = paginationFurniture(
          (layout.furniture ?? [])
            .filter(
              (item) => Math.floor(item.top / this.geometry.stride) === index,
            )
            .map((item) => ({
              ...item,
              top: item.top - index * this.geometry.stride,
            })),
        );
        for (const node of furniture.querySelectorAll<HTMLElement>("[id]"))
          node.removeAttribute("id");
        const sheets = document.createElement("div");
        sheets.className = "editor-pagination-sheets";
        sheets.inert = true;
        sheets.append(furniture);
        element.append(sheets);
        host.append(element);
        freezeReadOnlyPresentation(content);
        this.pages.push({
          page: index + 1,
          ranges: selected,
          element,
          content,
        });
        // Cloned <img> elements decode independently. Align only after their
        // intrinsic dimensions are available in this fragment's own DOM.
        await waitForPrintImages(element, signal);
        element.getBoundingClientRect();
        await abortable(document.fonts.ready, signal);
        current();
        surface.align(element);
        await checkpoint();
        current();
      }
      if (validateLinks)
        assertFragmentLinks(host, new Set(this.targets.keys()));
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  destroy() {
    this.destroyed = true;
    this.pages.splice(0).forEach((page) => page.element.remove());
    this.targets.clear();
  }
}

/** Cross-section links are validated after the complete document is assembled. */
export function assertFragmentLinks(
  root: ParentNode,
  targets: ReadonlySet<string>,
) {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    const target = decodeURIComponent(link.getAttribute("href")!.slice(1));
    if (target && !targets.has(target))
      throw Error(`Unresolved fragment link target: ${target}`);
  }
}
