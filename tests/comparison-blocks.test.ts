import { expect, test } from "bun:test";
import { changedChapterBlocks } from "../src/editor/storage/comparison-blocks";

test("comparison highlights changed blocks without flattening unchanged structure", () => {
  const heading = {
    type: "heading",
    content: [{ type: "text", text: "Title" }],
  };
  const list = { type: "orderedList", content: [{ type: "listItem" }] };
  const table = { type: "table", content: [{ type: "tableRow" }] };
  expect(
    changedChapterBlocks(
      [heading, "old", list, table],
      [heading, "new", list, table],
    ),
  ).toEqual({
    main: [false, true, false, false],
    branch: [false, true, false, false],
  });
  expect(
    changedChapterBlocks([heading, table], [heading, list, table]),
  ).toEqual({ main: [false, false], branch: [false, true, false] });
});

test("formatting-only changes and absent chapters remain visible", () => {
  const before = {
    type: "paragraph",
    content: [{ type: "text", text: "Same", marks: [{ type: "italic" }] }],
  };
  const after = {
    type: "paragraph",
    content: [{ type: "text", text: "Same", marks: [{ type: "bold" }] }],
  };
  expect(changedChapterBlocks([before], [after])).toEqual({
    main: [true],
    branch: [true],
  });
  expect(changedChapterBlocks([], [after])).toEqual({
    main: [],
    branch: [true],
  });
  expect(changedChapterBlocks([before], [])).toEqual({
    main: [true],
    branch: [],
  });
});

test("large chapter comparisons keep stable edges without building an unbounded matrix", () => {
  const before = [
    "start",
    ...Array.from({ length: 1000 }, (_, i) => `before-${i}`),
    "end",
  ];
  const after = [
    "start",
    ...Array.from({ length: 1000 }, (_, i) => `after-${i}`),
    "end",
  ];
  const result = changedChapterBlocks(before, after);
  expect(result.main.filter(Boolean)).toHaveLength(1000);
  expect(result.main[0]).toBe(false);
  expect(result.branch[result.branch.length - 1]).toBe(false);
});
