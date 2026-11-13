import { expect, test } from "bun:test";
import {
  PAGINATION_FEEDBACK_LIMIT,
  paginationDiagnostics,
  paginationFeedbackText,
} from "../src/editor/pagination/feedback";

test("pagination reports allowlist settings and omit document content, IDs and decoration HTML", () => {
  const secret = "PRIVATE-DOCUMENT-SOURCE";
  const state = {
    enabled: true,
    pending: false,
    documentId: secret,
    title: secret,
    options: {
      margins: { top: 25, left: 35 },
      repeatTableHeader: false,
      repeatTableCaption: true,
      documentPath: secret,
    },
    layout: { pages: 7, furniture: [{ html: secret }], errorDetails: secret },
  };
  const diagnostics = paginationDiagnostics(state, "1.5.0", "Fixture OS");
  expect(diagnostics).toEqual({
    appVersion: "1.5.0",
    platform: "Fixture OS",
    status: "ready",
    chapterPages: 7,
    marginsMm: { top: 25, right: 30, bottom: 30, left: 35 },
    repeatTableHeader: false,
    repeatTableCaption: true,
  });
  const diagnosticsWithPrivateFields = { ...diagnostics, document: secret };
  const report = paginationFeedbackText(
    diagnosticsWithPrivateFields,
    "The heading moved.",
  );
  expect(report).toContain("The heading moved.");
  expect(report).toContain("25/30/30/35");
  expect(report).not.toContain(secret);
});

test("diagnostics distinguish disabled, pending, failed and unavailable layouts", () => {
  const state = {
    enabled: true,
    pending: true,
    options: {},
    layout: { pages: 2, error: true },
  };
  expect(paginationDiagnostics(state, "1.5.0", "OS").status).toBe("failed");
  expect(
    paginationDiagnostics({ ...state, layout: { pages: 2 } }, "1.5.0", "OS")
      .status,
  ).toBe("pending");
  expect(
    paginationDiagnostics({ ...state, enabled: false }, "1.5.0", "OS"),
  ).toMatchObject({ status: "disabled", chapterPages: null });
  expect(paginationDiagnostics(undefined, "unknown", "OS")).toMatchObject({
    status: "unavailable",
    chapterPages: null,
  });
});

test("feedback bounds the user description while preserving the diagnostic fields", () => {
  const report = paginationFeedbackText(
    paginationDiagnostics(undefined, "1.5.0", "OS"),
    "x".repeat(PAGINATION_FEEDBACK_LIMIT + 100),
  );
  expect(report).toContain("x".repeat(PAGINATION_FEEDBACK_LIMIT));
  expect(report).not.toContain("x".repeat(PAGINATION_FEEDBACK_LIMIT + 1));
  expect(report).toContain("HighTex: 1.5.0");
});
