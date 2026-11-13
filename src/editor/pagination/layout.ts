import { DEFAULT_PAGINATION, type PaginationGeometry } from "./options";
// Default geometry retained for callers displaying the standard A4 layout.
export const EDITOR_PAGE = {
  width: DEFAULT_PAGINATION.width,
  height: DEFAULT_PAGINATION.height,
  margin: DEFAULT_PAGINATION.margins.top,
  gap: DEFAULT_PAGINATION.gap,
};

export interface LayoutUnit {
  from: number;
  to?: number;
  top: number;
  bottom: number;
  kind: "line" | "block";
  marginTop?: number;
  breakBefore?: boolean;
  keepWithNext?: boolean;
  group?: number;
  lineIndex?: number;
  lineCount?: number;
  anchor?: { from: number; to: number; top: number; marginTop: number };
}

export interface PageBreak extends LayoutUnit {
  // Desired displacement during planning; the measured block margin is
  // calibrated before the final layout is passed to the live decorations.
  height: number;
}

export interface PageLayout {
  breaks: PageBreak[];
  pages: number;
  rows?: { from: number; to: number; height: number }[];
  scales?: { from: number; to: number; scale: number }[];
  furniture?: { top: number; left: number; width: number; html: string }[];
  error?: boolean;
}

/** Derived presentation only: positions refer to the unchanged editor document. */
export function paginateUnits(units: LayoutUnit[], geometry: PaginationGeometry = DEFAULT_PAGINATION): PageLayout {
  const { contentHeight, stride } = geometry;
  const breaks: PageBreak[] = [];
  let page = Math.max(0, Math.floor((units[0]?.top ?? 0) / stride));
  let shift = 0;
  let fragmentStart = 0;
  let steps = 0;
  for (let index = 0; index < units.length; index++) {
    if (++steps > units.length * 3 + 32)
      throw Error("Paragraph pagination did not converge");
    let unit = units[index];
    const unitHeight = unit.bottom - unit.top;
    if (
      !Number.isFinite(unit.top) ||
      !Number.isFinite(unit.bottom) ||
      unit.bottom < unit.top ||
      unitHeight > contentHeight + 1
    ) {
      throw RangeError("An editor content unit cannot fit a page");
    }
    let following = index;
    while (units[following].keepWithNext && following < units.length - 1)
      following++;
    // Match the paragraph planner's minimum: short paragraphs move whole,
    // while longer paragraphs keep at least two opening lines. Otherwise a
    // later paragraph break can strand a heading that initially fit.
    const first = units[following];
    if (unit.keepWithNext && first.lineIndex === 0) {
      const last = units[following + first.lineCount! - 1];
      const minimum = first.lineCount! <= 3 &&
        last?.group === first.group && last.bottom - first.top <= contentHeight
        ? first.lineCount!
        : 2;
      for (let offset = 1; offset < minimum; offset++) {
        if (units[following + 1]?.group !== first.group ||
            units[following + 1]?.lineIndex !== offset) break;
        following++;
      }
    }
    const next = units[following];
    const bottom =
      unit.keepWithNext && next.bottom - unit.top <= contentHeight
        ? next.bottom
        : unit.bottom;
    if ((unit.breakBefore && unit.top + shift > page * stride + 0.5) ||
        bottom + shift > page * stride + contentHeight + 0.5) {
      // Keep at least two lines on either side of a paragraph break when
      // possible, using actual line boxes rather than a guessed line height.
      if (!unit.breakBefore && unit.group !== undefined && unit.lineCount! >= 2) {
        let chosen = index;
        if (unit.lineCount! >= 4 && unit.lineCount! - unit.lineIndex! === 1 && index > fragmentStart)
          chosen--;
        const groupStart = index - unit.lineIndex!;
        if (groupStart >= fragmentStart) {
          const groupEnd = groupStart + unit.lineCount! - 1;
          const fitsWhole =
            units[groupEnd].bottom - units[groupStart].top <=
            contentHeight;
          const fitsStart =
            units[groupStart + 1].bottom - units[groupStart].top <=
            contentHeight;
          if ((unit.lineCount! <= 3 && fitsWhole) ||
              (chosen - groupStart < 2 && fitsStart)) chosen = groupStart;
        }
        if (chosen < index) {
          index = chosen;
          unit = units[index];
        }
      }
      const anchor = unit.lineIndex === 0 ? unit.anchor : undefined;
      const height = (page + 1) * stride - (unit.top + shift);
      if (height <= 0) {
        page = Math.max(page + 1, Math.floor((unit.top + shift) / stride));
        index--;
        continue;
      }
      if (height > 0) {
        breaks.push(
          anchor
            ? { ...unit, ...anchor, top: unit.top, kind: "block", height }
            : { ...unit, height },
        );
        shift += height;
        page++;
        fragmentStart = index;
      }
    }
  }
  return { breaks, pages: page + 1 };
}
