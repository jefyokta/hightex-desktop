import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import type { FlowLine } from "../src/editor/pagination/flow/text-flow";
import { tableBreaks } from "../src/editor/pagination/tables/table-breaks";
import { paginateUnits, recordPageBreak, type PageLayout } from "../src/editor/pagination/flow/page-planner";

const schema = new Schema({ nodes: { doc: { content: "cell+" }, text: {}, cell: {} } });
function cell(top: number, forced = false): PaginationTableCell {
  const lines: FlowLine[] = Array.from({ length: 5 }, (_, index) => ({ from: 100 + index,
    kind: "line", lineIndex: index, lineCount: 5, top: top + index * 24, bottom: top + (index + 1) * 24,
    breakBefore: forced && index === 2, bounds: () => ({ top: top + index * 24, bottom: top + (index + 1) * 24 }) }));
  return { from: 10, row: 0, end: 1, node: schema.node("cell"), nested: [], lines };
}

test("table widow/orphan decisions distinguish the overflow line from the moved source", () => {
  const page = { fromPage: 1, pageStart: 0, limit: 100, target: 124, forcedTop: Infinity, availableHeight: 100 };
  const widow = tableBreaks([cell(0)], 0, page)[0].decision;
  expect(widow).toMatchObject({ from: 103, trigger: { from: 104 }, reasons: ["overflow", "widow"],
    fromPage: 1, toPage: 2, container: { from: 10 }, displacement: 52 });
  const orphan = tableBreaks([cell(70)], 0, page)[0].decision;
  expect(orphan).toMatchObject({ from: 100, trigger: { from: 101 }, reasons: ["overflow", "orphan"], displacement: 54 });
  const forced = tableBreaks([cell(0, true)], 0, { ...page, limit: 48, forcedTop: 48 })[0].decision;
  expect(forced).toMatchObject({ from: 102, reasons: ["forced-break"], targetTop: 124 });
});

test("margin calibration coalesces presentation while retaining the original planning cause", () => {
  const plan = paginateUnits([{ from: 10, to: 20, top: 500, bottom: 520, kind: "block", breakBefore: true }]);
  const decision = plan.decisions![0];
  expect(decision).toMatchObject({ reasons: ["forced-break"] });
  const layout: PageLayout = { pages: 2, breaks: [] };
  recordPageBreak(layout, { from: 10, to: 20, kind: "block", top: 500, bottom: 520, marginTop: 6, height: 300 },
    { ...decision, kind: "break", placement: "block", trigger: { from: 10 }, reasons: ["forced-break"], fromPage: 1, toPage: 2,
      beforeTop: 500, beforeBottom: 520, limit: 900, targetTop: 1100, displacement: 600 });
  recordPageBreak(layout, { from: 10, to: 20, kind: "block", top: 1100, bottom: 1120, marginTop: 306, height: 0.01 });
  expect(layout.breaks).toHaveLength(1);expect(layout.decisions).toHaveLength(1);
  expect(layout.breaks[0].height).toBeCloseTo(300.01);
  expect(layout.decisions![0]).toMatchObject({ reasons: ["forced-break"], displacement: 600 });
});
