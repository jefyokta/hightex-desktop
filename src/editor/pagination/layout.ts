// CSS pixels at the browser's standard 96 dpi. These match the current A4 PDF
// layout (30 mm margins); zoom scales the finished editor, not these values.
const mm = (value: number) => (value * 96) / 25.4;
export const EDITOR_PAGE = {
  width: mm(210),
  height: mm(297),
  margin: mm(30),
  gap: 24,
};

export interface LayoutUnit {
  from: number;
  to?: number;
  top: number;
  bottom: number;
  kind: "line" | "block";
  marginTop?: number;
  keepWithNext?: boolean;
}

export interface PageBreak extends LayoutUnit {
  height: number;
}

export interface PageLayout {
  breaks: PageBreak[];
  pages: number;
  unsupported: boolean;
}

/** Derived presentation only: positions refer to the unchanged editor document. */
export function paginateUnits(units: LayoutUnit[]): PageLayout {
  const contentHeight = EDITOR_PAGE.height - 2 * EDITOR_PAGE.margin;
  const stride = EDITOR_PAGE.height + EDITOR_PAGE.gap;
  const breaks: PageBreak[] = [];
  let page = 0;
  let shift = 0;
  for (const [index, unit] of units.entries()) {
    if (
      !Number.isFinite(unit.top) ||
      !Number.isFinite(unit.bottom) ||
      unit.bottom - unit.top > contentHeight + 1
    ) {
      // A tall unsplittable table/list must stay fully visible. Fall back for
      // the chapter instead of presenting an apparently valid, clipped page.
      return { breaks: [], pages: 1, unsupported: true };
    }
    let following = index;
    while (units[following].keepWithNext && following < units.length - 1)
      following++;
    const next = units[following];
    const bottom =
      unit.keepWithNext && next.bottom - unit.top <= contentHeight
        ? next.bottom
        : unit.bottom;
    if (bottom + shift > page * stride + contentHeight + 0.5) {
      const height = (page + 1) * stride - (unit.top + shift);
      if (height > 0) {
        breaks.push({ ...unit, height });
        shift += height;
        page++;
      }
    }
  }
  return { breaks, pages: page + 1, unsupported: false };
}
