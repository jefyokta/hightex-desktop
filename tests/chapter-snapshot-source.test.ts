import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import { chapterSnapshotSource } from "../src/editor/chapter/snapshot-source";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: {
      content: "text*",
      attrs: { id: { default: "shared-extension-default" } },
    },
    text: {},
  },
});

test("unopened chapters get deterministic private IDs without rewriting supplied anchors", () => {
  const input = [
    { type: "paragraph", content: [{ type: "text", text: "First" }] },
    {
      type: "paragraph",
      attrs: { id: "authored" },
      content: [{ type: "text", text: "Second" }],
    },
  ];
  const before = JSON.stringify(input);
  const first = chapterSnapshotSource(schema, input, "chapter.2");
  expect(first.eq(chapterSnapshotSource(schema, input, "chapter.2"))).toBe(
    true,
  );
  expect(first.firstChild?.attrs.id).toBe("snapshot-chapter.2-0");
  expect(first.lastChild?.attrs.id).toBe("authored");
  expect(
    chapterSnapshotSource(schema, input, "chapter.3").firstChild?.attrs.id,
  ).not.toBe(first.firstChild?.attrs.id);
  expect(JSON.stringify(input)).toBe(before);
  expect(
    chapterSnapshotSource(schema, input, "other-scope", first).eq(first),
  ).toBe(true);
  const edited = first.type.create(null, [
    first.firstChild!,
    schema.node("paragraph", { id: "authored" }, schema.text("Changed")),
  ]);
  expect(
    chapterSnapshotSource(schema, input, "other-scope", edited).eq(edited),
  ).toBe(false);
  expect(() =>
    chapterSnapshotSource(schema, [{ type: "unknown" }], "chapter.1"),
  ).toThrow("Unsupported");
});

test("capturing legacy grids uses the same native table conversion as opening the editor", () => {
  const tables = new Schema({
    nodes: {
      doc: { content: "table+" },
      table: { content: "tableRow+" },
      tableRow: { content: "tableCell+" },
      tableCell: {
        content: "paragraph+",
        attrs: { colspan: { default: 1 }, rowspan: { default: 1 } },
      },
      paragraph: { content: "text*" },
      text: {},
    },
  });
  const input = [
    {
      type: "grid",
      content: [
        {
          type: "gridRow",
          content: [
            {
              type: "gridCell",
              attrs: { colspan: 2, rowspan: 3 },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Legacy table text" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ];
  const before = JSON.stringify(input);
  const source = chapterSnapshotSource(tables, input, "chapter");
  expect(source.firstChild?.type.name).toBe("table");
  expect(source.firstChild?.firstChild?.firstChild?.attrs).toMatchObject({
    colspan: 2,
    rowspan: 3,
  });
  expect(source.textContent).toBe("Legacy table text");
  expect(JSON.stringify(input)).toBe(before);
});
