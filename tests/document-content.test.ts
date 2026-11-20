import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import { assertSupportedContent } from "../src/utils/document-content";
import { ContentFixer } from "../src/utils/content-fixer";
import { mmToPx, pxToMm } from "../src/utils/units";

test("removed blockquotes reject before repair can discard nested source content", () => {
  const content = [
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "blockquote",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Keep <literal> text and tables intact.",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];
  const before = JSON.stringify(content);
  const schema = new Schema({
    nodes: {
      doc: { content: "paragraph*" },
      paragraph: { content: "text*" },
      text: {},
    },
  });
  expect(() => assertSupportedContent(content)).toThrow(
    "Unsupported document node: blockquote",
  );
  expect(() => ContentFixer(content, schema)).toThrow(
    "Unsupported document node: blockquote",
  );
  expect(JSON.stringify(content)).toBe(before);
  expect(() =>
    assertSupportedContent([null, { type: "paragraph" }]),
  ).not.toThrow();
  expect(() =>
    assertSupportedContent([
      { type: "paragraph", content: [{ type: "text", text: "Supported" }] },
    ]),
  ).not.toThrow();
});

test("layout units convert both directions without rounding until the presentation boundary", () => {
  expect(mmToPx(25.4)).toBeCloseTo(96, 10);
  expect(pxToMm(96)).toBeCloseTo(25.4, 10);
  const millimetres = 12.3456789;
  expect(pxToMm(mmToPx(millimetres))).toBeCloseTo(millimetres, 10);
});

test("reopening list content preserves authored identities and nested attributes", () => {
  const identity = { id: { default: null }, shouldUnique: { default: true } };
  const schema = new Schema({ nodes: {
    doc: { content: "block+" }, text: { group: "inline" },
    paragraph: { group: "block", content: "inline*", attrs: identity },
    orderedList: { group: "block", content: "listItem+", attrs: { ...identity, start: { default: 1 } } },
    listItem: { content: "paragraph block*", attrs: identity },
  } });
  const source = schema.node("doc", null, schema.node("orderedList", { id: "list", start: 4 },
    schema.node("listItem", { id: "item" }, [schema.node("paragraph", { id: "body" }, schema.text("Preserved")),
      schema.node("orderedList", { id: "nested-list" }, schema.node("listItem", { id: "nested-item" },
        schema.node("paragraph", { id: "nested-body" }, schema.text("Nested"))))]))).toJSON();
  const before = structuredClone(source);
  expect(schema.nodeFromJSON(ContentFixer(source, schema)).toJSON()).toEqual(before);
  expect(source).toEqual(before);
});
