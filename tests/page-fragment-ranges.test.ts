import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import { pageFragmentRanges } from "./helpers/legacy-pagination/fragment-ranges";
import type { PageLayout } from "../src/editor/pagination/flow/page-planner";
import {
  tableFragmentCells,
  tableFragmentColumns,
} from "./helpers/legacy-pagination/table-fragments";

const schema = new Schema({
  nodes: {
    doc: { content: "block*" },
    paragraph: {
      group: "block",
      content: "inline*",
      attrs: { id: { default: null } },
    },
    heading: { group: "block", content: "inline*" },
    text: { group: "inline" },
    hardBreak: { inline: true, group: "inline" },
    horizontalRule: { group: "block" },
    orderedList: {
      group: "block",
      content: "listItem*",
      attrs: { start: { default: 1 } },
    },
    bulletList: { group: "block", content: "listItem*" },
    listItem: { content: "block*" },
    image: { group: "block", atom: true },
    imageFigure: {
      group: "block",
      content: "image figcaption",
      editorPagination: { kind: "atomic" },
    },
    figcaption: { content: "inline*" },
    table: { group: "block", content: "tableRow+", tableRole: "table" },
    tableRow: { content: "tableCell*", tableRole: "row" },
    tableCell: {
      tableRole: "cell",
      content: "block+",
      attrs: { rowspan: { default: 1 }, colspan: { default: 1 } },
    },
    codeBlock: { group: "block", content: "text*" },
  },
  marks: { bold: {}, italic: {} },
});
const paragraph = (text: string) =>
  schema.node(
    "paragraph",
    { id: "paragraph-id" },
    schema.text(text, [schema.mark("bold"), schema.mark("italic")]),
  );
const plan = (...positions: number[]): PageLayout => ({
  pages: positions.length + 1,
  breaks: positions.map((from) => ({
    from,
    top: 0,
    bottom: 20,
    height: 100,
    kind: "line",
  })),
});

test("source fragments retain UTF-16 positions, marks and exact source coverage", () => {
  const source = schema.node(
    "doc",
    null,
    paragraph("Café e\u0301 👩🏽‍💻 — final words."),
  );
  const before = JSON.stringify(source.toJSON()),
    cut = source.textContent.indexOf("final") + 1;
  const ranges = pageFragmentRanges(source, plan(cut), (_block, from) =>
    from >= cut ? 2 : 1,
  );
  expect(
    ranges.map(({ from, to, slice, page }) => ({
      from,
      to,
      size: slice.size,
      page,
    })),
  ).toEqual([
    { from: 0, to: cut, size: cut, page: 1 },
    {
      from: cut,
      to: source.content.size,
      size: source.content.size - cut,
      page: 2,
    },
  ]);
  expect(
    ranges
      .map((range) => source.textBetween(range.from, range.to, "", ""))
      .join(""),
  ).toBe(source.textContent);
  expect(ranges[1].slice.openStart).toBe(1);
  expect(
    ranges[1].slice.content.firstChild?.firstChild?.marks.map(
      (mark) => mark.type.name,
    ),
  ).toEqual(["bold", "italic"]);
  expect(JSON.stringify(source.toJSON())).toBe(before);
});

test("nested lists keep source starts and native open slices", () => {
  const source = schema.node(
    "doc",
    null,
    schema.node(
      "orderedList",
      { start: 3 },
      schema.node("listItem", null, [
        paragraph("Outer item."),
        schema.node(
          "orderedList",
          { start: 7 },
          schema.node(
            "listItem",
            null,
            paragraph("Nested item continues here."),
          ),
        ),
      ]),
    ),
  );
  let position = 0;
  source.descendants((node, pos) => {
    if (node.isText && node.text?.includes("Nested")) position = pos + 7;
  });
  const ranges = pageFragmentRanges(source, plan(position), (_block, from) =>
    from >= position ? 2 : 1,
  );
  const continuation = ranges.find((range) => range.page === 2)!;
  expect(continuation.slice.openStart).toBe(5);
  expect(continuation.slice.content.firstChild?.attrs.start).toBe(3);
  expect(
    ranges
      .map((range) => source.textBetween(range.from, range.to, ""))
      .join(""),
  ).toBe(source.textContent);
});

