import { expect, test } from "bun:test";
import {
  mergePaginationOptions,
  paginationGeometry,
  sectionGeometry,
} from "../src/editor/pagination/options";
import { mergeSectionOptions } from "../src/utils/section-options";
import { mmToPx } from "../src/utils/units";

test("editor group policies share geometry without leaking a selected override or mutating callers", () => {
  const input = { sections: {
    introduction: { margins: { left: 35 }, pageNumber: { format: "roman-upper" as const } },
    content: { margins: { right: 25 } },
  } };
  const baseline = structuredClone(input);
  const next = mergePaginationOptions(input, { sections: {
    introduction: { margins: { top: 20 } },
    appendix: { pageNumber: { position: "top-center" } },
  } });
  expect(paginationGeometry(next, "introduction").margins.left).toBeCloseTo(mmToPx(35));
  expect(paginationGeometry(next, "introduction").margins.top).toBeCloseTo(mmToPx(20));
  expect(paginationGeometry(next, "introduction").pageNumberFormat).toBe("roman-upper");
  expect(paginationGeometry(next, "content").margins.left).toBeCloseTo(mmToPx(30));
  expect(paginationGeometry(next, "appendix").pageNumber).toBe("top-center");
  expect(input).toEqual(baseline);
  expect(mergePaginationOptions(next, { sections: undefined }).sections).toBeUndefined();
});

test("each section inherits only the base defaults and cannot leak margins or footer placement", () => {
  const base = paginationGeometry({
    margins: { left: 40 },
    pageNumbers: { introduction: "bottom-center" },
  });
  const before = structuredClone(base);
  const toc = sectionGeometry(base, {
    margins: { top: 20, right: 25 },
    pageNumber: { position: "top-center" },
  });
  const chapter = sectionGeometry(base, { margins: { bottom: 35 } });
  expect(toc.margins).toEqual({
    top: mmToPx(20),
    right: mmToPx(25),
    bottom: mmToPx(30),
    left: mmToPx(40),
  });
  expect(toc.pageNumber).toBe("top-center");
  expect(chapter.margins).toEqual({
    top: mmToPx(30),
    right: mmToPx(30),
    bottom: mmToPx(35),
    left: mmToPx(40),
  });
  expect(chapter.pageNumber).toBeUndefined();
  expect(base).toEqual(before);
  expect(toc.contentWidth).toBeCloseTo(toc.width - mmToPx(65));
  expect(toc.contentHeight).toBeCloseTo(toc.height - mmToPx(50));
});

test("the live selected section and full-document renderer resolve exactly the same geometry", () => {
  const defaults = { margins: { top: 25, right: 20, bottom: 30, left: 40 } };
  const section = {
    margins: { right: 30, bottom: 35 },
    pageNumber: { position: "bottom-center" as const },
  };
  expect(paginationGeometry({ ...defaults, section })).toEqual(
    sectionGeometry(paginationGeometry(defaults), section),
  );
  const next = mergePaginationOptions(
    { ...defaults, section },
    { section: { margins: { top: 20 } } },
  );
  expect(paginationGeometry(next).margins.right).toBeCloseTo(mmToPx(20));
  expect(paginationGeometry(next).pageNumber).toBeUndefined();
  expect(
    mergePaginationOptions(next, { repeatTableHeader: false }).section,
  ).toEqual(next.section);
  expect(
    mergePaginationOptions(next, { section: undefined }).section,
  ).toBeUndefined();
});

test("partial section overrides preserve definition options without changing input objects", () => {
  const original = {
    margins: { left: 40, top: 25 },
    pageNumber: { position: "bottom-center" as const },
  };
  const patch = { margins: { top: 20, right: 30 } };
  expect(mergeSectionOptions(original, patch)).toEqual({
    margins: { left: 40, top: 20, right: 30 },
    pageNumber: { position: "bottom-center" },
  });
  expect(original).toEqual({
    margins: { left: 40, top: 25 },
    pageNumber: { position: "bottom-center" },
  });
  expect(patch).toEqual({ margins: { top: 20, right: 30 } });
  expect(
    mergeSectionOptions(
      { pageNumber: { position: "bottom-center", format: "roman-upper" } },
      { pageNumber: { position: "top-left" } },
    ).pageNumber,
  ).toEqual({ position: "top-left", format: "roman-upper" });
});

test("invalid section dimensions and page-number positions fail before planning", () => {
  const base = paginationGeometry();
  for (const margins of [
    { left: -1 },
    { top: NaN },
    { left: 100, right: 100 },
    { bottom: Infinity },
  ])
    expect(() => sectionGeometry(base, { margins })).toThrow(RangeError);
  expect(() =>
    sectionGeometry(base, { pageNumber: { position: "middle" as never } }),
  ).toThrow(RangeError);
});

test("number formats share Roman/decimal/alphabetic conversion and reject unknown styles", async () => {
  const { formatPageNumber } = await import("../src/utils/page-number");
  const values = {
    decimal: "28",
    "roman-upper": "XXVIII",
    "roman-lower": "xxviii",
    "alpha-upper": "AB",
    "alpha-lower": "ab",
  };
  for (const [format, expected] of Object.entries(values)) {
    expect(formatPageNumber(28, format as keyof typeof values)).toBe(expected);
    expect(
      paginationGeometry({
        section: { pageNumber: { format: format as keyof typeof values } },
      }).pageNumberFormat,
    ).toBe(format as keyof typeof values);
  }
  expect(() =>
    paginationGeometry({
      section: { pageNumber: { format: "roman" as never } },
    }),
  ).toThrow(RangeError);
});
