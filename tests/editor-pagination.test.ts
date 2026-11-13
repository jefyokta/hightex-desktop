import { expect, test } from "bun:test";
import { DEFAULT_PAGINATION, mergePaginationOptions, paginationGeometry } from "../src/editor/pagination/options";
import {
  EDITOR_PAGE,
  paginateUnits,
  type LayoutUnit,
} from "../src/editor/pagination/layout";

const contentHeight = EDITOR_PAGE.height - 2 * EDITOR_PAGE.margin;

test("asymmetric margins control the usable page area and planner", () => {
  const page = paginationGeometry({ margins: { top: 20, right: 25, bottom: 40, left: 35 } });
  expect(page.contentHeight).toBeCloseTo((297-60)*96/25.4);
  expect(page.contentWidth).toBeCloseTo(150*96/25.4);
  const small = paginationGeometry({ margins: { top: 60, bottom: 60 } });
  const units: LayoutUnit[] = [{from:1,top:0,bottom:24,kind:"line"},{from:2,top:700,bottom:724,kind:"line"}];
  expect(paginateUnits(units).pages).toBe(1);
  expect(paginateUnits(units,small).pages).toBe(2);
});

test("option patches preserve other sides and table flags are independent", () => {
  const patch = mergePaginationOptions({ margins: { left: 40 }, repeatTableHeader: false }, { margins: { top: 25 }, repeatTableCaption: false });
  const page = paginationGeometry(patch);
  expect(page.margins.left).toBeCloseTo(40*96/25.4);
  expect(page.margins.top).toBeCloseTo(25*96/25.4);
  expect(page.margins.bottom).toBe(DEFAULT_PAGINATION.margins.bottom);
  expect(page.repeatTableHeader).toBe(false);
  expect(page.repeatTableCaption).toBe(false);
});

test("invalid margins fail before changing the layout", () => {
  for (const value of [-1, NaN, Infinity]) expect(()=>paginationGeometry({margins:{top:value}})).toThrow();
  expect(()=>paginationGeometry({margins:{left:110,right:110}})).toThrow();
  expect(()=>paginationGeometry({margins:{top:150,bottom:150}})).toThrow();
});
const line = (from: number, top: number): LayoutUnit => ({
  from,
  top,
  bottom: top + 24,
  kind: "line",
});

test("an empty or exactly fitting chapter stays on one page", () => {
  expect(paginateUnits([]).pages).toBe(1);
  expect(paginateUnits([{ ...line(1, 0), bottom: contentHeight }])).toEqual({
    pages: 1,
    breaks: [],
  });
});

test("a long paragraph continues over several pages without document edits", () => {
  const units = Array.from({ length: 120 }, (_, index) =>
    line(index * 50 + 1, index * 24),
  );
  const before = structuredClone(units);
  const result = paginateUnits(units);
  expect(result.pages).toBe(4);
  expect(result.breaks.map(({ from }) => from)).toEqual([1851, 3701, 5551]);
  expect(units).toEqual(before);
  let shift = 0;
  for (const unit of units) {
    shift += result.breaks.find(({ from }) => from === unit.from)?.height ?? 0;
    const top = unit.top + shift;
    const page = Math.floor(top / (EDITOR_PAGE.height + EDITOR_PAGE.gap));
    expect(unit.bottom + shift).toBeLessThanOrEqual(
      page * (EDITOR_PAGE.height + EDITOR_PAGE.gap) + contentHeight + 0.5,
    );
  }
});

test("a heading moves with the first following line", () => {
  const heading: LayoutUnit = {
    from: 15,
    to: 25,
    top: contentHeight - 35,
    bottom: contentHeight - 11,
    kind: "block",
    keepWithNext: true,
  };
  const result = paginateUnits([heading, line(26, contentHeight - 5)]);
  expect(result.pages).toBe(2);
  expect(result.breaks[0].from).toBe(15);
  expect(result.breaks[0].kind).toBe("block");
});

test("a fitting figure moves as one block", () => {
  const figure: LayoutUnit = {
    from: 25,
    to: 30,
    top: contentHeight - 100,
    bottom: contentHeight + 200,
    kind: "block",
  };
  const result = paginateUnits([figure]);
  expect(result.pages).toBe(2);
  expect(result.breaks[0]).toMatchObject({ from: 25, to: 30 });
});

test("oversized units fail explicitly without presenting a clipped page", () => {
  expect(() => paginateUnits([
    line(1, contentHeight - 10),
    {
      from: 20,
      to: 100,
      top: contentHeight + 20,
      bottom: 3 * contentHeight,
      kind: "block",
    },
  ])).toThrow("cannot fit a page");
});

