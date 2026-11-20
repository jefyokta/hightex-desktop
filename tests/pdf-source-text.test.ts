import { expect, test } from "bun:test";

const { containsPDFSourceText, verifyPagePlanText } =
  require("./integration/page-plan-pdf.cjs") as {
    containsPDFSourceText(expected: string, ...extractions: string[]): boolean;
    verifyPagePlanText(input: {
      text: string;
      raw: string;
      contract: { markers: string[]; literalBlocks: [] };
      markerPages: object;
      ranges: {
        page: number;
        ranges: { from: number; to: number; text: string }[];
      }[];
      narrativeIds: string[];
    }): void;
  };

test("source-order extraction verifies table cells interleaved by layout extraction", () => {
  const expected = "Kolom pertama baris satu baris dua";
  const layout = "Kolom pertama Kolom kedua baris satu isi lain baris dua";
  expect(containsPDFSourceText(expected, layout)).toBe(false);
  expect(
    containsPDFSourceText(
      expected,
      layout,
      "Kolom pertama\nbaris satu\nbaris dua",
    ),
  ).toBe(true);
  expect(
    containsPDFSourceText(expected, layout, "Kolom pertama baris satu"),
  ).toBe(false);
});

test("PDF text matching normalizes ligatures and invisible spacing without dropping words", () => {
  expect(
    containsPDFSourceText("file tersimpan", "ﬁle ter\u00adsim\u2060pan"),
  ).toBe(true);
  expect(containsPDFSourceText("file belum tersimpan", "ﬁle tersimpan")).toBe(
    false,
  );
});

test("a source range found on another page still fails verification", () => {
  const input = {
    text: "Teks halaman pertama\fTeks yang dipindah\f",
    raw: "Teks halaman pertama\fTeks yang dipindah\f",
    contract: { markers: [], literalBlocks: [] as [] },
    markerPages: {},
    narrativeIds: [],
    ranges: [
      { page: 1, ranges: [{ from: 4, to: 21, text: "Teks yang dipindah" }] },
    ],
  };
  expect(() => verifyPagePlanText(input)).toThrow("on page 1");
  expect(() =>
    verifyPagePlanText({ ...input, ranges: [{ ...input.ranges[0], page: 2 }] }),
  ).not.toThrow();
});