test("recorded blank pages require no copied source ranges", () => {
  const source = schema.node("doc", null, paragraph("Only source")),
    layout = plan(0, 0);
  const ranges = pageFragmentRanges(source, layout, () => 3);
  expect(layout.pages).toBe(3);
  expect(
    ranges.map((range) => ({ page: range.page, size: range.slice.size })),
  ).toEqual([{ page: 3, size: source.content.size }]);
  expect(pageFragmentRanges(schema.node("doc"), layout, () => 3)).toEqual([]);
});

test("parallel cell ranges can revisit a page without duplicating any source", () => {
  const cell = (text: string) =>
    schema.node("tableCell", null, paragraph(text));
  const source = schema.node(
    "doc",
    null,
    schema.node(
      "table",
      null,
      schema.node("tableRow", null, [
        cell("Left continues here."),
        cell("Right continues there."),
      ]),
    ),
  );
  const blocks: number[] = [];
  source.descendants((node, pos) => {
    if (node.type.name === "paragraph") blocks.push(pos);
  });
  const cuts = blocks.map((pos) => pos + 6);
  const ranges = pageFragmentRanges(
    source,
    { ...plan(...cuts), pages: 2 },
    (block, from) => (from >= block + 6 ? 2 : 1),
  );
  expect(ranges.map((range) => range.page)).toEqual([1, 2, 1, 2]);
  expect(ranges[0].from).toBe(0);
  expect(ranges[ranges.length - 1]?.to).toBe(source.content.size);
  ranges.forEach((range, index) => {
    if (index) expect(range.from).toBe(ranges[index - 1].to);
  });
  expect(
    ranges
      .map((range) => source.textBetween(range.from, range.to, ""))
      .join(""),
  ).toBe(source.textContent);
});

test("images and captions have one indivisible source owner", () => {
  const source = schema.node(
    "doc",
    null,
    schema.node("imageFigure", null, [
      schema.node("image"),
      schema.node("figcaption", null, schema.text("Caption text")),
    ]),
  );
  const ranges = pageFragmentRanges(source, { ...plan(), pages: 2 }, () => 2);
  expect(ranges).toHaveLength(1);
  expect(ranges[0].slice.size).toBe(source.content.size);
  expect(() => pageFragmentRanges(source, plan(2), () => 1)).toThrow(
    "indivisible",
  );
});

test("invalid positions, table grids and failed placement reject", () => {
  const source = schema.node("doc", null, paragraph("Content"));
  for (const layout of [
    plan(-1),
    plan(1),
    plan(source.content.size + 1),
    { ...plan(), pages: 0 },
    { ...plan(), error: true },
  ])
    expect(() => pageFragmentRanges(source, layout, () => 1)).toThrow();
  expect(() => pageFragmentRanges(source, plan(), () => 2)).toThrow("outside");
  expect(() =>
    pageFragmentRanges(
      schema.node(
        "doc",
        null,
        schema.node("heading", null, schema.text("Heading")),
      ),
      plan(3),
      () => 1,
    ),
  ).toThrow("Splitting a heading");
  const merged = schema.node(
    "table",
    null,
    schema.node(
      "tableRow",
      null,
      schema.node("tableCell", { rowspan: 2 }, paragraph("Cell")),
    ),
  );
  expect(() =>
    pageFragmentRanges(schema.node("doc", null, merged), plan(), () => 1),
  ).toThrow("Invalid table fragment grid");
  const nested = schema.node(
    "table",
    null,
    schema.node(
      "tableRow",
      null,
      schema.node(
        "tableCell",
        null,
        schema.node(
          "table",
          null,
          schema.node(
            "tableRow",
            null,
            schema.node("tableCell", null, paragraph("Inner")),
          ),
        ),
      ),
    ),
  );
  const nestedSource = schema.node("doc", null, nested);
  const ranges = pageFragmentRanges(nestedSource, plan(), () => 1);
  expect(
    ranges
      .map((range) => nestedSource.textBetween(range.from, range.to))
      .join(""),
  ).toBe("Inner");
});