function paragraph(count: number, top: number): LayoutUnit[] {
  return Array.from({ length: count }, (_, index) => ({
    ...line(100 + index, top + index * 24),
    group: 99,
    lineIndex: index,
    lineCount: count,
  }));
}

test("a short paragraph moves whole instead of leaving one line behind", () => {
  const result = paginateUnits(paragraph(3, contentHeight - 30));
  expect(result.breaks.map(item => item.from)).toEqual([100]);
});

test("a long paragraph leaves two lines on both sides of its break", () => {
  const result = paginateUnits(paragraph(5, contentHeight - 100));
  expect(result.breaks.map(item => item.from)).toEqual([103]);
  const long = paginateUnits(paragraph(100, contentHeight - 30));
  expect(long.breaks[0].from).toBe(100);
  expect(long.pages).toBe(4);
});

test("a heading follows the paragraph's two-line minimum", () => {
  const top = contentHeight - 60;
  const result = paginateUnits([
    { ...line(1, top), kind: "block", to: 10, keepWithNext: true },
    ...paragraph(5, top + 24),
  ]);
  expect(result.breaks.map(item => item.from)).toEqual([1]);
});

test("a heading follows a short paragraph when its third line moves the paragraph whole", () => {
  const top = contentHeight - 80;
  const result = paginateUnits([
    { ...line(1, top), kind: "block", to: 10, keepWithNext: true },
    ...paragraph(3, top + 24),
  ]);
  expect(result.breaks.map(item => item.from)).toEqual([1]);
});

test("first-line ink above its block aligns with the new content edge", () => {
  const unit: LayoutUnit = {
    ...paragraph(1, contentHeight - 40)[0],
    bottom: contentHeight + 10,
    anchor: { from: 99, to: 150, top: contentHeight - 30, marginTop: 0 },
  };
  const result = paginateUnits([unit]);
  const pageBreak = result.breaks[0];
  expect(pageBreak).toMatchObject({ from: 99, to: 150, kind: "block" });
  expect(unit.top + pageBreak.height).toBeCloseTo(EDITOR_PAGE.height + EDITOR_PAGE.gap);
});

test("leading ink above its block aligns at the next content edge", () => {
  const unit: LayoutUnit = {
    from: 99,
    to: 150,
    top: 200,
    bottom: 1000,
    kind: "block",
    lineIndex: 0,
    lineCount: 1,
    anchor: { from: 99, to: 150, top: -20, marginTop: 0 },
  };
  const result = paginateUnits([unit]);
  const pageBreak = result.breaks[0];
  expect(pageBreak).toMatchObject({ from: 99, to: 150, kind: "block" });
  expect(unit.top + pageBreak.height).toBeCloseTo(EDITOR_PAGE.height + EDITOR_PAGE.gap);
});

test("a leading anchor margin does not offset the first visible line", () => {
  const unit: LayoutUnit = {
    from: 99,
    to: 150,
    top: contentHeight - 20,
    bottom: contentHeight + 200,
    kind: "block",
    lineIndex: 0,
    lineCount: 1,
    anchor: { from: 99, to: 150, top: contentHeight - 40, marginTop: 50 },
  };
  const result = paginateUnits([unit]);
  const pageBreak = result.breaks[0];
  expect(pageBreak).toMatchObject({ from: 99, to: 150, kind: "block" });
  expect(unit.top + pageBreak.height).toBeCloseTo(EDITOR_PAGE.height + EDITOR_PAGE.gap);
});

test("explicit breaks start a new page and do not create a blank page at its start", () => {
  const result = paginateUnits([
    line(1, 0),
    { ...line(10, 30), bottom: 30, kind: "block", to: 11, breakBefore: true },
    line(12, 30),
  ]);
  expect(result.breaks.map(item => item.from)).toEqual([10]);
  expect(result.pages).toBe(2);
  expect(paginateUnits([{ ...line(1, 0), breakBefore: true }]).pages).toBe(1);
});

test("invalid geometry fails instead of creating a nonfinite spacer", () => {
  expect(() => paginateUnits([{ ...line(1, 0), bottom: NaN }])).toThrow();
  expect(() => paginateUnits([{ ...line(1, 0), bottom: -1 }])).toThrow();
});

test("consecutive headings stay with their first content line", () => {
  const top = contentHeight - 60;
  const result = paginateUnits([
    { ...line(1, top), kind: "block", to: 10, keepWithNext: true },
    { ...line(10, top + 24), kind: "block", to: 20, keepWithNext: true },
    line(21, top + 48),
  ]);
  expect(result.breaks).toHaveLength(1);
  expect(result.breaks[0].from).toBe(1);
});
