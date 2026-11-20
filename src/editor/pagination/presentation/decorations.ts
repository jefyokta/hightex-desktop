import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { SectionLayoutEffects } from "../../../../shared/section-layout";
import type { Node as ModelNode } from "@tiptap/pm/model";
import type { PaginationGeometry } from "../options";
import { pageNumberStyle, type PageNumberPosition } from "./page-number";
import { imageWidth } from "../../extensions/image/size";

export function paginationPageNumber(
  label: string,
  geometry: PaginationGeometry,
  top = 0,
  position: PageNumberPosition = geometry.pageNumber ??
    geometry.pageNumbers.chapters,
) {
  const number = document.createElement("span");
  number.className = "editor-pagination-number";
  number.textContent = label;
  number.dataset.position = position;
  Object.assign(number.style, pageNumberStyle(geometry, position, top));
  return number;
}

/** Editor controls and layout widgets have no authored or printable content. */
export const editorNonContentSelector =
  "[data-editor-ui],[data-editor-page-break],img.ProseMirror-separator";

/** The same gap presentation for authored text and generated template text. */
export function paginationSpacer(height: number) {
  const spacer = document.createElement("span");
  spacer.setAttribute("data-editor-page-break", "");
  spacer.setAttribute("aria-hidden", "true");
  spacer.contentEditable = "false";
  spacer.textContent = "\u2060";
  spacer.style.height = `${height}px`;
  return spacer;
}

const atomicPresentation = [
  ["editor-pagination-scaled", "--editor-atom-scale"],
  ["editor-pagination-image", "--editor-image-width"],
] as const;

/** Images resize their pixels; zooming a responsive wrapper changes its layout width. */
export function paginationScaleAttributes(
  node: ModelNode | null,
  scale: number,
) {
  return node?.type.name === "image"
    ? {
        class: "editor-pagination-image",
        style: `--editor-image-width:${imageWidth(node.attrs.width) * scale}px`,
      }
    : {
        class: "editor-pagination-scaled",
        style: `--editor-atom-scale:${scale}`,
      };
}

/** Remove derived layout effects when measuring or materializing source fragments. */
export function clearPaginationPresentation(
  element: HTMLElement,
  preserveScale = false,
) {
  if (element.className.includes("editor-pagination-"))
    element.classList.remove(
      "editor-pagination-block",
      "editor-pagination-row",
      ...(preserveScale
        ? []
        : atomicPresentation.map(([className]) => className)),
    );
  if (element.style.length)
    for (const property of [
      "--editor-row-height",
      "--editor-break-height",
      "--editor-original-margin",
      ...(preserveScale
        ? []
        : atomicPresentation.map(([, property]) => property)),
    ])
      element.style.removeProperty(property);
}

/** Table continuation content is painted from the plan, never planned here. */
export function paginationFurniture(
  items: NonNullable<SectionLayoutEffects["furniture"]>,
) {
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const furniture = document.createElement("div");
    furniture.className = "tiptap ProseMirror editor-pagination-furniture";
    furniture.style.cssText = `top:${item.top}px;left:${item.left}px;width:${item.width}px`;
    furniture.innerHTML = item.html;
    furniture
      .querySelectorAll(editorNonContentSelector)
      .forEach((node) => node.remove());
    fragment.append(furniture);
  }
  return fragment;
}

/** Apply a recorded page plan; this function never measures or chooses breaks. */
export function paginationDecorations(
  viewDoc: Parameters<typeof DecorationSet.create>[0],
  layout: SectionLayoutEffects,
) {
  return DecorationSet.create(viewDoc, [
    ...(layout.anchors ?? []).map((item) =>
      Decoration.node(item.from, item.to, { id: item.id }),
    ),
    ...layout.breaks.map((item) =>
      item.kind === "block"
        ? Decoration.node(
            item.from,
            item.to!,
            {
              class: "editor-pagination-block",
              style: `--editor-break-height:${item.height}px;--editor-original-margin:${item.marginTop ?? 0}px`,
            },
            { paginationBreak: true },
          )
        : Decoration.widget(item.from, () => paginationSpacer(item.height), {
            side: -1,
            key: `${item.from}:${item.height}`,
            ignoreSelection: true,
            paginationBreak: true,
          }),
    ),
    ...(layout.rows ?? []).map((row) =>
      Decoration.node(row.from, row.to, {
        class: "editor-pagination-row",
        style: `--editor-row-height:${row.height}px`,
      }),
    ),
    ...(layout.scales ?? []).map((item) =>
      Decoration.node(
        item.from,
        item.to,
        paginationScaleAttributes(viewDoc.nodeAt(item.from), item.scale),
      ),
    ),
  ]);
}
