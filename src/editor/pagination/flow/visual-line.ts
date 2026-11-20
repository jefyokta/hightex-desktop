/** Last UTF-16 position on this rendered line; keeps browser shaping authoritative. */
export function visualLineEnd(
  start: number,
  length: number,
  at: (offset: number) => DOMRect,
  first: DOMRect,
  lineHeight: number,
) {
  let low = start,
    high = length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (
      Math.abs(at(middle).top - first.top) <
      Math.min(first.height, lineHeight) / 2
    )
      low = middle;
    else high = middle - 1;
  }
  return low + 1;
}

/** Trim only a derived continuation clone; preserve marks and whole inline atoms. */
export function retainFirstVisualLine(element: HTMLElement) {
  const doc = element.ownerDocument;
  const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 24;
  let first: DOMRect | undefined;
  let cutoff: { node: Node; offset: number } | undefined;
  const sameLine = (rect: DOMRect) => {
    first ??= rect;
    return Math.min(first.bottom, rect.bottom) > Math.max(first.top, rect.top);
  };
  const visit = (node: Node): boolean => {
    if (node instanceof Text && node.length) {
      const range = doc.createRange();
      const at = (offset: number) => {
        range.setStart(node, offset);
        range.setEnd(node, offset + 1);
        return range.getBoundingClientRect();
      };
      const rect = at(0);
      if (!rect.height) return true;
      if (!sameLine(rect)) {
        cutoff = { node, offset: 0 };
        return false;
      }
      const end = visualLineEnd(0, node.length, at, rect, lineHeight);
      if (end < node.length) {
        cutoff = { node, offset: end };
        return false;
      }
    } else if (node instanceof HTMLElement) {
      // KaTeX and resolved inline components are opaque presentation atoms.
      if (
        node.matches(
          '[contenteditable="false"],.katex,img,svg,[data-type="mathInline"]',
        )
      ) {
        const rect = node.getBoundingClientRect();
        if (rect.height && !sameLine(rect)) {
          cutoff = {
            node: node.parentNode!,
            offset: Array.prototype.indexOf.call(
              node.parentNode!.childNodes,
              node,
            ),
          };
          return false;
        }
      } else {
        if (node.tagName === "BR") {
          cutoff = {
            node: node.parentNode!,
            offset: Array.prototype.indexOf.call(
              node.parentNode!.childNodes,
              node,
            ),
          };
          return false;
        }
        for (const child of node.childNodes) if (!visit(child)) return false;
      }
    }
    return true;
  };
  visit(element);
  if (cutoff) {
    const range = doc.createRange();
    range.setStart(cutoff.node, cutoff.offset);
    range.setEnd(element, element.childNodes.length);
    range.deleteContents();
  }
}
