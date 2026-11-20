import { expect, test } from "bun:test";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { Chapter } from "../src/editor/chapter";
import {
  FigureNumberPlugin,
  FigureNumberPluginKey,
} from "../src/editor/plugins/figure-number";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: {},
    heading: {
      group: "block",
      content: "text*",
      attrs: { level: { default: 1 } },
    },
    paragraph: { group: "block", content: "text*" },
    figcaption: { group: "block", content: "text*" },
    imageFigure: { group: "block", content: "figcaption" },
    figureTable: {
      group: "block",
      content: "figcaption (paragraph|figureTable)*",
    },
  },
});
const heading = () => schema.node("heading", null, schema.text("Heading"));
const caption = (text: string) =>
  schema.node("figcaption", null, schema.text(text));
const table = (text: string) => schema.node("figureTable", null, caption(text));
function labels(state: EditorState) {
  return FigureNumberPluginKey.getState(state)
    .find()
    .map(
      (item: { type: { attrs: { "data-label": string } } }) =>
        item.type.attrs["data-label"],
    );
}
function inChapter(name: string, run: () => void) {
  const previous = Chapter.instance;
  Chapter.instance = {
    getChapter: () => name,
    getId: () => `doc.${name}`,
    query: { isAttachmentChapter: () => name === "attachment" },
  } as unknown as Chapter;
  try {
    run();
  } finally {
    Chapter.instance = previous;
  }
}

test("caption labels exist at initialization and renumber after editing without storing labels", () => {
  inChapter("4", () => {
    const doc = schema.node("doc", null, [
      heading(),
      table("First"),
      schema.node("imageFigure", null, caption("Image")),
      table("Second"),
      caption("Orphan"),
    ]);
    const before = doc.toJSON();
    let state = EditorState.create({
      schema,
      doc,
      plugins: [FigureNumberPlugin],
    });
    expect(labels(state)).toEqual(["Tabel 4.1", "Gambar 4.1", "Tabel 4.2"]);
    expect(state.doc.toJSON()).toEqual(before);
    const start = state.doc.child(0).nodeSize;
    state = state.apply(
      state.tr.delete(start, start + state.doc.child(1).nodeSize),
    );
    expect(labels(state)).toEqual(["Gambar 4.1", "Tabel 4.1"]);
    expect(JSON.stringify(state.doc.toJSON())).not.toContain("data-label");
  });
});

test("appendix captions use the graph's letter prefix and document order for nested tables", () => {
  inChapter("attachment", () => {
    const doc = schema.node("doc", null, [
      heading(),
      table("Appendix A"),
      heading(),
      schema.node("figureTable", null, [caption("Outer B"), table("Nested B")]),
      schema.node("imageFigure", null, caption("Image B")),
    ]);
    const state = EditorState.create({
      schema,
      doc,
      plugins: [FigureNumberPlugin],
    });
    expect(labels(state)).toEqual([
      "Tabel A.1",
      "Tabel B.2",
      "Tabel B.3",
      "Gambar B.1",
    ]);
  });
});
