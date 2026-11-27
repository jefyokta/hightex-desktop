import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { tableNodes } from "@tiptap/pm/tables";
import { equalTableColumns, fittedTableColumns, fractionalColumnWidth, resizedTableColumns, setTableColumnWidths, tableColumnWidths } from "../src/editor/extensions/table/widths";

const schema = new Schema({ nodes: {
  doc: { content: "block+" },
  text: {},
  paragraph: { group: "block", content: "text*" },
  ...tableNodes({ tableGroup: "block", cellContent: "paragraph+", cellAttributes: {} }),
} });
const cell = (widths: number[] | null, colspan = 1, rowspan = 1) => schema.node("table_cell", { colwidth: widths, colspan, rowspan }, schema.node("paragraph"));

test("apply cell width to all uses the selected column and retains the 1px minimum", () => {
  expect(equalTableColumns([120, 160, 180], 1, 1, 567)).toEqual([160, 160, 160]);
  expect(equalTableColumns([1, 160, 180], 0, 1, 567)).toEqual([1, 1, 1]);
});

test("apply cell width to all fits the result to its own container", () => {
  expect(equalTableColumns([120, 160, 240], 2, 1, 567)).toEqual([189, 189, 189]);
  expect(equalTableColumns([80, 200], 1, 1, 240)).toEqual([120, 120]);
});

test("apply merged cell width to all averages its column span without changing the input", () => {
  const widths = [120, 160, 180];
  expect(equalTableColumns(widths, 0, 2, 567)).toEqual([140, 140, 140]);
  expect(widths).toEqual([120, 160, 180]);
});

test("column sizing retains one pixel and each part of a merged cell", () => {
  const table = schema.node("table", null, schema.node("table_row", null, [cell([1, 160], 2), cell(null)]));
  expect(tableColumnWidths(table)).toEqual([1, 160, null]);
});

test("an internal border transfers width to its neighbor and retains the table width", () => {
  expect(resizedTableColumns([120, 160, 180], 0, 180, 566.929)).toEqual([180, 100, 180]);
  expect(resizedTableColumns([120, 160, 180], 0, 600, 566.929)).toEqual([279, 1, 180]);
  expect(resizedTableColumns([120, 160, 180], 0, -300, 566.929)).toEqual([1, 279, 180]);
});

test("the outer edge changes table width within its container and retains a 1px minimum", () => {
  expect(resizedTableColumns([120, 160, 180], 2, 240, 566.93)).toEqual([120, 160, 240]);
  expect(resizedTableColumns([120, 160, 180], 2, 900, 567)).toEqual([120, 160, 287]);
  expect(resizedTableColumns([120, 160, 180], 2, -30, 567)).toEqual([120, 160, 1]);
});

test("fitting preserves explicit widths and distributes only automatic columns when room is available", () => {
  expect(fittedTableColumns([120, 160, 180], 567)).toEqual([120, 160, 180]);
  expect(fittedTableColumns([1, 200, 200], 567)).toEqual([1, 200, 200]);
  expect(fittedTableColumns([120, null, null], 566)).toEqual([120, 223, 223]);
  expect(fittedTableColumns([null, null], 566)).toEqual([283, 283]);
});

test("oversized column fitting retains the one-pixel minimum and does not rewrite its input", () => {
  const input = [1, 400, 400];
  expect(fittedTableColumns(input, 401)).toEqual([1, 200, 200]);
  expect(input).toEqual([1, 400, 400]);
  expect(fittedTableColumns([400, 400, 400], 567)).toEqual([189, 189, 189]);
});

test("automatic and fitted fractional columns retain table width during an internal drag", () => {
  const original = [188.976, 188.976, 188.976];
  const widths = resizedTableColumns(original, 1, 248.976, 566.929);
  expect(widths[0]).toBe(original[0]);
  expect(widths[1]).toBe(248.976);
  expect(widths.reduce((sum, width) => sum + width, 0)).toBe(original.reduce((sum, width) => sum + width, 0));
  expect(original).toEqual([188.976, 188.976, 188.976]);
});

test("HTML width parsing retains fractional columns and delegates the existing colgroup fallback", () => {
  const attribute = fractionalColumnWidth({ default: null, parseHTML: () => [100] });
  const element = (value: string | null) => ({ getAttribute: () => value }) as unknown as HTMLElement;
  expect(attribute.parseHTML!(element('188.976,1,248.976'))).toEqual([188.976, 1, 248.976]);
  expect(attribute.parseHTML!(element(null))).toEqual([100]);
});

test("one resize transaction updates merged and rowspan owners without mutating captured source", () => {
  const table = schema.node("table", null, [
    schema.node("table_row", null, [cell([50], 1, 2), cell([100, 200], 2)]),
    schema.node("table_row", null, [cell([100]), cell([200])]),
  ]);
  const doc = schema.node("doc", null, table), before = doc.toJSON();
  const transaction = EditorState.create({ doc }).tr;
  setTableColumnWidths(transaction, 0, [1, 80, 180]);
  const resized = transaction.doc.firstChild!;
  expect(resized.child(0).child(0).attrs).toMatchObject({ colwidth: [1], rowspan: 2 });
  expect(resized.child(0).child(1).attrs).toMatchObject({ colwidth: [80, 180], colspan: 2 });
  expect(resized.child(1).child(0).attrs.colwidth).toEqual([80]);
  expect(resized.child(1).child(1).attrs.colwidth).toEqual([180]);
  expect(doc.toJSON()).toEqual(before);
  expect(transaction.steps).toHaveLength(4);
});
