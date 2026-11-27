/** Recorded boxes and text lines, relative to each sheet. No page planning. */
export function editorPDFPresentation(root: Element): EditorPDFRect[][] {
  return Array.from(root.children, (page) => {
    const boxes: EditorPDFRect[] = [];
    visitPresentation(page, (box) => boxes.push(box));
    return boxes;
  });
}

function visitPresentation(
  page: Element,
  visit: (box: EditorPDFRect, node: Node) => void,
) {
  const origin = page.getBoundingClientRect();
  const add = (rect: DOMRect, node: Node) => {
    // Hidden boxes (e.g. accessible MathML) have no page-relative location.
    visit(
      !rect.width && !rect.height
        ? [0, 0, 0, 0]
        : [
            rect.left - origin.left,
            rect.top - origin.top,
            rect.width,
            rect.height,
          ],
      node,
    );
  };
  add(origin, page);
  const walker = page.ownerDocument.createTreeWalker(
    page,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node instanceof Element) {
      // Chromium may collapse a zero-width col's height during serialization.
      // Visible geometry belongs to the cells, text and table.
      if (!node.matches("col,colgroup"))
        add(node.getBoundingClientRect(), node);
    } else if (node instanceof Text && node.length) {
      const range = page.ownerDocument.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) add(rect, node);
    }
  }
}
