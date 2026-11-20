import type { PaginationSourceRange } from "./types";
import type { Node as ModelNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import type { PaginationGeometry } from "@/editor/pagination/options";
import { tableFragmentCells } from "./table-fragments";
import { copyTableColumns } from "@/editor/extensions/table/columns";
import type { PaginationListItem } from "./list-items";
import {
  clearPaginationPresentation,
  editorNonContentSelector,
} from "@/editor/pagination/presentation/decorations";

import {
  firstFragmentGlyph,
  fragmentAnchor,
  fragmentTextPosition,
} from "./fragment-content";

/** Clone selected source content and its containers; preserve already placed geometry. */
export class FragmentSurface {
  private readonly copies = new Map<HTMLElement, HTMLElement>();
  private readonly selected = new Map<HTMLElement, PaginationSourceRange>();
  private readonly required = new Set<HTMLElement>();
  private readonly origin: DOMRect;
  private readonly continuedItems = new Set<HTMLElement>();

  constructor(
    private readonly view: Pick<
      EditorView,
      "state" | "dom" | "nodeDOM" | "domAtPos" | "coordsAtPos"
    >,
    private readonly sourcePage: HTMLElement,
    private readonly page: number,
    private readonly geometry: PaginationGeometry,
    ranges: PaginationSourceRange[],
    private readonly leaves: ReadonlySet<HTMLElement>,
    private readonly tables: ReadonlyMap<
      HTMLTableElement,
      { node: ModelNode; pos: number; columns?: number[] }
    >,
    private readonly listItems: ReadonlyMap<HTMLElement, PaginationListItem>,
  ) {
    this.origin = sourcePage.getBoundingClientRect();
    const firstParts = new Map<HTMLElement, number>();
    for (const range of ranges) {
      const dom = view.nodeDOM(range.block);
      if (!(dom instanceof HTMLElement) || this.selected.has(dom))
        throw Error("Ambiguous source block on a page");
      this.selected.set(dom, range);
      let ancestor: HTMLElement | null = dom;
      while (ancestor) {
        this.required.add(ancestor);
        if (listItems.has(ancestor))
          firstParts.set(ancestor, Math.min(firstParts.get(ancestor) ?? Infinity, range.from));
        if (ancestor === view.dom) break;
        ancestor = ancestor.parentElement;
      }
    }
    for (const [item, from] of firstParts)
      if (from > listItems.get(item)!.from + 1)
        this.continuedItems.add(item);
  }

  clone(): HTMLElement {
    const content = this.copy(this.view.dom);
    if (!(content instanceof HTMLElement)) {
      return this.view.dom.cloneNode(false) as HTMLElement;
    }
    return content;
  }

  private shell(original: HTMLElement) {
    const copy = original.cloneNode(false) as HTMLElement;
    this.copies.set(original, copy);
    clearPaginationPresentation(copy, true);
    const item = this.listItems.get(original);
    if (item) copy.dataset.fragmentListFrom = String(item.from);
    if (item?.number !== undefined) copy.setAttribute("value", String(item.number));
    if (this.continuedItems.has(original)) copy.dataset.fragmentListContinuation = "";
    return copy;
  }

  private full(original: Node): Node {
    if (!(original instanceof HTMLElement)) return original.cloneNode(true);
    const copy = this.shell(original);
    for (const child of original.childNodes) {
      if (child instanceof Element && child.matches(editorNonContentSelector))
        continue;
      copy.append(this.full(child));
    }
    return copy;
  }

  private copy(original: Node): Node | null {
    if (!(original instanceof HTMLElement)) return null;
    if (original.matches(editorNonContentSelector)) return null;
    const range = this.selected.get(original);
    if (range) {
      const node = this.view.state.doc.nodeAt(range.block)!;
      if (range.from <= range.block && range.to >= range.block + node.nodeSize)
        return this.full(original);
      const start = this.view.domAtPos(
        Math.max(range.block + 1, range.from),
        1,
      );
      const end = this.view.domAtPos(
        Math.min(range.block + node.nodeSize - 1, range.to),
        -1,
      );
      const selection = document.createRange();
      selection.setStart(start.node, start.offset);
      selection.setEnd(end.node, end.offset);
      let fragment = selection.cloneContents();
      let ancestor = selection.commonAncestorContainer;
      if (ancestor instanceof Text) ancestor = ancestor.parentNode!;
      while (ancestor !== original) {
        if (!(ancestor instanceof HTMLElement))
          throw Error("Fragment left its source block");
        const wrapper = ancestor.cloneNode(false);
        wrapper.appendChild(fragment);
        fragment = document.createDocumentFragment();
        fragment.append(wrapper);
        ancestor = ancestor.parentNode!;
      }
      fragment
        .querySelectorAll(editorNonContentSelector)
        .forEach((node) => node.remove());
      const copy = this.shell(original);
      copy.append(fragment);
      return copy;
    }
    if (this.leaves.has(original)) return null;
    if (original instanceof HTMLTableElement)
      return this.required.has(original) ? this.copyTable(original) : null;
    if (!this.required.has(original) && !original.matches("td,th,colgroup,col"))
      return null;
    const copy = this.shell(original);
    for (const child of original.childNodes) {
      const part = this.copy(child);
      if (part) copy.append(part);
    }
    if (original instanceof HTMLTableCellElement) {
      copy.style.width = `${original.getBoundingClientRect().width}px`;
      copy.style.boxSizing = "border-box";
    }
    return copy;
  }

  private copyTable(original: HTMLTableElement) {
    const source = this.tables.get(original);
    if (!source) throw Error("Missing source table grid");
    const limits = this.tableLimits(original);
    const included = Array.from(original.rows).flatMap((row, index) => {
      const box = row.getBoundingClientRect();
      return box.bottom > limits.top + 0.1 && box.top < limits.bottom - 0.1
        ? [index]
        : [];
    });
    if (!included.length) throw Error("Missing table fragment rows");
    const first = included[0],
      end = included[included.length - 1] + 1;
    const copy = this.shell(original) as HTMLTableElement;
    if (limits.header) copy.dataset.fragmentTableContinuation = "";
    const width = original.getBoundingClientRect().width;
    copy.style.width = copy.style.minWidth = copy.style.maxWidth = `${width}px`;
    copy.style.tableLayout = "fixed";
    const columns = original.querySelector("colgroup");
    if (columns) copy.append(copyTableColumns(columns));
    else if (source.columns) {
      const group = document.createElement("colgroup");
      for (const width of source.columns) {
        const column = document.createElement("col");
        column.style.width = `${width}px`;
        group.append(column);
      }
      copy.append(group);
    }
    const body = document.createElement("tbody");
    const rows = new Map<number, HTMLTableRowElement>();
    for (let index = first; index < end; index++) {
      const row = original.rows[index],
        part = this.shell(row) as HTMLTableRowElement;
      const box = row.getBoundingClientRect();
      part.style.height = `${Math.max(0, Math.min(box.bottom, limits.bottom) - Math.max(box.top, limits.top))}px`;
      body.append(part);
      rows.set(index, part);
    }
    for (const cell of tableFragmentCells(source.node, first, end)) {
      const dom = this.view.nodeDOM(source.pos + 1 + cell.from);
      if (!(dom instanceof HTMLTableCellElement))
        throw Error("Missing source table cell");
      const part = this.copy(dom);
      if (!(part instanceof HTMLTableCellElement))
        throw Error("Missing table fragment cell");
      part.colSpan = cell.colspan;
      part.rowSpan = cell.rowspan;
      part.dataset.fragmentCell = String(source.pos + 1 + cell.from);
      part.dataset.fragmentColumn = String(cell.column);
      part.dataset.fragmentRow = String(cell.row);
      rows.get(cell.row)!.append(part);
    }
    copy.append(body);
    return copy;
  }

  private tableLimits(original: HTMLElement) {
    const top =
      this.origin.top +
      (this.page - 1) * this.geometry.stride +
      this.geometry.margins.top;
    const table = original.closest("table")!;
    const bounds = table.getBoundingClientRect();
    let bodyTop = top;
    let header = false;
    for (const furniture of this.sourcePage.querySelectorAll<HTMLElement>(
      ".editor-pagination-furniture > figure",
    )) {
      const box = furniture.getBoundingClientRect();
      if (
        Math.abs(box.left - bounds.left) < 1 &&
        Math.abs(box.width - bounds.width) < 1 &&
        box.top >= top - 1 &&
        box.top < top + this.geometry.contentHeight
      ) {
        bodyTop = Math.max(bodyTop, box.bottom);
        header ||= !!furniture.querySelector("table");
      }
    }
    return { top: bodyTop, bottom: top + this.geometry.contentHeight, header };
  }

  private justifyContinuation(original: HTMLElement, copy: HTMLElement) {
    copy.style.textAlignLast = "justify";
    // break-spaces keeps the trailing space inside the justified live line.
    // Other wrapping modes hang/collapse it at a soft wrap instead.
    if (getComputedStyle(original).whiteSpace === "break-spaces") return;
    // A soft-wrapped live line hangs its trailing spaces. At the fragment's
    // paragraph boundary, preserved spaces would instead consume justification
    // width. Collapse only that boundary's whitespace, retaining its source text.
    let last: ChildNode | null = copy.lastChild;
    while (last?.lastChild) last = last.lastChild;
    if (!(last instanceof Text)) return;
    const trailing = last.data.match(/[ \t]+$/)?.[0];
    if (!trailing) return;
    const text = last.splitText(last.length - trailing.length);
    const boundary = document.createElement("span");
    boundary.style.whiteSpace = "normal";
    text.replaceWith(boundary);
    boundary.append(text);
  }

  /** Align selected blocks to their recorded positions; never choose a page break. */
  align(frame: HTMLElement) {
    const frameBox = frame.getBoundingClientRect();
    const expected = (top: number) =>
      top - this.origin.top - (this.page - 1) * this.geometry.stride;
    const move = (copy: HTMLElement, target: number, actual: number) => {
      copy.style.position = "relative";
      copy.style.top = `${target - actual}px`;
    };
    for (const [original, copy] of this.copies) {
      if (!(original instanceof HTMLTableElement)) continue;
      const first = Array.from(original.rows).find((row) =>
        this.copies.has(row),
      );
      if (!first) continue;
      const top = Math.max(
        first.getBoundingClientRect().top,
        this.tableLimits(first).top,
      );
      move(
        copy,
        expected(top),
        copy.getBoundingClientRect().top - frameBox.top,
      );
    }
    for (const [original, range] of this.selected) {
      const copy = this.copies.get(original)!;
      const model = this.view.state.doc.nodeAt(range.block)!;
      if (copy.tagName === "P" && range.from > range.block)
        copy.style.setProperty("text-indent", "0", "important");
      if (
        copy.tagName === "P" &&
        range.to < range.block + model.nodeSize &&
        this.view.state.doc.nodeAt(range.to - 1)?.type.name !== "hardBreak" &&
        getComputedStyle(original).textAlign === "justify"
      )
        this.justifyContinuation(original, copy);
      const first = fragmentTextPosition(
        this.view,
        range.block,
        range.from,
        range.to,
      );
      if (first === undefined) {
        move(
          copy,
          expected(original.getBoundingClientRect().top),
          copy.getBoundingClientRect().top - frameBox.top,
        );
        continue;
      }
      const glyph = firstFragmentGlyph(copy);
      if (!glyph) throw Error("Missing fragment source text");
      move(
        copy,
        expected(fragmentAnchor(this.view, first).top),
        glyph.top - frameBox.top,
      );
    }
    const content = this.copies.get(this.view.dom);
    if (!content) return;
    const inside = (rect: DOMRect) => {
      if (!rect.width || !rect.height) return true;
      const { margins } = this.geometry;
      return (
        rect.left >= frameBox.left + margins.left - 2 &&
        rect.right <= frameBox.right - margins.right + 2 &&
        rect.top >= frameBox.top + margins.top - 2 &&
        rect.bottom <= frameBox.bottom - margins.bottom + 2
      );
    };
    const requireInside = (rect: DOMRect, text?: Node) => {
      if (!inside(rect)) {
        const owner =
          text &&
          Array.from(this.copies).find(
            ([original, copy]) =>
              this.selected.has(original) && copy.contains(text),
          );
        const glyph = owner && firstFragmentGlyph(owner[0]);
        throw Error(
          `Page fragment content is outside its recorded page (${this.page}, x=${rect.left - frameBox.left}..${rect.right - frameBox.left}, y=${rect.top - frameBox.top}..${rect.bottom - frameBox.top}${text ? `, ${JSON.stringify(text.textContent?.slice(0, 80))}` : ""}${glyph ? `, sourceY=${expected(glyph.top)}` : ""})`,
        );
      }
    };
    for (const image of content.querySelectorAll("img"))
      requireInside(image.getBoundingClientRect());
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode())) {
      const range = document.createRange();
      range.selectNodeContents(text);
      if (Array.from(range.getClientRects()).every(inside)) continue;
      // Preserved trailing whitespace can extend beyond the content margin.
      // Check the actual glyphs before declaring authored content clipped.
      let offset = 0;
      for (const character of text.textContent ?? "") {
        if (character.trim()) {
          range.setStart(text, offset);
          range.setEnd(text, offset + character.length);
          Array.from(range.getClientRects()).forEach((rect) =>
            requireInside(rect, text!),
          );
        }
        offset += character.length;
      }
    }
  }
}
