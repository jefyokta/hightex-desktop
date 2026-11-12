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
  breakBefore?: boolean;
  keepWithNext?: boolean;
  group?: number;
  lineIndex?: number;
  lineCount?: number;
  anchor?: { from: number; to: number; top: number; marginTop: number };
}

export interface PageBreak extends LayoutUnit {
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
export function paginateUnits(units: LayoutUnit[]): PageLayout {
  const contentHeight = EDITOR_PAGE.height - 2 * EDITOR_PAGE.margin;
  const stride = EDITOR_PAGE.height + EDITOR_PAGE.gap;
  const breaks: PageBreak[] = [];
  let page = Math.max(0, Math.floor((units[0]?.top ?? 0) / stride));
  let shift = 0;
  let fragmentStart = 0;
  let steps = 0;
  for (let index = 0; index < units.length; index++) {
    if (++steps > units.length * 3 + 32)
      throw Error("Paragraph pagination did not converge");
    let unit = units[index];
    if (
      !Number.isFinite(unit.top) ||
      !Number.isFinite(unit.bottom) ||
      unit.bottom < unit.top ||
      unit.bottom - unit.top > contentHeight + 1
    ) {
      throw RangeError("An editor content unit cannot fit a page");
    }
    let following = index;
    while (units[following].keepWithNext && following < units.length - 1)
      following++;
    // A heading and one line must not strand the heading when the paragraph's
    // two-line minimum subsequently moves that line to the next page.
    if (unit.keepWithNext && units[following].lineIndex === 0 &&
        units[following + 1]?.group === units[following].group &&
        units[following + 1]?.lineIndex === 1) following++;
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
          const fitsWhole = units[groupEnd].bottom - units[groupStart].top <= contentHeight;
          const fitsStart = units[groupStart + 1].bottom - units[groupStart].top <= contentHeight;
          if ((unit.lineCount! <= 3 && fitsWhole) ||
              (chosen - groupStart < 2 && fitsStart)) chosen = groupStart;
        }
        if (chosen < index) {
          index = chosen;
          unit = units[index];
        }
      }
      const anchor = unit.lineIndex === 0 ? unit.anchor : undefined;
      // A first-line atom can paint above its paragraph/list-item box. Moving
      // that box to the page edge alone would leave the atom under the margin.
      const top = anchor ? Math.min(anchor.top, unit.top) : unit.top;
      const height = (page + 1) * stride - (top + shift);
      if (height <= 0) {
        page = Math.max(page + 1, Math.floor((unit.top + shift) / stride));
        index--;
        continue;
      }
      if (height > 0) {
        breaks.push(
          anchor
            ? { ...unit, ...anchor, top, kind: "block", height }
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
