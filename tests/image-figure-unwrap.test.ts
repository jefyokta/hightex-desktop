import { expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { history, redo, undo } from "@tiptap/pm/history";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { ChapterExtensions } from "../src/editor/chapter/chapter-extensions";
import { unwrapImageFigure } from "../src/editor/extensions/image-figure/unwrap";

const schema = getSchema(ChapterExtensions.contentSchema("attachment"));
const image = schema.nodes.image.create({
  id: "image-kept",
  src: "stored-image",
  width: 315,
});
const caption = schema.nodes.figcaption.create({ id: "caption-kept" }, [
  schema.text("Caption", [schema.marks.italic.create()]),
  schema.nodes.hardBreak.create(),
  schema.text("continued"),
]);
const figure = schema.nodes.imageFigure.create(
  { id: "figure", figureId: "figure-reference" },
  [image, caption],
);

test.each([0, 1])(
  "unwrapping from position %i removes the caption and keeps the image; undo restores both",
  position => {
    const doc = schema.nodes.doc.create(null, [
      figure,
      schema.nodes.paragraph.create(null, schema.text("After")),
    ]);
    const before = doc.toJSON();
    let state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 7, 4),
      plugins: [history()],
    });
    const tr = unwrapImageFigure(state, position)!;
    state = state.apply(tr);
    state.doc.check();

    expect(state.doc.child(0).eq(image)).toBe(true);
    expect(state.doc.childCount).toBe(2);
    expect(state.doc.child(1).eq(doc.child(1))).toBe(true);
    expect(state.doc.textContent).toBe("After");
    expect(doc.toJSON()).toEqual(before);

    const unwrapped = state.doc;
    expect(undo(state, transaction => { state = state.apply(transaction); })).toBe(true);
    expect(state.doc.eq(doc)).toBe(true);
    expect([state.selection.anchor, state.selection.head]).toEqual([7, 4]);
    expect(redo(state, transaction => { state = state.apply(transaction); })).toBe(true);
    expect(state.doc.eq(unwrapped)).toBe(true);
    expect(state.doc.textContent).not.toContain("Caption");
  },
);

test("unwrapping an empty caption adds no empty paragraph", () => {
  const emptyFigure = schema.nodes.imageFigure.create(null, [
    image,
    schema.nodes.figcaption.create(),
  ]);
  const state = EditorState.create({
    doc: schema.nodes.doc.create(null, emptyFigure),
  });
  const result = state.apply(unwrapImageFigure(state, 0)!);
  result.doc.check();
  expect(result.doc.childCount).toBe(1);
  expect(result.doc.firstChild?.eq(image)).toBe(true);
});

test("unwrapping inside a list preserves the surrounding list and paragraphs", () => {
  const paragraph = schema.nodes.paragraph.create(null, schema.text("Item"));
  const item = schema.nodes.listItem.create(null, [paragraph, figure]);
  const state = EditorState.create({
    doc: schema.nodes.doc.create(null, schema.nodes.bulletList.create(null, item)),
  });
  const position = 2 + paragraph.nodeSize;
  const result = state.apply(unwrapImageFigure(state, position + 1)!);
  result.doc.check();
  const resultItem = result.doc.firstChild!.firstChild!;
  expect(result.doc.firstChild?.type.name).toBe("bulletList");
  expect(resultItem.child(0).eq(paragraph)).toBe(true);
  expect(resultItem.child(1).eq(image)).toBe(true);
  expect(resultItem.childCount).toBe(2);
});

test("plain images and detached controls do not produce a transaction", () => {
  const state = EditorState.create({
    doc: schema.nodes.doc.create(null, image),
  });
  expect(unwrapImageFigure(state, 0)).toBeNull();
  expect(unwrapImageFigure(state, undefined)).toBeNull();
});
