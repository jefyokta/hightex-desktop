import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { EDITOR_PAGE, type LayoutUnit } from "./layout";

/** Copy rendered node views without mounting another editor or its autosave. */
function copyDOM(node: Node, mapping: Map<Node, Node>): Node | null {
  if (node instanceof Element && node.hasAttribute("data-editor-page-break"))
    return null;
  const clone = node.cloneNode(false);
  mapping.set(node, clone);
  if (clone instanceof HTMLElement) {
    clone.removeAttribute("id");
    clone.removeAttribute("contenteditable");
    clone.classList.remove("editor-pagination-block");
  }
  if (node instanceof HTMLImageElement && clone instanceof HTMLImageElement) {
    // The hidden copy must use the loaded view's intrinsic geometry immediately,
    // without waiting for a second image load/decoding task.
    clone.style.width = `${node.offsetWidth}px`;
    clone.style.height = `${node.offsetHeight}px`;
  }
  for (const child of node.childNodes) {
    const copy = copyDOM(child, mapping);
    if (copy) clone.appendChild(copy);
  }
  return clone;
}

function paragraphLines(
  view: EditorView,
  node: PMNode,
  pos: number,
  element: HTMLElement,
  mapping: Map<Node, Node>,
  origin: number,
): LayoutUnit[] {
  const rect = element.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 24;
  const lines = new Map<number, number>();
  const remember = (from: number, top: number) => {
    const line = Math.max(0, Math.round((top - rect.top) / lineHeight));
    if (!lines.has(line) || from < lines.get(line)!) lines.set(line, from);
  };
  const original = view.nodeDOM(pos);
  if (original) {
    const walker = document.createTreeWalker(original, NodeFilter.SHOW_TEXT);
    let rendered: Node | null;
    while ((rendered = walker.nextNode())) {
      if (
        rendered.parentElement?.closest(
          '[data-editor-page-break], [contenteditable="false"]',
        )
      )
        continue;
      // Widgets split one model text node into several DOM text nodes. Read
      // each rendered run and map its position back to the model individually.
      const text = mapping.get(rendered);
      if (!(text instanceof Text) || !text.length) continue;
      const from = view.posAtDOM(rendered, 0);
      const length = text.length;
      const range = element.ownerDocument.createRange();
      const at = (offset: number) => {
        range.setStart(text, offset);
        range.setEnd(text, offset + 1);
        return range.getBoundingClientRect();
      };
      let cursor = 0;
      while (cursor < length) {
        const first = at(cursor);
        remember(from + cursor, first.top);
        // Locate the next visual line with logarithmic range measurements,
        // rather than reading one rectangle for every character in the chapter.
        let low = cursor;
        let high = length - 1;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (Math.abs(at(middle).top - first.top) < lineHeight / 2)
            low = middle;
          else high = middle - 1;
        }
        cursor = low + 1;
      }
    }
  }
  node.descendants((child, offset) => {
    const from = pos + 1 + offset;
    if (child.isText) return false;
    if (child.isAtom || child.type.name === "hardBreak") {
      const dom = view.nodeDOM(from);
      const copy = dom && mapping.get(dom);
      if (copy instanceof Element)
        remember(from, copy.getBoundingClientRect().top);
      return false;
    }
    return true;
  });
  if (!lines.size) lines.set(0, pos + 1);
  if (
    Math.abs((Math.max(...lines.keys()) + 1) * lineHeight - rect.height) > 2
  ) {
    // Tall inline math or unusual node views may enlarge individual line boxes.
    // Keep such a paragraph together until variable-height line breaking is
    // supported; a paragraph taller than a page triggers the normal fallback.
    return [
      {
        from: pos,
        to: pos + node.nodeSize,
        top: rect.top - origin,
        bottom: rect.bottom - origin,
        marginTop: parseFloat(getComputedStyle(element).marginTop) || 0,
        kind: "block",
      },
    ];
  }
  return [...lines]
    .sort(([a], [b]) => a - b)
    .map(([line, from]) => ({
      from,
      top: rect.top - origin + line * lineHeight,
      bottom: rect.top - origin + (line + 1) * lineHeight,
      kind: "line",
    }));
}

export function measureEditor(view: EditorView): LayoutUnit[] | null {
  const page = view.dom.closest<HTMLElement>(".page");
  if (!page || !view.dom.isConnected || !view.dom.getBoundingClientRect().width)
    return null;
  const mapping = new Map<Node, Node>();
  const root = copyDOM(view.dom, mapping) as HTMLElement;
  const host = page.cloneNode(false) as HTMLElement;
  host.removeAttribute("id");
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("data-pagination-measure", "");
  host.inert = true;
  host.style.cssText =
    "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;contain:layout style;";
  host.style.setProperty(
    "--start-counter",
    getComputedStyle(page).getPropertyValue("--start-counter"),
  );
  const wrapper = document.createElement("div");
  wrapper.append(root);
  host.append(wrapper);
  document.body.append(host);
  try {
    const origin = host.getBoundingClientRect().top + EDITOR_PAGE.margin;
    const units: LayoutUnit[] = [];
    view.state.doc.forEach((node, pos) => {
      const dom = view.nodeDOM(pos);
      const element = dom && mapping.get(dom);
      if (!(element instanceof HTMLElement)) return;
      if (node.type.name === "paragraph") {
        units.push(
          ...paragraphLines(view, node, pos, element, mapping, origin),
        );
      } else {
        const rect = element.getBoundingClientRect();
        units.push({
          from: pos,
          to: pos + node.nodeSize,
          top: rect.top - origin,
          bottom: rect.bottom - origin,
          marginTop: parseFloat(getComputedStyle(element).marginTop) || 0,
          kind: "block",
          keepWithNext: node.type.name === "heading",
        });
      }
    });
    return units;
  } finally {
    host.remove();
  }
}
