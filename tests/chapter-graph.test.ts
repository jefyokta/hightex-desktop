import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import type { JSONContent } from "@tiptap/core";
import type { Chapter } from "../src/editor/chapter";

const source = ts.transpileModule(
  readFileSync(
    new URL("../src/editor/chapter/chapter-graph.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const heading = (level: number, id: string): JSONContent => ({
  type: "heading",
  attrs: { level, id },
  content: [{ type: "text", text: id }],
});
function fixture(attachment = false, cached?: ChapterGraphData) {
  const sandbox = {
    exports: {} as typeof import("../src/editor/chapter/chapter-graph"),
    require: (name: string) => {
      if (name === "../storage/hightex-db")
        return {
          HighTexDB: {
            getInstance: () => ({
              chapterGraphs: {
                get: async () => (cached ? { data: cached } : undefined),
              },
            }),
          },
        };
      if (name === "tjsn-parser")
        return {
          Counter: {
            getAlpha: (value: number) => String.fromCharCode(64 + value),
          },
        };
      throw Error(`Unexpected graph dependency: ${name}`);
    },
  };
  vm.runInNewContext(source, sandbox);
  const chapter = {
    getChapter: () => (attachment ? "attachment" : "3"),
    getId: () => (attachment ? "doc.attachment" : "doc.3"),
    query: { isAttachmentChapter: () => attachment },
  } as unknown as Chapter;
  return new sandbox.exports.ChapterGraph(chapter);
}

test("H4 stays out of the outline and does not affect H2/H3 numbering", () => {
  const content = [
    heading(1, "chapter"),
    heading(2, "section"),
    heading(4, "unindented"),
    heading(3, "subsection"),
    heading(4, "another-paragraph"),
    heading(2, "next-section"),
    heading(3, "next-subsection"),
  ];
  const before = JSON.stringify(content);
  const headings = fixture().extract(content).headings;
  expect(
    headings.map(({ id, level, numbering }) => ({ id, level, numbering })),
  ).toEqual([
    { id: "section", level: 2, numbering: "3.1" },
    { id: "subsection", level: 3, numbering: "3.1.1" },
    { id: "next-section", level: 2, numbering: "3.2" },
    { id: "next-subsection", level: 3, numbering: "3.2.1" },
  ]);
  expect(JSON.stringify(content)).toBe(before);
});

test("appendix titles remain structural while H4 is an ordinary unindented paragraph", () => {
  const headings = fixture(true).extract([
    heading(1, "appendix-a"),
    heading(4, "paragraph"),
    heading(2, "detail-a"),
    heading(1, "appendix-b"),
    heading(4, "paragraph-b"),
  ]).headings;
  expect(headings.map(({ id, numbering }) => ({ id, numbering }))).toEqual([
    { id: "appendix-a", numbering: "1" },
    { id: "detail-a", numbering: "1.1" },
    { id: "appendix-b", numbering: "2" },
  ]);
});

test("legacy cached H4 entries are excluded when the editor outline is warmed", async () => {
  const cached: ChapterGraphData = {
    headings: [
      {
        id: "section",
        level: 2,
        numbering: "3.1",
        text: [],
        chapterId: "doc.3",
        pos: 0,
      },
      {
        id: "paragraph",
        level: 4,
        numbering: "0",
        text: [],
        chapterId: "doc.3",
        pos: 0,
      },
    ],
    images: [],
    tables: [],
    equations: [],
  };
  const graph = fixture(false, cached);
  expect((await graph.warm()).headings.map(({ id }) => id)).toEqual([
    "section",
  ]);
  expect(cached.headings).toHaveLength(2);
});
