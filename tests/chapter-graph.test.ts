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
function fixture(attachment = false, cached?: ChapterGraphData, content: JSONContent[] = []) {
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
    getContent: async () => content,
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
  const graph = fixture(false, cached, [heading(2, "section"), heading(4, "paragraph")]);
  expect((await graph.warm()).headings.map(({ id }) => id)).toEqual([
    "section",
  ]);
  expect(cached.headings).toHaveLength(2);
});

test("warming recounts reordered source and ignores stored labels and stale graph numbers without writes", async () => {
  const cached: ChapterGraphData = { headings: [], images: [], tables: [], equations: [] };
  const content: JSONContent[] = [
    { type: "imageFigure", attrs: { id: "target", label: "Gambar 999", numbering: "999" } },
    { type: "figureTable", attrs: { id: "table", label: "Tabel 999" } },
  ];
  const before = JSON.stringify(content), graph = fixture(false, cached, content);
  expect((await graph.warm()).images.map(item => item.numbering)).toEqual(["3.1"]);
  expect(graph.data.tables.map(item => item.numbering)).toEqual(["3.1"]);
  expect(JSON.stringify(content)).toBe(before);
  content.unshift({ type: "imageFigure", attrs: { id: "inserted" } });
  expect((await graph.warm()).images.map(item => [item.id, item.numbering])).toEqual([
    ["inserted", "3.1"], ["target", "3.2"],
  ]);
  expect(cached.images).toEqual([]);
});

test("document equation numbers span chapters and appendices without changing source graphs", () => {
  const first = fixture();
  const second = fixture(true);
  const equation = (id: string): JSONContent => ({
    type: "blockMath",
    attrs: { id, latex: "x^2" },
  });
  const graphs = [
    first.extract([equation("first"), equation("second")]),
    second.extract([heading(1, "appendix-a"), equation("third")]),
  ];
  const before = JSON.stringify(graphs);
  const Graph =
    first.constructor as typeof import("../src/editor/chapter/chapter-graph").ChapterGraph;
  expect(
    Graph.numberEquations(graphs).map(({ id, pos, numbering }) => ({
      id,
      pos,
      numbering,
    })),
  ).toEqual([
    { id: "first", pos: 1, numbering: "1" },
    { id: "second", pos: 2, numbering: "2" },
    { id: "third", pos: 3, numbering: "3" },
  ]);
  expect(
    Graph.numberEquations([...graphs].reverse()).map(({ id, numbering }) => ({
      id,
      numbering,
    })),
  ).toEqual([
    { id: "third", numbering: "1" },
    { id: "first", numbering: "2" },
    { id: "second", numbering: "3" },
  ]);
  expect(JSON.stringify(graphs)).toBe(before);
});

test("snapshot graph extraction retains appendix heading and figure numbering", () => {
  const table = (id: string): JSONContent => ({
    type: "figureTable",
    attrs: { id },
    content: [],
  });
  const content = [
    heading(1, "appendix-a"),
    table("table-a"),
    heading(1, "appendix-b"),
    table("table-b"),
  ];
  const before = JSON.stringify(content);
  const result = fixture(true).extract(content);
  expect(result.tables.map(({ id, numbering }) => ({ id, numbering }))).toEqual(
    [
      { id: "table-a", numbering: "A.1" },
      { id: "table-b", numbering: "B.2" },
    ],
  );
  expect(JSON.stringify(content)).toBe(before);
});
