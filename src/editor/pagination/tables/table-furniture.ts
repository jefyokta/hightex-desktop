import type { LayoutSnapshot } from "../measurement/layout-snapshot";
import type { TableSource } from "./table-source";
import { copyTableColumns } from "../../extensions/table/columns";
import {
  clearPaginationPresentation,
  editorNonContentSelector,
} from "../presentation/decorations";
import { retainFirstVisualLine } from "../flow/visual-line";
import type { FlowCache, FurnitureMeasurement } from "../flow/text-flow";

/** Measure continuation furniture once, before adding row gaps. */
export function tableFurniture(
  snapshot: LayoutSnapshot,
  source: TableSource,
  availableHeight: number,
  cache: FlowCache,
): FurnitureMeasurement {
  const { table, rows, headerCount, figure } = source;
  const { repeatTableHeader, repeatTableCaption } = snapshot.geometry;
  const caption = figure?.querySelector<HTMLElement>("figcaption");
  const bounds = table.getBoundingClientRect(),
    captionBounds = caption?.getBoundingClientRect();
  const key = JSON.stringify([
    bounds.width,
    table.dataset.type,
    getComputedStyle(table).font,
    captionBounds?.width,
    captionBounds && captionBounds.left - bounds.left,
    caption?.dataset.label,
    caption?.textContent,
    caption && getComputedStyle(caption).font,
    headerCount,
    availableHeight,
    repeatTableHeader,
    repeatTableCaption,
  ]);
  const cached = cache.getFurniture(source.node, key);
  if (cached) return cached;
  const furniture = document.createElement("figure");
  furniture.dataset.type = "figureTable";
  furniture.className = "tiptap ProseMirror editor-pagination-repeat";
  furniture.style.cssText = `position:absolute;left:0;top:0;margin:0;width:${bounds.width}px`;
  if (caption && repeatTableCaption) {
    const copy = caption.cloneNode(true) as HTMLElement;
    copy.classList.add("editor-pagination-repeat-caption");
    copy.style.position = "relative";
    // A caption can be wider than a narrow table. Keep its measured width
    // instead of wrapping it to the continuation table's width and reserving
    // a different header height from the original.
    copy.style.setProperty("width", `${captionBounds!.width}px`, "important");
    copy.style.maxWidth = "none";
    copy.style.left = `${captionBounds!.left - bounds.left}px`;
    furniture.append(copy);
  }
  if (headerCount && repeatTableHeader) {
    const headerTable = table.cloneNode(false) as HTMLTableElement;
    headerTable.style.width = `${bounds.width}px`;
    const columns = table.querySelector("colgroup");
    if (columns) headerTable.append(copyTableColumns(columns));
    const body = document.createElement("tbody");
    for (const row of rows.slice(0, headerCount))
      body.append(row.element.cloneNode(true));
    headerTable.append(body);
    furniture.append(headerTable);
  }
  furniture
    .querySelectorAll(editorNonContentSelector)
    .forEach((node) => node.remove());
  furniture.querySelectorAll<HTMLElement>("*").forEach((element) => {
    // Gaps belong to source pages; fitted atom sizes still belong to content.
    clearPaginationPresentation(element, true);
    element.removeAttribute("id");
  });
  snapshot.host.append(furniture);
  try {
    const compact = furniture.getBoundingClientRect().height > availableHeight;
    if (compact) {
      const copyCaption = furniture.querySelector<HTMLElement>("figcaption");
      if (copyCaption) retainFirstVisualLine(copyCaption);
      // Only direct header cells: a nested grid belongs to that cell's first line.
      const header = furniture.querySelector("table");
      for (const row of header?.rows ?? [])
        for (const cell of row.cells) retainFirstVisualLine(cell);
    }
    const result = {
      height: furniture.getBoundingClientRect().height,
      html: furniture.childElementCount ? furniture.outerHTML : "",
      compact,
    };
    cache.setFurniture(source.node, key, result);
    return result;
  } finally {
    furniture.remove();
  }
}
