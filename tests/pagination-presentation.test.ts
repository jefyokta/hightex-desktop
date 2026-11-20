import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { mathPresentation, MathBlockPresentation } from "../src/editor/extensions/math/presentation";
import { VariablePresentation } from "../src/editor/extensions/variable/presentation";
import { focusEditorDiagnostic } from "../src/scanner/navigation";
import { archiveSha256 } from "../src/utils/htx/import-model";
import { tableHeaderRowCount } from "../src/editor/plugins/table-border";

test("shared presentation preserves math fallback, equation numbers and variable formatting", () => {
  const invalid = mathPresentation("\\unknownCommand", true);
  expect(invalid.invalid).toBe(true);
  expect(invalid.html).toContain("\\unknownCommand");
  expect(invalid.html).toContain("#cc0000");
  expect(renderToStaticMarkup(createElement(MathBlockPresentation, { html: invalid.html, number: 7 }))).toContain("(7)");
  expect(renderToStaticMarkup(createElement(VariablePresentation, { value: "_contoh_ isi", mode: "upper" }))).toContain("<em>CONTOH</em>");
});

test("source navigation uses the recorded revision and position even when IDs repeat", async () => {
  const schema = new Schema({ nodes: { doc: { content: "paragraph+" }, text: {},
    paragraph: { content: "text*", attrs: { id: { default: "same" } } } } });
  const first = schema.node("paragraph", null, schema.text("first"));
  const doc = schema.node("doc", null, [first, schema.node("paragraph", null, schema.text("second"))]);
  const sourceRevision = await archiveSha256(new TextEncoder().encode(JSON.stringify(doc.toJSON())));
  let selected: number | undefined;
  const chain = { focus() { return this; }, setNodeSelection(from: number) { selected = from;return this; },
    scrollIntoView() { return this; }, run: () => true };
  const state = { doc };
  const editor = { isDestroyed: false, state, chain: () => chain } as unknown as Editor;
  const diagnostic = { code: "content.unresolved", severity: "warning" as const, pluginId: "pagination", message: "Missing value",
    chapterId: "doc.1", source: { chapterId: "doc.1", sourceRevision, from: first.nodeSize, to: doc.content.size, nodeId: "same" } };
  expect(await focusEditorDiagnostic(editor, diagnostic)).toBe(true);
  expect(selected).toBe(first.nodeSize);
  selected = undefined;
  state.doc = schema.node("doc", null, schema.node("paragraph", null, schema.text("edited")));
  expect(await focusEditorDiagnostic(editor, diagnostic)).toBe(false);
  expect(selected).toBeUndefined();
});

test("legacy figure headers include their rowspans without converting source cells", () => {
  const rows = [[{ header: false, rowspan: 2 }], [{ header: false, rowspan: 1 }], [{ header: false, rowspan: 1 }]];
  expect(tableHeaderRowCount(rows, true)).toBe(2);
  expect(tableHeaderRowCount(rows)).toBe(0);
  expect(rows[0][0].header).toBe(false);
});
