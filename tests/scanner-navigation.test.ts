import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import { createScanContext, runScan } from "@hightex/scanner";
import { findPunctuationParagraph } from "../src/scanner/navigation";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: { group: "inline" },
    paragraph: {
      group: "block",
      content: "inline*",
      attrs: { id: { default: null } },
    },
    heading: { group: "block", content: "inline*" },
    codeBlock: { group: "block", content: "text*" },
    bulletList: { group: "block", content: "listItem+" },
    listItem: { content: "paragraph block*" },
    table: { group: "block", content: "tableRow+" },
    tableRow: { content: "tableCell+" },
    tableCell: { content: "block+" },
  },
});

const paragraph = (id: string, text?: string) =>
  schema.node("paragraph", { id }, text ? schema.text(text) : undefined);

test("punctuation navigation matches scanner numbering across empty, list and table paragraphs", async () => {
  const doc = schema.node("doc", null, [
    schema.node("heading", null, schema.text("Chapter heading")),
    paragraph("empty"),
    schema.node("codeBlock", null, schema.text("Ignore  this , code")),
    paragraph("plain", "Plain  text"),
    schema.node("bulletList", null, [
      schema.node("listItem", null, [
        paragraph("list", "List  text"),
        schema.node("bulletList", null, [
          schema.node("listItem", null, paragraph("nested", "Nested  text")),
        ]),
      ]),
    ]),
    schema.node("table", null, [
      schema.node("tableRow", null, [
        schema.node("tableCell", null, paragraph("cell", "Cell  text")),
      ]),
    ]),
  ]);
  const report = await runScan(
    createScanContext({
      chapters: [{ id: "doc.1", content: doc.toJSON().content }],
    }),
  );
  const issues = report.results.punctuation ?? [];
  expect(issues.map((issue) => issue.paragraph)).toEqual([2, 3, 4, 5]);
  expect(
    issues.map((issue) => {
      const position = findPunctuationParagraph(doc, issue.paragraph);
      expect(position).toBeDefined();
      return doc.resolve(position!).parent.attrs.id;
    }),
  ).toEqual(["plain", "list", "nested", "cell"]);
  expect(doc.resolve(findPunctuationParagraph(doc, 1)!).parent.attrs.id).toBe(
    "empty",
  );
});

test.each([0, -1, 1.5, NaN, Infinity, 2])(
  "punctuation navigation ignores invalid or missing paragraph %s",
  (index) => {
    const doc = schema.node("doc", null, paragraph("only", "Text"));
    expect(findPunctuationParagraph(doc, index)).toBeUndefined();
  },
);
