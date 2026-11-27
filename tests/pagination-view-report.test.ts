import { expect, test } from "bun:test";
import { loadSource } from "./helpers/load-source";
import { paginationReport } from "../src/editor/pagination/report-error";
import { paginationDiagnostic } from "../src/editor/pagination/diagnostic";
import { ShouldReport } from "../src/exception/should-report";
import { EditorPDFStateError } from "../src/exception/editor-pdf-state-error";
import { DocumentEngineError } from "../src/exception/document-engine-error";

interface FailureView {
  prototype: { reportFailure(error: unknown, chapter: { getId(): string }): void };
}
const { PaginationView } = loadSource<{ PaginationView: FailureView }>(
  new URL("../src/editor/pagination/view.ts", import.meta.url), {
    "../event": {}, "./options": {}, "./state": { emptyLayout: () => ({ breaks: [], pages: 1 }) },
    "./surface": {}, "./section-context": {},
    "@/document-engine/composition/section-composition": {},
    "@/document-engine/layout/chapter-compiler": {},
    "../chapter/layout-source": {}, "../document/layout-cache": {},
    "./report-error": { paginationReport }, "./diagnostic": { paginationDiagnostic },
  },
);

test("pagination view throws the report object with its stable ID, cause and diagnostic", () => {
  const cause = new DocumentEngineError({ runId: "report-regression", documentId: "doc", sectionId: "4", stage: "section" }, Error("Native layout reason"));
  const updates: { layout: { error: boolean }; diagnostic: unknown }[] = [];
  let failure: unknown;
  try {
    PaginationView.prototype.reportFailure.call({ dispatch: (update: typeof updates[number]) => updates.push(update) }, cause, { getId: () => "doc.4" });
  } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(ShouldReport);
  const report = failure as ShouldReport;
  expect(report.id).toBe("pagination-layout:doc.4");
  expect(report.cause).toBe(cause);
  expect(report.description).toContain("Native layout reason");
  expect(report.description).toContain('"runId":"report-regression"');
  expect(updates).toHaveLength(1);
  expect(updates[0].layout.error).toBe(true);
  expect(updates[0].diagnostic).toEqual(paginationDiagnostic(cause));
});

test("pagination view does not turn retryable states or recovered warnings into bug reports", () => {
  const receiver = { dispatch: () => {} };
  for (const cause of [new EditorPDFStateError("Source changed"), new DOMException("Cancelled", "AbortError"),
    new DocumentEngineError({ runId: "warning", documentId: "doc", stage: "references" }, Error("Missing reference"), { level: "warning", code: "reference.missing" })]) {
    expect(() => PaginationView.prototype.reportFailure.call(receiver, cause, { getId: () => "doc.4" })).not.toThrow();
  }
});

test("retryable capture states keep their classification when the document engine wraps them", () => {
  for (const cause of [new EditorPDFStateError("Styles changed while the menu closed"), new DOMException("Cancelled", "AbortError")]) {
    const wrapped = new DocumentEngineError({ runId: "capture", documentId: "doc", sectionId: "presentation", stage: "section" }, cause);
    expect(paginationReport(wrapped, "Workspace export")).toBeUndefined();
  }
});
