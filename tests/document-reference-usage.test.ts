import { expect, test } from "bun:test";
import { documentReferenceUsage } from "../src/editor/document/reference-usage";

test("usage finds grouped nested citations, excludes manual citations and retains missing targets", () => {
  const chapters = [{ id: "doc.1", content: [
    { type: "heading", attrs: { id: "chapter" }, content: [{ type: "text", text: "Pendahuluan" }] },
    { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [
      { type: "paragraph", content: [{ type: "text", text: "Penelitian terdahulu " }, { type: "cite", attrs: { cite: "a|b|a" } }] },
    ] }] }] },
    { type: "paragraph", content: [{ type: "cite", attrs: { cite: "manual", manual: true } }, { type: "refComponent", attrs: { ref: "imageFigure", link: "missing" } }] },
  ] }];
  const before = JSON.stringify(chapters);
  const result = documentReferenceUsage(chapters, { a: "bib", unused: "bib" });
  expect(result.find(item => item.key === "a")?.occurrences).toHaveLength(1);
  expect(result.find(item => item.key === "b")?.occurrences[0]).toMatchObject({ chapterId: "doc.1", chapterTitle: "Pendahuluan", path: [1, 0, 0, 0, 1], excerpt: "Penelitian terdahulu" });
  expect(result.find(item => item.key === "unused")?.occurrences).toEqual([]);
  expect(result.some(item => item.key === "manual")).toBe(false);
  expect(result.find(item => item.key === "missing")?.kind).toBe("imageFigure");
  expect(JSON.stringify(chapters)).toBe(before);
});

test("usage pairs object identities with references instead of trusting cached labels", () => {
  const result = documentReferenceUsage([{ id: "1", content: [
    { type: "paragraph", content: [{ type: "refComponent", attrs: { ref: "figureTable", link: "table", label: "Tabel 999" } }] },
    { type: "figureTable", attrs: { id: "table" }, content: [{ type: "figcaption", content: [{ type: "text", text: "Hasil penelitian" }] }] },
    { type: "blockMath", attrs: { id: "equation", latex: "x^2" } },
  ] }]);
  expect(result.find(item => item.key === "table")).toMatchObject({ kind: "figureTable", title: "Hasil penelitian" });
  expect(result.find(item => item.key === "table")?.occurrences).toHaveLength(1);
  expect(result.find(item => item.key === "equation")).toMatchObject({ title: "x^2", occurrences: [] });
});
