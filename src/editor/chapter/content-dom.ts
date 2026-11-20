import { DOMSerializer, type Node as ModelNode } from "@tiptap/pm/model";

/** Schema owns the content tree for both the editable view and canonical layout. */
export function chapterContentDOM(node: ModelNode, ownerDocument: Document) {
  return DOMSerializer.renderSpec(ownerDocument, node.type.spec.toDOM!(node));
}

/** Update schema attributes without touching ProseMirror's children or UI overlays. */
export function updateChapterContentDOM(
  current: ReturnType<typeof chapterContentDOM>,
  previous: ModelNode,
  node: ModelNode,
  ownerDocument: Document,
) {
  const before = chapterContentDOM(previous, ownerDocument);
  const next = chapterContentDOM(node, ownerDocument);
  const sync = (target: Node, old: Node, source: Node) => {
    if (
      target instanceof Element &&
      old instanceof Element &&
      source instanceof Element
    ) {
      for (const name of new Set([
        ...old.getAttributeNames(),
        ...source.getAttributeNames(),
      ])) {
        if (old.getAttribute(name) === source.getAttribute(name)) continue;
        if (name === "class") {
          old.classList.forEach((value) => target.classList.remove(value));
          source.classList.forEach((value) => target.classList.add(value));
        } else if (
          name === "style" &&
          target instanceof HTMLElement &&
          old instanceof HTMLElement &&
          source instanceof HTMLElement
        ) {
          for (const property of Array.from(old.style))
            target.style.removeProperty(property);
          for (const property of Array.from(source.style))
            target.style.setProperty(
              property,
              source.style.getPropertyValue(property),
            );
        } else if (source.hasAttribute(name))
          target.setAttribute(name, source.getAttribute(name)!);
        else target.removeAttribute(name);
      }
    }
    if (target === current.contentDOM) return;
    const children = Array.from(target.childNodes).filter(
      (child) =>
        !(
          child instanceof Element &&
          child.hasAttribute("data-editor-node-controls")
        ),
    );
    Array.from(source.childNodes).forEach((child, index) => {
      if (children[index] && old.childNodes[index])
        sync(children[index], old.childNodes[index], child);
    });
  };
  sync(current.dom, before.dom, next.dom);
}
