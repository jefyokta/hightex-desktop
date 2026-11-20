import { expect, test } from "bun:test";
import { captionImageHeight } from "../src/editor/pagination/measurement/figure-caption";
import { paginateUnits, type LayoutUnit } from "../src/editor/pagination/flow/page-planner";
import { paginationGeometry } from "../src/editor/pagination/options";
import { ChapterContentError } from "../src/exception/chapter-content-error";
import { DocumentEngineError } from "../src/exception/document-engine-error";

test("a long caption reserves opening lines while every authored line can paginate", () => {
  const geometry = paginationGeometry();
  const lines: LayoutUnit[] = Array.from({ length: 90 }, (_, index) => ({ from: index + 5, kind: "line",
    top: index * 24, bottom: (index + 1) * 24, group: 4, lineIndex: index, lineCount: 90 }));
  const height = captionImageHeight(geometry.contentHeight, 8, { top: 0, bottom: 2160 }, lines);
  expect(height).toBe(geometry.contentHeight - 56);
  const units: LayoutUnit[] = [{ from: 1, to: 4, kind: "block", top: 0, bottom: height, keepWithNext: true },
    ...lines.map(line => ({ ...line, top: line.top + height + 8, bottom: line.bottom + height + 8 }))];
  const plan = paginateUnits(units, geometry);
  expect(plan.pages).toBeGreaterThan(2);
  expect(plan.breaks.every(cut => cut.from >= 5)).toBe(true);
  expect(captionImageHeight(100, 8, { top: 0, bottom: 24 }, [{ top: 0, bottom: 24 }])).toBe(68);
  // A caption whose opening lines alone fill the page follows its image.
  expect(captionImageHeight(100, 8, { top: 0, bottom: 200 }, [{ top: 0, bottom: 200 }])).toBe(92);
});

test("compact table repetition is a source warning and retains its distinct reason", () => {
  const source = { chapterId: "doc.4", sourceRevision: "a".repeat(64), from: 100, to: 200, nodeId: "table" };
  const message = "Caption/header lanjutan ringkas; versi asli tetap lengkap.";
  const warning = new ChapterContentError([{ kind: "table", key: "table", message, source }]);
  const reported = new DocumentEngineError({ runId: "run", documentId: "doc", stage: "section", sectionId: "4" }, warning);
  expect(reported.level).toBe("warning");expect(reported.code).toBe("pagination.table.repeat.compact");
  expect(reported.diagnostic.source).toBe(source);expect(reported.message).toContain(message);
});

test("nested caption breaks reserve enclosing headers and do not add a page at an existing boundary", () => {
  const geometry = { ...paginationGeometry(), contentHeight: 100, stride: 124 };
  const reservedTop = 30;
  const lines: LayoutUnit[] = Array.from({ length: 6 }, (_, index) => ({ from: 10 + index,
    kind: "line", group: 9, lineIndex: index, lineCount: 6, top: 60 + index * 20, bottom: 80 + index * 20 }));
  const source = structuredClone(lines);
  const plan = paginateUnits(lines, geometry, reservedTop);
  expect(plan.pages).toBe(3);
  expect(plan.decisions?.filter(decision => decision.kind === "break").map(decision => decision.targetTop)).toEqual([154, 278]);
  expect(lines).toEqual(source);
  expect(paginateUnits([{ from: 1, kind: "block", top: 30, bottom: 50, breakBefore: true }], geometry, reservedTop).pages).toBe(1);
});
