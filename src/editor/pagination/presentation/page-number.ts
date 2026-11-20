import type { PaginationGeometry } from "../options";
import type { PageNumberPosition } from "@/types/pagination/section-options";
export type { PageNumberPosition } from "@/types/pagination/section-options";

export const PAGE_NUMBER_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
type PageNumberGroup = "introduction" | "chapters" | "appendix";
export type PageNumberOptions = Partial<
  Record<PageNumberGroup, PageNumberPosition>
>;

export function pageNumberPosition(value: unknown): PageNumberPosition {
  for (const position of PAGE_NUMBER_POSITIONS)
    if (value === position) return position;
  throw RangeError(`Invalid page number position: ${String(value)}`);
}

/** Current category defaults; placement does not change page breaks or labels. */
export function pageNumberOptions(options: PageNumberOptions = {}) {
  const result = {
    introduction: options.introduction ?? "bottom-center",
    chapters: options.chapters ?? "bottom-right",
    appendix: options.appendix ?? "bottom-right",
  } satisfies Record<PageNumberGroup, PageNumberPosition>;
  for (const position of Object.values(result)) pageNumberPosition(position);
  return result;
}

/** Coordinates are relative to the physical paper, including asymmetric margins. */
export function pageNumberStyle(
  geometry: Pick<PaginationGeometry, "width" | "height" | "margins">,
  position: PageNumberPosition,
  top = 0,
) {
  const [vertical, horizontal] = position.split("-");
  return {
    top: `${top + (vertical === "top" ? geometry.margins.top / 2 : geometry.height - geometry.margins.bottom / 2)}px`,
    left:
      horizontal === "left"
        ? `${geometry.margins.left}px`
        : horizontal === "center"
          ? `${geometry.width / 2}px`
          : "auto",
    right: horizontal === "right" ? `${geometry.margins.right}px` : "auto",
    transform: horizontal === "center" ? "translateX(-50%)" : "none",
  };
}
