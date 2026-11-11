import { expect, test } from "bun:test";
import {
  EDITOR_PAGE,
  paginateUnits,
  type LayoutUnit,
} from "../src/editor/pagination/layout";

const contentHeight = EDITOR_PAGE.height - 2 * EDITOR_PAGE.margin;
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
    unsupported: false,
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

test("oversized blocks fall back for the entire chapter without a break loop", () => {
  const result = paginateUnits([
    line(1, contentHeight - 10),
    {
      from: 20,
      to: 100,
      top: contentHeight + 20,
      bottom: 3 * contentHeight,
      kind: "block",
    },
  ]);
  expect(result).toEqual({ pages: 1, breaks: [], unsupported: true });
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
