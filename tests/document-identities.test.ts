import { expect, test } from "bun:test";
import type { Editor, JSONContent } from "@tiptap/core";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { history, undo, undoDepth } from "@tiptap/pm/history";
import { normalizeDocumentIdentities } from "../src/editor/document/normalize-identities";
import { ensureUniqueId } from "../src/editor/extensions/uuid/normalize-editor";
import { NodeIdentityAllocator } from "../src/editor/extensions/uuid/identity";

const paragraph = (id: string, text = "Authored text"): JSONContent => ({
  type: "paragraph",
  attrs: { id, shouldUnique: true },
  content: [{ type: "text", text }],
});

test("document normalization repairs unopened chapters, preserves first targets and is idempotent", () => {
  const input = [
    { id: "doc.1", content: [paragraph("shared"), paragraph("123:legacy")] },
    {
      id: "doc.2",
      content: [
        paragraph("shared"),
        { type: "refComponent", attrs: { link: "shared", ref: "head" } },
        { type: "refComponent", attrs: { link: "123:legacy", ref: "head" } },
      ],
    },
  ];
  const before = structuredClone(input);
  let serial = 0;
  const result = normalizeDocumentIdentities(input, () => String(++serial));
  expect(input).toEqual(before);
  expect(result[0].content[0].attrs?.id).toBe("shared");
  expect(result[1].content[0].attrs?.id).not.toBe("shared");
  expect(result[1].content[1].attrs?.link).toBe("shared");
  expect(result[1].content[2].attrs?.link).toBe(result[0].content[1].attrs?.id);
  expect(result[0].content[0].content).toEqual(input[0].content[0].content);
  expect(
    normalizeDocumentIdentities(result, () => {
      throw Error("Unexpected rotation");
    }),
  ).toEqual(result);
});

test("replacement allocation cannot steal an ID from a later node or another chapter", () => {
  const suffixes = ["future", "other", "free"];
  const allocator = new NodeIdentityAllocator(
    new Set(["paragraph-other"]),
    ["paragraph-future"],
    () => suffixes.shift()!,
  );
  expect(allocator.assign("paragraph", undefined)).toBe("paragraph-free");
  expect(allocator.assign("paragraph", "paragraph-future")).toBe(
    "paragraph-future",
  );
  expect(allocator.reference("paragraph-other")).toBe("paragraph-other");
});

test("editor normalization preserves selection, text and the edit undo history", () => {
  const schema = new Schema({
    nodes: {
      doc: { content: "paragraph+" },
      paragraph: {
        content: "text*",
        attrs: { id: { default: null }, shouldUnique: { default: true } },
      },
      text: {},
    },
  });
  let state = EditorState.create({
    schema,
    doc: schema.nodeFromJSON({
      type: "doc",
      content: [paragraph("unopened-chapter-id", "Start")],
    }),
    plugins: [history()],
  });
  state = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, 3)).insertText("x"),
  );
  const selection = state.selection.toJSON(),
    text = state.doc.textContent;
  const editor = {
    get state() {
      return state;
    },
    view: {
      dispatch(transaction: EditorState["tr"]) {
        state = state.apply(transaction);
      },
    },
  } as unknown as Editor;
  const ids = ensureUniqueId(editor, new Set(["unopened-chapter-id"]));
  expect(ids.has("unopened-chapter-id")).toBe(false);
  expect(state.doc.textContent).toBe(text);
  expect(state.selection.toJSON()).toEqual(selection);
  expect(undoDepth(state)).toBe(1);
  const normalized = state.doc;
  ensureUniqueId(editor, new Set(["unopened-chapter-id"]));
  expect(state.doc).toBe(normalized);
  expect(
    undo(state, (transaction) => {
      state = state.apply(transaction);
    }),
  ).toBe(true);
  expect(state.doc.textContent).toBe("Start");
  expect(state.doc.firstChild?.attrs.id).not.toBe("unopened-chapter-id");
});

test("live and stored normalization agree on IDs without shouldUnique and explicit opt-outs", () => {
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      text: {},
      blockMath: {
        group: "block",
        atom: true,
        attrs: { id: { default: null } },
      },
      decoration: {
        group: "block",
        atom: true,
        attrs: {
          id: { default: null },
          shouldUnique: { default: false },
        },
      },
      refComponent: {
        group: "block",
        atom: true,
        attrs: { link: { default: null } },
      },
    },
  });
  const content: JSONContent[] = [
    { type: "blockMath", attrs: { id: "equation-first" } },
    { type: "blockMath", attrs: { id: "equation-first" } },
    { type: "blockMath", attrs: { id: "equation-in-other-chapter" } },
    { type: "decoration", attrs: { id: "opt-out", shouldUnique: false } },
    { type: "decoration", attrs: { id: "opt-out", shouldUnique: false } },
    { type: "refComponent", attrs: { link: "equation-first" } },
    { type: "refComponent", attrs: { link: "equation-in-other-chapter" } },
  ];
  let state = EditorState.create({
    schema,
    doc: schema.nodeFromJSON({ type: "doc", content }),
  });
  const editor = {
    get state() {
      return state;
    },
    view: {
      dispatch(tr: EditorState["tr"]) {
        state = state.apply(tr);
      },
    },
  } as unknown as Editor;
  const reserved = new Set(["equation-in-other-chapter"]);
  const ids = ensureUniqueId(editor, reserved);
  const live: JSONContent[] = state.doc.toJSON().content;
  expect(live[0].attrs?.id).toBe("equation-first");
  expect(live[1].attrs?.id).not.toBe("equation-first");
  expect(live[2].attrs?.id).not.toBe("equation-in-other-chapter");
  expect(live.slice(3, 5).map((node) => node.attrs?.id)).toEqual([
    "opt-out",
    "opt-out",
  ]);
  expect(live[5].attrs?.link).toBe("equation-first");
  expect(live[6].attrs?.link).toBe("equation-in-other-chapter");
  expect(ids.size).toBe(3);
  expect(ids.has("opt-out")).toBe(false);
  const before = state.doc;
  ensureUniqueId(editor, reserved);
  expect(state.doc).toBe(before);
  // Saved maintenance uses the same eligibility rule and does not rotate again.
  expect(
    normalizeDocumentIdentities([{ id: "doc.1", content: live }])[0].content,
  ).toEqual(live);
});
