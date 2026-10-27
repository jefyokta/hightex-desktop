import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import {
  createScanContext,
  resolveDiagnosticTarget,
  runScan,
  type ScanDiagnostic,
} from "@hightex/scanner";
import {
  findPunctuationParagraph,
  encodeScannerDiagnostic,
  decodeScannerDiagnostic,
  scannerChapterRoute,
  SCANNER_DIAGNOSTIC_PREFIX,
} from "../src/scanner/navigation";
import { createSnapshot } from "../src/scanner/snapshot";
import type { Document } from "../src/editor/document";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: { group: "inline" },
    paragraph: {
      group: "block",
      content: "inline*",
      attrs: { id: { default: null } },
    },
    heading: {
      group: "block",
      content: "inline*",
      attrs: { id: { default: null }, level: { default: 1 } },
    },
    codeBlock: { group: "block", content: "text*" },
    bulletList: { group: "block", content: "listItem+" },
    listItem: { content: "paragraph block*" },
    table: { group: "block", content: "tableRow+" },
    tableRow: { content: "tableCell+" },
    tableCell: { content: "block+" },
    hardBreak: { inline: true, group: "inline" },
    refComponent: { inline: true, atom: true, group: "inline" },
    cite: { inline: true, atom: true, group: "inline" },
    variable: { inline: true, atom: true, group: "inline" },
    mathInline: { inline: true, atom: true, group: "inline" },
    dots: { inline: true, atom: true, group: "inline" },
  },
  marks: { code: {} },
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

async function scanDocument(doc: ReturnType<typeof schema.node>) {
  const source = {
    chapters: [
      {
        frozen: false,
        title: "Chapter",
        getId: () => "doc.1",
        getChapter: () => "1",
        query: { isAttachmentChapter: () => false },
        getContent: async () => doc.toJSON().content,
      },
    ],
  } as unknown as Document;
  return runScan(await createSnapshot(source));
}

test("scanner 0.2 ranges match live editor positions after inline atoms, code, hard breaks and UTF-16 text", async () => {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", { id: "target" }, [
      schema.text("  😀 "),
      schema.node("refComponent"),
      schema.node("cite"),
      schema.node("variable"),
      schema.node("mathInline"),
      schema.node("dots"),
      schema.text("code  ,text", [schema.mark("code")]),
      schema.node("hardBreak"),
      schema.text("Sisa  teks,lanjut!!"),
    ]),
  ]);
  const report = await scanDocument(doc);
  const issues = report.results.punctuation!;
  const diagnostics = report.diagnostics.filter(
    (item) => item.pluginId === "punctuation",
  );
  expect(issues).toHaveLength(3);
  for (const [index, diagnostic] of diagnostics.entries()) {
    expect(diagnostic.nodeId).toBe("target");
    const target = resolveDiagnosticTarget(doc, diagnostic)!;
    expect(doc.textBetween(target.from, target.to)).toBe(
      issues[index].excerpt.match,
    );
  }
});

test("node IDs keep a scanner target stable after preceding paragraphs are inserted", async () => {
  const original = schema.node("doc", null, [
    paragraph("target", "Two  spaces"),
  ]);
  const report = await scanDocument(original);
  const diagnostic = report.diagnostics.find(
    (item) => item.pluginId === "punctuation",
  )!;
  const updated = schema.node("doc", null, [
    paragraph("inserted", "Inserted text"),
    original.child(0),
  ]);
  const target = resolveDiagnosticTarget(updated, diagnostic)!;
  expect(target.path).toEqual([1]);
  expect(updated.textBetween(target.from, target.to)).toBe("  ");
  const replaced = schema.node("doc", null, [
    paragraph("other", "Two  spaces"),
  ]);
  expect(resolveDiagnosticTarget(replaced, diagnostic)).toBeUndefined();
});

test("ID-less attachment findings resolve by path and ranges that no longer fit are ignored", () => {
  const doc = schema.node("doc", null, [
    schema.node("heading", { level: 1 }, schema.text("Appendix")),
  ]);
  const heading: ScanDiagnostic = {
    pluginId: "unreferenced-figures",
    code: "unreferenced_figure",
    severity: "warning",
    message: "Lampiran A",
    chapterId: "doc.attachment",
    path: [0],
  };
  expect(resolveDiagnosticTarget(doc, heading)).toMatchObject({
    nodeType: "heading",
    from: 0,
    to: doc.child(0).nodeSize,
  });
  expect(
    resolveDiagnosticTarget(doc, { ...heading, range: { from: 0, to: 100 } }),
  ).toBeUndefined();
});

test("cross-chapter navigation keeps the full diagnostic and document version", () => {
  const diagnostic: ScanDiagnostic = {
    pluginId: "punctuation",
    code: "punctuation",
    severity: "warning",
    message: "Spasi ganda",
    chapterId: "doc.4.v1",
    nodeId: "p4",
    path: [2, 0],
    range: { from: 3, to: 5 },
    paragraph: 2,
  };
  expect(decodeScannerDiagnostic(encodeScannerDiagnostic(diagnostic))).toEqual(
    diagnostic,
  );
  expect(scannerChapterRoute(diagnostic.chapterId, "doc")).toBe(
    "/document/doc/4/v1",
  );
  expect(scannerChapterRoute("doc.attachment", "doc")).toBe(
    "/document/doc/attachment",
  );
  expect(scannerChapterRoute("other.1", "doc")).toBeUndefined();
  expect(scannerChapterRoute("doc", "doc")).toBeUndefined();
  expect(decodeScannerDiagnostic("figure-id")).toBeUndefined();
  expect(
    decodeScannerDiagnostic(SCANNER_DIAGNOSTIC_PREFIX + "invalid json"),
  ).toBeUndefined();
  expect(
    decodeScannerDiagnostic(
      encodeScannerDiagnostic({ ...diagnostic, path: {} as number[] }),
    ),
  ).toBeUndefined();
});
