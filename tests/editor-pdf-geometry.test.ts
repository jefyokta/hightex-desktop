import { expect, test } from "bun:test";

interface Glyph {
  character: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  font: string;
}
interface GeometryAudit {
  glyphs: Glyph[];
  images: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  labels: { label: string; before: string; font: string }[];
}
const { compareContent } = require("./integration/editor-pdf-geometry.cjs") as {
  compareContent(
    expected: GeometryAudit,
    actual: GeometryAudit,
  ): { glyphs: number };
};
const glyph: Glyph = {
  character: "a",
  page: 1,
  x: 120,
  y: 150,
  width: 8,
  height: 18,
  font: '16px "Times New Roman"',
};
const audit: GeometryAudit = {
  glyphs: [glyph, { ...glyph, x: 128 }],
  images: [{ page: 2, x: 120, y: 200, width: 240, height: 150 }],
  labels: [{ label: "Tabel 1", before: '"Tabel 1"', font: glyph.font }],
};

test("glyph comparison consumes repeated characters once and allows subpixel serialization", () => {
  const actual = structuredClone(audit);
  actual.glyphs.reverse();
  actual.glyphs[0].y += 0.25;
  expect(compareContent(audit, actual).glyphs).toBe(2);
  actual.glyphs[0].x = 120;
  expect(() => compareContent(audit, actual)).toThrow();
});

test("same text still fails on a changed page, position or font", () => {
  for (const patch of [{ page: 2 }, { y: 152 }, { font: "16px Arial" }]) {
    const actual = structuredClone(audit);
    Object.assign(actual.glyphs[0], patch);
    expect(() => compareContent(audit, actual)).toThrow();
  }
});

test("missing glyphs, moved images and changed generated labels fail equivalence", () => {
  const missing = structuredClone(audit);
  missing.glyphs.pop();
  expect(() => compareContent(audit, missing)).toThrow();
  const image = structuredClone(audit);
  image.images[0].page++;
  expect(() => compareContent(audit, image)).toThrow();
  const label = structuredClone(audit);
  label.labels[0].label = "Tabel 2";
  expect(() => compareContent(audit, label)).toThrow();
});