test("merged cells retain native column ownership and clipped rowspans", () => {
  const cell = (text: string, attrs = {}) =>
    schema.node("tableCell", attrs, paragraph(text));
  const table = schema.node("table", null, [
    schema.node("tableRow", null, [
      cell("Spanning left", { rowspan: 3 }),
      cell("Wide top", { colspan: 2 }),
    ]),
    schema.node("tableRow", null, [
      cell("Middle"),
      cell("Right", { rowspan: 2 }),
    ]),
    schema.node("tableRow", null, [cell("Bottom")]),
  ]);
  const before = JSON.stringify(table.toJSON());
  const all = tableFragmentCells(table, 0, 3);
  const continued = tableFragmentCells(table, 1, 3);
  expect(
    all.map(({ row, column, colspan, rowspan }) => ({
      row,
      column,
      colspan,
      rowspan,
    })),
  ).toEqual([
    { row: 0, column: 0, colspan: 1, rowspan: 3 },
    { row: 0, column: 1, colspan: 2, rowspan: 1 },
    { row: 1, column: 1, colspan: 1, rowspan: 1 },
    { row: 1, column: 2, colspan: 1, rowspan: 2 },
    { row: 2, column: 1, colspan: 1, rowspan: 1 },
  ]);
  expect(
    continued.map(({ from, row, column, rowspan }) => ({
      from,
      row,
      column,
      rowspan,
    })),
  ).toEqual([
    { from: all[0].from, row: 1, column: 0, rowspan: 2 },
    { from: all[2].from, row: 1, column: 1, rowspan: 1 },
    { from: all[3].from, row: 1, column: 2, rowspan: 2 },
    { from: all[4].from, row: 2, column: 1, rowspan: 1 },
  ]);
  const source = schema.node("doc", null, table);
  const ranges = pageFragmentRanges(source, plan(), () => 1);
  expect(
    ranges
      .map((range) => source.textBetween(range.from, range.to, ""))
      .join(""),
  ).toBe(source.textContent);
  expect(JSON.stringify(table.toJSON())).toBe(before);
  expect(() => tableFragmentCells(table, 1, 4)).toThrow(
    "Invalid table fragment grid",
  );
});

test("source projection uses schema structure for code and new inline extensions", () => {
  const custom = new Schema({
    nodes: {
      doc: { content: "block+" },
      code: { group: "block", content: "text*" },
      paragraph: { group: "block", content: "inline*" },
      text: { group: "inline" },
      cite: { group: "inline", inline: true, atom: true },
      futureInline: { group: "inline", inline: true, atom: true },
    },
  });
  const source = custom.node("doc", null, [
    custom.node("code", null, custom.text("a\nb")),
    custom.node("paragraph", null, [
      custom.node("cite"),
      custom.text(" tail"),
      custom.node("futureInline"),
    ]),
  ]);
  const ranges = pageFragmentRanges(source, plan(), () => 1);
  expect(
    ranges.map((range) => range.slice.content.firstChild?.type.name),
  ).toEqual(["code", "paragraph"]);
  expect(ranges.reduce((size, range) => size + range.slice.size, 0)).toBe(
    source.content.size,
  );
  expect(ranges[1].slice.content.firstChild?.firstChild?.type.name).toBe(
    "cite",
  );
});

test("template table continuations preserve columns measured beneath a merged heading", () => {
  const cell = (span = 1) =>
    schema.node("tableCell", { colspan: span }, [paragraph("Text")]);
  const table = schema.node("table", null, [
    schema.node("tableRow", null, [cell(3)]),
    schema.node("tableRow", null, [cell(), cell(), cell()]),
  ]);
  const cells = tableFragmentCells(table, 0, 2);
  const columns = tableFragmentColumns(
    table,
    { left: 100, width: 600 },
    (from) => {
      const cell = cells.find((cell) => cell.from === from)!;
      const edges = [100, 180, 550, 700];
      return {
        left: edges[cell.column],
        right: edges[cell.column + cell.colspan],
      };
    },
  );
  expect(columns).toEqual([80, 370, 150]);
});
