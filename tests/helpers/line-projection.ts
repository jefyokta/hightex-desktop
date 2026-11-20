import type { EditorView } from "@tiptap/pm/view";
import { DOMSerializer } from "@tiptap/pm/model";
import type { PaginationGeometry } from "../../src/editor/pagination/options";
import { editorNonContentSelector } from "../../src/editor/pagination/presentation/decorations";
import { freezeReadOnlyPresentation } from "../../src/editor/pagination/presentation/read-only-content";

interface Point { node: Text; offset: number }
export interface MeasuredTextLine {
  readonly from: number;
  readonly to: number;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly ending: "soft" | "hard" | "paragraph";
  readonly html: string;
  readonly tag: string;
  readonly typography: Readonly<Record<string, string>>;
  readonly direction: string;
  readonly whiteSpace: string;
  readonly align: string;
}

interface LineRange {
  start: Point;
  end: Point;
  from: number;
  to: number;
  top: number;
  bottom: number;
}

/** Deliberately bounded typography experiment, not a document renderer. */
export function measureTextLines(view: EditorView, geometry: PaginationGeometry) {
  const paper = view.dom.closest<HTMLElement>(".page");
  if (!paper) throw Error("Missing editor reference surface");
  const origin = paper.getBoundingClientRect(), scale = origin.width / geometry.width;
  const lines: MeasuredTextLine[] = [];
  const serializer = DOMSerializer.fromSchema(view.state.schema);
  view.state.doc.descendants((node, position) => {
    if (!["doc", "heading", "paragraph", "text", "hardBreak"].includes(node.type.name) || node.marks.some(mark => mark.type.name === "note"))
      throw Error(`Typography proof does not support ${node.type.name} or its marks at ${position}`);
  });
  view.state.doc.descendants((node, position) => {
    if (!node.isTextblock) return;
    const dom = view.nodeDOM(position);
    if (!(dom instanceof HTMLElement)) throw Error(`Missing block at ${position}`);
    const style = getComputedStyle(dom), groups: LineRange[] = [];
    const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode())) {
      if (!(text instanceof Text) || text.parentElement?.closest(editorNonContentSelector)) continue;
      for (let offset = 0; offset < text.length; offset++) {
        const range = document.createRange();
        range.setStart(text, offset);range.setEnd(text, offset + 1);
        const box = range.getBoundingClientRect();
        if (!box.height) continue;
        const from = view.posAtDOM(text, offset), previous = groups[groups.length - 1];
        if (previous && Math.min(previous.bottom, box.bottom) - Math.max(previous.top, box.top) > Math.min(previous.bottom - previous.top, box.height) / 2) {
          previous.end = { node: text, offset: offset + 1 };
          previous.to = from + 1;
          previous.top = Math.min(previous.top, box.top);previous.bottom = Math.max(previous.bottom, box.bottom);
        } else groups.push({ start: { node: text, offset }, end: { node: text, offset: offset + 1 }, from, to: from + 1, top: box.top, bottom: box.bottom });
      }
    }
    for (const [index, group] of groups.entries()) {
      const range = document.createRange();
      range.setStart(group.start.node, group.start.offset);range.setEnd(group.end.node, group.end.offset);
      const box = range.getBoundingClientRect(), content = document.createElement("div");
      content.append(serializer.serializeFragment(node.slice(group.from - position - 1, group.to - position - 1).content));
      content.querySelectorAll(editorNonContentSelector).forEach(node => node.remove());
      const top = (box.top - origin.top) / scale, page = Math.floor(top / geometry.stride);
      lines.push(Object.freeze({
        from: group.from, to: group.to, page: page + 1,
        x: (box.left - origin.left) / scale, y: top - page * geometry.stride,
        width: box.width / scale, height: box.height / scale,
        ending: view.state.doc.nodeAt(group.to)?.type.name === "hardBreak" ? "hard" : index === groups.length - 1 ? "paragraph" : "soft",
        html: content.innerHTML, tag: dom.tagName.toLowerCase(),
        typography: Object.freeze(Object.fromEntries([
          "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "fontVariant",
          "fontFeatureSettings", "fontKerning", "fontVariationSettings", "letterSpacing", "wordSpacing", "textTransform",
        ].map(key => [key, style[key as keyof CSSStyleDeclaration] as string]))),
        direction: style.direction, whiteSpace: style.whiteSpace, align: style.textAlign,
      }));
    }
    return false;
  });
  return Object.freeze(lines);
}

