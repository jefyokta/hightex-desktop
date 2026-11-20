/** Recorded boxes and text lines, relative to each sheet. No page planning. */
export function editorPDFPresentation(root: Element): EditorPDFRect[][] {
  return Array.from(root.children, (page) => {
    const boxes: EditorPDFRect[] = [];
    visitPresentation(page, (box) => boxes.push(box));
    return boxes;
  });
}

/** Verify reconstructed HTML once after resources load, before the host reports ready. */
export function assertEditorPDFPresentation(
  root: Element,
  expected: EditorPDFRect[][],
) {
  if (root.children.length !== expected.length)
    throw Error(
      `Editor PDF presentation: expected ${expected.length} surfaces, found ${root.children.length}`,
    );
  for (const [index, page] of Array.from(root.children).entries()) {
    let offset = 0;
    visitPresentation(page, (box, node) => {
      const recorded = expected[index][offset];
      const path = `presentation[${index}][${offset}]`;
      if (!recorded)
        throw Error(
          `Editor PDF presentation changed after capture at ${path}: unexpected box for ${describeNode(node)}`,
        );
      if (
        box.some(
          (value, dimension) => Math.abs(value - recorded[dimension]) > 0.75,
        )
      )
        throw Error(
          `Editor PDF presentation changed after capture at ${path}, ${describeNode(node)}: expected [${recorded.join(", ")}], measured [${box.join(", ")}] (x, y, width, height in px)`,
        );
      offset++;
    });
    if (offset !== expected[index].length)
      throw Error(
        `Editor PDF presentation[${index}]: expected ${expected[index].length} boxes, measured ${offset}`,
      );
  }
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

function describeNode(node: Node) {
  const element = node instanceof Element ? node : node.parentElement;
  const owner = element?.closest("[data-image-id],[id]");
  const id = owner?.id ? ` #${owner.id}` : "";
  const asset = owner?.getAttribute("data-image-id");
  const text =
    node instanceof Text
      ? ` text ${JSON.stringify(node.data.slice(0, 80))}`
      : "";
  return `<${element?.localName ?? "unknown"}>${id}${asset ? ` asset ${asset}` : ""}${text}`;
}
