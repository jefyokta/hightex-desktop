import { expect, test } from "bun:test";
import { readSplitPlan } from "../src/document-export/split-plan";

function canonical(chapters: number) {
  const ids = ["cover", "consent", "validity", "statement", "toc", ...Array.from({ length: chapters }, (_, i) => String(i + 1)), "bibliography", "attachment", "cv"];
  const sections = ids.map((id, index) => ({ id, firstPage: index + 1, pages: 1 }));
  return { kind: "editor-document-experimental", pages: ids.length, sections };
}

test("canonical split keeps the last chapter public and replaces only named signed sections", () => {
  const metadata = canonical(6), plan = readSplitPlan(JSON.stringify(metadata), metadata.pages);
  const ids = (ranges: typeof plan.publicRanges) => ranges.map(range => metadata.sections.find(section => section.firstPage === range.start)!.id);
  expect(ids(plan.publicRanges)).toEqual(["validity", "toc", "1", "2", "3", "6", "bibliography", "attachment", "cv"]);
  expect(ids(plan.privateRanges)).toEqual(["4", "5"]);
  expect(plan.payload).toEqual(metadata);
});

test("numeric chapter IDs above nine and short documents do not use lexicographic order", () => {
  const metadata = canonical(12), plan = readSplitPlan(JSON.stringify(metadata), metadata.pages);
  expect(plan.privateRanges).toHaveLength(8);
  expect(plan.publicRanges.some(range => range.start === metadata.sections.find(section => section.id === "12")!.firstPage)).toBe(true);
  const short = canonical(3);
  expect(readSplitPlan(JSON.stringify(short), short.pages).privateRanges).toEqual([]);
});

test("multi-page cover and appendix retain every page", () => {
  const metadata = { kind: "editor-document-experimental", pages: 8, sections: [
    { id: "cover", firstPage: 1, pages: 2 }, { id: "1", firstPage: 3, pages: 2 },
    { id: "attachment", firstPage: 5, pages: 3 }, { id: "cv", firstPage: 8, pages: 1 },
  ] };
  const plan = readSplitPlan(JSON.stringify(metadata), 8);
  expect(plan.cover).toMatchObject({ start: 1, end: 2 });
  expect(plan.publicRanges.map(({ start, end }) => [start, end])).toEqual([[3, 4], [5, 7], [8, 8]]);
});

test("malformed, overlapping, truncated or duplicate sections cannot split the wrong pages", () => {
  const good = canonical(5);
  for (const mutate of [
    (value: typeof good) => { value.pages--; },
    (value: typeof good) => { value.sections[1].firstPage = 1; },
    (value: typeof good) => { value.sections[2].id = "cover"; },
    (value: typeof good) => { value.sections[4].pages = 1.5; },
    (value: typeof good) => { value.sections.pop(); },
  ]) {
    const metadata = structuredClone(good); mutate(metadata);
    expect(() => readSplitPlan(JSON.stringify(metadata), good.pages)).toThrow();
  }
});

test("legacy detail supports existing PDFs and numeric chapter ordering", () => {
  const detail = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i + 1, { start: i + 5, end: i + 5 }]));
  const plan = readSplitPlan(JSON.stringify({ detail, chapters: [{ chapter: 1, page: 5 }] }), 15);
  expect(plan.publicRanges).toEqual([{ start: 4, end: 4 }, detail[1], detail[2], detail[3], detail[10], detail[11]]);
  expect(plan.privateRanges).toEqual([detail[4], detail[5], detail[6], detail[7], detail[8], detail[9]]);
});
