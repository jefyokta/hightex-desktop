import { expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { EditorState, Plugin, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { ChapterExtensions } from "../src/editor/chapter/chapter-extensions";
import { CutClipboard } from "../src/editor/extensions/clipboard/cut-clipboard";

function fixture(appendRepair = false) {
  const schema = getSchema(ChapterExtensions.contentSchema("1"));
  const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  const table = { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [p("CELL")] }] }] };
  const figure = { type: "figureTable", content: [{ type: "figcaption", content: [{ type: "text", text: "CAPTION" }] }, table] };
  const list = { type: "orderedList", attrs: { start: 7 }, content: ["LIST A", "LIST B"].map(text => ({ type: "listItem", content: [p(text)] })) };
  const source = schema.nodeFromJSON({ type: "doc", content: [p("BEFORE"), list, { type: "horizontalRule" }, figure] });
  let from = 0, to = 0;
  source.descendants((node, pos) => {
    if (node.type.name === "paragraph" && node.textContent === "LIST A") from = pos + 1;
    if (node.type.name === "figcaption") to = pos + node.nodeSize - 1;
  });
  const clipboard = new CutClipboard(), data = new Map<string, string>();
  const repair = new Plugin({ appendTransaction: (transactions, _old, current) => {
    if (!transactions.some(transaction => transaction.getMeta("uiEvent") === "cut")) return null;
    let position: number | undefined;
    current.doc.descendants((node, pos) => { if (node.type.name === "figcaption" && node.attrs.id !== "after-cut-repair") position = pos; });
    return position === undefined ? null : current.tr.setNodeMarkup(position, undefined, { ...current.doc.nodeAt(position)!.attrs, id: "after-cut-repair" });
  } });
  let state = EditorState.create({ doc: source, plugins: [clipboard.plugin, ...(appendRepair ? [repair] : [])] });
  state = state.apply(state.tr.setSelection(TextSelection.create(source, from, to)));
  const view = {
    get state() { return state; }, editable: true,
    dispatch: (transaction: typeof state.tr) => { state = state.applyTransaction(transaction).state; },
    serializeForClipboard: () => ({ dom: { innerHTML: "<p>CLIPBOARD</p>" }, text: "CLIPBOARD" }),
  } as unknown as EditorView;
  const event = { preventDefault() {}, clipboardData: { clearData: () => data.clear(), setData: (type: string, value: string) => data.set(type, value), getData: (type: string) => data.get(type) ?? "" } } as unknown as ClipboardEvent;
  const cut = () => clipboard.plugin.props.handleDOMEvents!.cut!.call(clipboard.plugin, view, event);
  const paste = () => clipboard.plugin.props.handlePaste!.call(clipboard.plugin, view, event, view.state.selection.content());
  return { schema, source, view, event, cut, paste, data };
}

test("cut/paste at a mixed list/caption origin restores the exact source instead of re-fitting into a caption", () => {
  const f = fixture();
  const slice = f.view.state.selection.content();
  const nativeCut = f.view.state.apply(f.view.state.tr.deleteSelection());
  expect(nativeCut.apply(nativeCut.tr.replaceSelection(slice)).doc.eq(f.source)).toBe(false);
  expect(f.cut()).toBe(true);
  expect(f.view.state.doc.eq(f.source)).toBe(false);
  expect(f.paste()).toBe(true);
  expect(f.view.state.doc.eq(f.source)).toBe(true);
});

test("external clipboard data, edits and moved selections do not restore a stale cut document", () => {
  const external = fixture();external.cut();external.data.clear();expect(external.paste()).toBe(false);
  const changed = fixture();changed.cut();changed.view.dispatch(changed.view.state.tr.insertText("NEW"));expect(changed.paste()).toBe(false);
  const moved = fixture();moved.cut();moved.view.dispatch(moved.view.state.tr.setSelection(TextSelection.atStart(moved.view.state.doc)));expect(moved.paste()).toBe(false);
  const composing = fixture();composing.cut();Object.defineProperty(composing.view, "composing", { value: true });expect(composing.paste()).toBe(false);
});

test("undoing paste can return to the cut origin and paste the same source again", () => {
  const f = fixture();f.cut();
  const cut = f.view.state;
  expect(f.paste()).toBe(true);
  const undo = f.view.state.tr.replaceWith(0, f.view.state.doc.content.size, cut.doc.content);
  undo.setSelection(TextSelection.create(undo.doc, cut.selection.from, cut.selection.to));
  f.view.dispatch(undo);
  expect(f.view.state.doc.eq(cut.doc)).toBe(true);
  expect(f.paste()).toBe(true);
  expect(f.view.state.doc.eq(f.source)).toBe(true);
});

test("the cut origin includes appended transaction repairs before paste", () => {
  const f = fixture(true);f.cut();
  expect(f.view.state.doc.toJSON().content[1].content[0].attrs.id).toBe("after-cut-repair");
  expect(f.paste()).toBe(true);
  expect(f.view.state.doc.eq(f.source)).toBe(true);
});

test("schema rendering never allocates an anchor absent from the source identity", () => {
  const { schema } = fixture();
  for (const type of [schema.nodes.paragraph, schema.nodes.horizontalRule]) {
    const node = type.create();
    const output = type.spec.toDOM!(node) as [string, Record<string, unknown>];
    expect(output[1].id).toBeFalsy();
    const named = type.create({ id: "authored-owner" });
    expect((type.spec.toDOM!(named) as [string, Record<string, unknown>])[1].id).toBe("authored-owner");
  }
});
