import { DOMSerializer, type Node as ModelNode } from "@tiptap/pm/model";
import type { EditorView, NodeViewConstructor } from "@tiptap/pm/view";
import { chapterContentNodeViews } from "../../src/editor/chapter/content-node-views";
import { copyTableColumns } from "../../src/editor/extensions/table/columns";
import { clearPaginationPresentation } from "../../src/editor/pagination/presentation/decorations";

/** Historical projector diagnostic only. Production never captures active NodeView wrappers. */
export function capturedChapterNodeViews(source: ModelNode,
  presentation: Pick<EditorView, "state" | "nodeDOM" | "dom">, ownerDocument: Document) {
    if (presentation && presentation.state.doc !== source)
      throw Error("Cannot capture presentation from another source revision");
    const paper = presentation?.dom.closest<HTMLElement>(".page");
    const scale = paper
      ? paper.getBoundingClientRect().width /
        parseFloat(getComputedStyle(paper).width)
      : 1;
    if (!Number.isFinite(scale) || scale <= 0)
      throw Error("Source presentation is not mounted");
    const containers = new Map<number, HTMLElement[]>();
    const columns = new Map<number, HTMLElement>();
    const tableWidths = new Map<number, number>();
    if (presentation)
      source.descendants((node, position) => {
        if (
          ![
            "listItem",
            "imageFigure",
            "figureTable",
            "image",
            "table",
            "cite",
            "codeBlock",
          ].includes(node.type.name)
        )
          return;
        const dom = presentation.nodeDOM(position);
        if (!(dom instanceof HTMLElement))
          throw Error("Missing source container presentation");
        const target = dom.querySelector<HTMLElement>(
          node.type.name === "cite"
            ? "cite"
            : node.type.name === "image"
              ? "img"
              : node.type.name === "table"
                ? "tbody"
                : "[data-node-view-content-react]",
        );
        if (!target) return;
        const path: HTMLElement[] = [];
        let part: HTMLElement | null = target;
        while (part) {
          const copy = part.cloneNode(false) as HTMLElement;
          copy.removeAttribute("contenteditable");
          if (copy instanceof HTMLImageElement) copy.removeAttribute("src");
          clearPaginationPresentation(copy);
          path.unshift(copy);
          if (part === dom) break;
          part = part.parentElement;
        }
        if (part !== dom)
          throw Error("Container presentation left its source node");
        containers.set(position, path);
        if (node.type.name === "table") {
          const group = dom.querySelector("colgroup");
          const table =
            dom instanceof HTMLTableElement ? dom : dom.querySelector("table");
          if (table)
            tableWidths.set(
              position,
              table.getBoundingClientRect().width / scale,
            );
          if (group) columns.set(position, copyTableColumns(group, scale));
        }
      });
    const schemaViews = chapterContentNodeViews(source.type.schema, ownerDocument);
    const nodeViews: Record<string, NodeViewConstructor> = {};
    for (const [name, type] of Object.entries(source.type.schema.nodes)) {
      if (!type.spec.toDOM) continue;
      nodeViews[name] = (node, _view, getPos, decorations, innerDecorations) => {
        const position = getPos();
        const path = position === undefined ? undefined : containers.get(position);
        if (!path) return schemaViews[name](node, _view, getPos, decorations, innerDecorations);
        let { dom, contentDOM } = DOMSerializer.renderSpec(
          ownerDocument,
          type.spec.toDOM!(node),
        );
        if (path) {
          const copies = path.map(
            (part) => part.cloneNode(false) as HTMLElement,
          );
          const schemaDOM = dom as HTMLElement;
          const schemaElement = schemaDOM.querySelector("figure") ?? schemaDOM;
          const semantic = copies.find(
            (copy) => copy.tagName === schemaElement.tagName,
          );
          if (semantic) {
            for (const attribute of schemaElement.attributes) {
              if (attribute.name === "class")
                semantic.classList.add(
                  ...attribute.value.split(/\s+/).filter(Boolean),
                );
              else if (attribute.name === "style")
                semantic.style.cssText += `;${attribute.value}`;
              else semantic.setAttribute(attribute.name, attribute.value);
            }
          }
          copies.slice(1).forEach((part, index) => copies[index].append(part));
          const group =
            position === undefined ? undefined : columns.get(position);
          if (group)
            copies
              .find((copy) => copy instanceof HTMLTableElement)
              ?.prepend(group.cloneNode(true));
          const width =
            position === undefined ? undefined : tableWidths.get(position);
          const table = copies.find((copy) => copy instanceof HTMLTableElement);
          if (width && table) {
            table.style.width =
              table.style.minWidth =
              table.style.maxWidth =
                `${width}px`;
            table.style.tableLayout = "fixed";
          }
          dom = copies[0];
          contentDOM = node.isLeaf ? undefined : copies[copies.length - 1];
        }
        return {
          dom,
          contentDOM,
          // Context hydration changes atom contents and presentation attributes.
          ignoreMutation: (mutation) =>
            node.isAtom || mutation.type === "attributes",
        };
      };
    }
    return nodeViews;
}