/** Owns only the experimental projection DOM; never edits the source or replans. */
export class LineProjection {
  readonly output = document.createElement("main");

  constructor(lines: readonly MeasuredTextLine[], geometry: PaginationGeometry) {
    this.output.className = "editor-pdf-pages";
    this.output.style.cssText = "position:absolute;left:-100000px;top:0";
    for (let page = 1; page <= Math.max(...lines.map(line => line.page)); page++) {
      const paper = document.createElement("div"), content = document.createElement("div");
      paper.className = "editor-page-fragment";
      paper.style.cssText = `position:relative;box-sizing:border-box;width:${geometry.width}px;height:${geometry.height}px;padding:0`;
      content.className = "tiptap ProseMirror";
      content.style.cssText = "position:static;margin:0;padding:0";
      for (const line of lines.filter(line => line.page === page)) {
        const node = document.createElement(line.tag);
        node.dataset.proofLineFrom = String(line.from);node.dataset.proofLineTo = String(line.to);
        node.innerHTML = line.html;
        Object.assign(node.style, {
          ...line.typography,
          position: "absolute", boxSizing: "content-box", margin: "0", padding: "0", border: "0", textIndent: "0",
          left: `${line.x}px`, top: `${line.y}px`, width: `${line.width}px`, height: `${line.height}px`,
          lineHeight: `${line.height}px`, direction: line.direction,
          whiteSpace: ["pre", "pre-wrap", "break-spaces"].includes(line.whiteSpace) ? "pre" : "nowrap",
          textAlign: line.align, textAlignLast: line.ending === "soft" && line.align === "justify" ? "justify" : "auto",
        });
        content.append(node);
      }
      paper.append(content);this.output.append(paper);
    }
    document.body.append(this.output);
  }

  destroy() { this.output.remove(); }
}

/** Context-preserving clipping experiment. Full copies are not a production memory design. */
export class ContextProjection {
  readonly output = document.createElement("main");

  constructor(view: EditorView, geometry: PaginationGeometry, pages: number) {
    const source = view.dom.closest<HTMLElement>(".page");
    if (!source) throw Error("Missing context reference");
    const origin = source.getBoundingClientRect(), scale = origin.width / geometry.width;
    const anchors = new Map<string, number>();
    for (const node of source.querySelectorAll<HTMLElement>("[id]")) {
      if (node.closest("[data-editor-ui],.editor-pagination-sheets")) continue;
      if (anchors.has(node.id)) throw Error(`Duplicate canonical context anchor: ${node.id}`);
      const bounds = node.getBoundingClientRect();
      const page = Math.floor((bounds.top - origin.top) / scale / geometry.stride);
      if (page < 0 || page >= pages) throw Error(`Context anchor is outside its plan: ${node.id}`);
      anchors.set(node.id, page);
    }
    this.output.className = "editor-pdf-pages";
    this.output.style.cssText = "position:absolute;left:-100000px;top:0";
    document.body.append(this.output);
    try {
      for (let index = 0; index < pages; index++) {
        const paper = document.createElement("div"), context = source.cloneNode(true) as HTMLElement;
        paper.className = "editor-page-fragment";
        paper.style.cssText = `position:relative;overflow:hidden;box-sizing:border-box;width:${geometry.width}px;height:${geometry.height}px;padding:0`;
        Object.assign(context.style, { position: "absolute", left: "0", top: `${-index * geometry.stride}px`, margin: "0", transform: "none", zoom: "1" });
        context.querySelectorAll('[data-editor-ui],img.ProseMirror-separator,.editor-pagination-sheets > :not(.editor-pagination-furniture)').forEach(node => node.remove());
        for (const node of context.querySelectorAll("[id]"))
          if (anchors.get(node.id) !== index) node.removeAttribute("id");
        paper.append(context);this.output.append(paper);
        const content = context.querySelector<HTMLElement>(".tiptap");
        if (!content) throw Error("Missing copied text context");
        freezeReadOnlyPresentation(content);
      }
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  destroy() { this.output.remove(); }
}
