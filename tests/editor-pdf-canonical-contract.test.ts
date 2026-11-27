import { expect, test } from "bun:test";
import { editorPDFIdentity, validateEditorPDFSnapshot } from "../shared/editor-pdf-contract";

test("experimental transport accepts only canonical contexts and binds their identity", () => {
  const snapshot: EditorPDFSnapshot = {
    version: 3, documentId: "fixture", title: "Canonical", author: "Writer",
    sourceHash: "a".repeat(64), planHash: "b".repeat(64), fingerprint: "c".repeat(64),
    html: "<main class=editor-pdf-pages></main>", pages: 1, presentation: [[]],
    sections: [{ id: "1", firstPage: 1, pages: 1, labels: ["1"] }],
    projection: { contexts: [{ pages: 1, width: 600, height: 800, stride: 800 }],
      views: [{ context: 0, page: 1 }], targets: [], links: [] },
  };
  expect(() => validateEditorPDFSnapshot(snapshot)).not.toThrow();
  for (const version of [1, 2])
    expect(() => validateEditorPDFSnapshot({ ...snapshot, version })).toThrow("version");
  expect(editorPDFIdentity(snapshot)).not.toBe(editorPDFIdentity({
    ...snapshot, projection: { ...snapshot.projection, targets: [{ id: "source", page: 1, x: 12, y: 24 }] },
  }));
});

test("watermark bytes are portable, validated and bound to snapshot identity", () => {
  const snapshot: EditorPDFSnapshot = {
    version: 3, documentId: "fixture", title: "Canonical", author: "Writer",
    sourceHash: "a".repeat(64), planHash: "b".repeat(64), fingerprint: "c".repeat(64),
    html: "<main class=editor-pdf-pages></main>", pages: 1, presentation: [[]],
    sections: [{ id: "1", firstPage: 1, pages: 1, labels: ["1"] }],
    projection: { contexts: [{ pages: 1, width: 600, height: 800, stride: 800 }],
      views: [{ context: 0, page: 1 }], targets: [], links: [] },
  };
  const marked = { ...snapshot, watermark: "data:image/jpeg;base64,YQ==" };
  expect(() => validateEditorPDFSnapshot(marked)).not.toThrow();
  expect(editorPDFIdentity(marked)).not.toBe(editorPDFIdentity(snapshot));
  for (const watermark of ["https://example.test/wm.jpg", "data:image/svg+xml;base64,YQ==", true])
    expect(() => validateEditorPDFSnapshot({ ...snapshot, watermark })).toThrow("watermark");
});
