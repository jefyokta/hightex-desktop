import { afterEach, expect, test } from "bun:test";
import { Editor, type JSONContent } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { ChapterExtensions } from "../src/editor/chapter/chapter-extensions";
import { ContextMenuActions } from "../src/editor/context-menu/actions";
import { NodeAction } from "../src/editor/context-menu/node-action";
import { DefaultNodeAction } from "../src/editor/context-menu/actions/default-node-action";
import type { ContextMenuActionProvider, ContextMenuContext } from "../src/editor/context-menu/contracts";
import { setCurrentLanguage, t } from "../src/utils/lang";

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach(editor => editor.destroy());
  setCurrentLanguage("en");
});

const paragraph: JSONContent = { type: "paragraph", content: [{ type: "text", text: "Text" }] };
const table: JSONContent = { type: "table", content: [
  { type: "tableRow", content: [
    { type: "tableCell", content: [paragraph] },
    { type: "tableCell", content: [paragraph] },
  ] },
] };

function context(content: JSONContent[]): ContextMenuContext {
  const editor = new Editor({
    element: null,
    extensions: ChapterExtensions.contentSchema("attachment"),
    content: { type: "doc", content },
  });
  editors.push(editor);
  return {
    editor,
    target: { node: editor.state.doc.firstChild!, find: () => null, delete: () => {} },
  };
}

test("the provider contract allows extensions and preserves order while skipping unsupported actions", () => {
  const current = context([paragraph]);
  class NamedActions implements ContextMenuActionProvider {
    constructor(private readonly label: string, private readonly enabled = true) {}
    supports() { return this.enabled; }
    items(received: ContextMenuContext) {
      expect(received).toBe(current);
      if (!this.enabled) throw Error("Unsupported provider must not build actions");
      return [{ label: this.label, onClick() {} }];
    }
  }
  const actions = new ContextMenuActions([
    new NamedActions("first"), new NamedActions("skipped", false), new NamedActions("last"),
  ]);
  expect(actions.collect(current).map(action => action.label)).toEqual(["first", "last", t("editor.context_menu.delete")]);
});

test("a new node action inherits matching from the parent without changing the registry", () => {
  class ParagraphAction extends NodeAction {
    protected readonly nodeType = "paragraph";
    public items() { return [{ label: "Paragraph action", onClick() {} }]; }
  }
  const actions = new ContextMenuActions([new ParagraphAction()]);
  expect(actions.collect(context([paragraph])).map(item => item.label)).toEqual(["Paragraph action", t("editor.context_menu.delete")]);
  expect(actions.collect(context([
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Heading" }] },
  ])).map(item => item.label)).toEqual([t("editor.context_menu.delete")]);
});

test("table actions do not leak into paragraph and image menus", () => {
  const actions = new ContextMenuActions();
  expect(actions.collect(context([paragraph])).map(item => item.label)).toEqual([t("editor.context_menu.delete")]);
  const current = context([{ type: "image", attrs: { src: "stored-image", width: 200 } }, paragraph]);
  const owner = current.editor;
  owner.view.updateState(owner.state.apply(owner.state.tr.setSelection(NodeSelection.create(owner.state.doc, 0))));
  let deleted = false;
  const items = actions.collect({
    ...current,
    target: { ...current.target, delete(editor) { expect(editor).toBe(owner); deleted = true; } },
  });
  expect(items.map(item => item.label)).toEqual([t("editor.context_menu.delete_image")]);
  items[0].onClick();
  expect(deleted).toBe(true);
});

test("one collection reads the current selection and language instead of caching a menu", () => {
  const current = context([
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Heading" }] },
    paragraph,
  ]);
  const actions = new ContextMenuActions();
  const editor = current.editor;
  expect(actions.collect(current).some(item => item.label === t("editor.context_menu.heading_3"))).toBe(true);
  setCurrentLanguage("id");
  expect(actions.collect(current)[0].label).toBe("Paragraf");
  const position = editor.state.doc.firstChild!.nodeSize + 1;
  editor.view.updateState(editor.state.apply(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, position))));
  expect(actions.collect(current).map(item => item.label)).toEqual([t("editor.context_menu.delete")]);
});

test("table cell actions retain capability checks and execute the actual table command", () => {
  const current = context([table, paragraph]);
  const editor = current.editor;
  const actions = new ContextMenuActions().collect(current);
  expect(actions.find(item => item.label === t("editor.context_menu.split_cell"))?.disabled).toBe(true);
  const add = actions.find(item => item.label === t("editor.context_menu.add_row_after"))!;
  add.onClick();
  expect(editor.state.doc.firstChild?.childCount).toBe(2);
  editor.state.doc.check();
});

test("table figures retain their own deletion action without a second delete-table item", () => {
  const current = context([
    { type: "figureTable", content: [{ type: "figcaption" }, table] },
    paragraph,
  ]);
  const editor = current.editor;
  let cell = -1;
  editor.state.doc.descendants((node, position) => {
    if (cell < 0 && node.type.name === "paragraph") cell = position + 1;
  });
  editor.view.updateState(editor.state.apply(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, cell))));
  const actions = new ContextMenuActions().collect(current);
  expect(actions.filter(item => item.label === t("editor.context_menu.delete_figure_table"))).toHaveLength(1);
  expect(actions.some(item => item.label === t("editor.context_menu.delete_grid"))).toBe(false);
});

test.each(["bulletList", "orderedList"])("%s keeps list item actions through its node action class", type => {
  const current = context([{ type, content: [{ type: "listItem", content: [paragraph] }] }]);
  const actions = new ContextMenuActions().collect(current);
  expect(actions.map(item => item.label)).toEqual([
    t("editor.context_menu.outdent_item"),
    t("editor.context_menu.indent_item"),
    t("editor.context_menu.toggle_bullet_list"),
    t("editor.context_menu.toggle_ordered_list"),
    t("editor.context_menu.delete"),
  ]);
  expect(actions[1].disabled).toBe(true);
});

test("an image in a figure uses the figure action instead of standalone image deletion", () => {
  const current = context([
    { type: "imageFigure", content: [
      { type: "image", attrs: { src: "stored-image", width: 310 } },
      { type: "figcaption", content: [{ type: "text", text: "Caption" }] },
    ] },
    paragraph,
  ]);
  const figure = current.editor.state.doc.firstChild!;
  const actions = new ContextMenuActions().collect({
    ...current,
    target: { ...current.target, node: figure.firstChild!, find: type => type === "imageFigure" ? { node: figure, position: 0 } : null },
  });
  expect(actions.map(item => item.label)).toEqual([t("editor.inline.unwrap_figure"), t("editor.context_menu.delete")]);
  actions[0].onClick();
  expect(current.editor.state.doc.firstChild?.eq(figure.firstChild!)).toBe(true);
  expect(current.editor.state.doc.childCount).toBe(2);
});

test.each(["blockMath", "mathInline"])("%s resolves its own action and deletes only the selected equation", type => {
  const math = { type, attrs: { latex: "x^2" } };
  const current = context(type === "blockMath"
    ? [math, paragraph]
    : [{ type: "paragraph", content: [math, { type: "text", text: "After" }] }]);
  const editor = current.editor;
  const position = type === "blockMath" ? 0 : 1;
  editor.view.updateState(editor.state.apply(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, position))));
  const actions = new ContextMenuActions().collect({
    ...current, target: { ...current.target, node: editor.state.doc.nodeAt(position)! },
  });
  expect(actions.map(item => item.label)).toEqual([t("editor.context_menu.delete_math")]);
  actions[0].onClick();
  expect(editor.state.doc.textContent).toBe(type === "blockMath" ? "Text" : "After");
  editor.state.doc.check();
});

test("nodes without a specific provider receive default deletion delegated to the clicked target", () => {
  const current = context([paragraph]);
  let deleted = false;
  const actions = new ContextMenuActions().collect({
    ...current,
    target: { ...current.target, delete(editor) { expect(editor).toBe(current.editor); deleted = true; } },
  });
  expect(actions.map(item => item.key)).toEqual(["delete-node"]);
  actions[0].onClick();
  expect(deleted).toBe(true);
});

test("default deletion keeps selected-text behavior instead of deleting the entire node", () => {
  const current = context([paragraph]);
  const editor = current.editor;
  editor.view.updateState(editor.state.apply(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2, 4))));
  const actions = new ContextMenuActions().collect({
    ...current, target: { ...current.target, delete() { throw Error("Must delete selected text only"); } },
  });
  actions.find(item => item.key === "delete-node")!.onClick();
  expect(editor.state.doc.textContent).toBe("Tt");
  expect(editor.state.doc.childCount).toBe(1);
});

test("a dangerous custom action does not suppress unrelated global defaults", () => {
  class CustomParagraphAction extends NodeAction {
    protected readonly nodeType = "paragraph";
    public items() { return [{ key: "custom-danger", label: "Custom", danger: true, onClick() {} }]; }
  }
  const actions = new ContextMenuActions([new CustomParagraphAction()]).collect(context([paragraph]));
  expect(actions.map(item => item.key)).toEqual(["custom-danger", "delete-node"]);
});

test("default preview uses the source ID and the supplied host callback", () => {
  const current = context([{ ...paragraph, attrs: { id: "paragraph-source" } }]);
  const calls: string[] = [];
  const actions = new ContextMenuActions().collect({ ...current, preview: id => calls.push(id) });
  expect(actions.map(item => item.key)).toEqual(["preview-node", "delete-node"]);
  actions[0].onClick();
  expect(calls).toEqual(["paragraph-source"]);
});

test("specific delete replaces only its default while additional shared actions remain", () => {
  class GlobalActions extends DefaultNodeAction {
    public items(current: ContextMenuContext) {
      return [...super.items(current), { key: "copy-node", label: "Copy", onClick() {} }];
    }
  }
  const current = context([{ type: "image", attrs: { src: "stored-image" } }, paragraph]);
  const actions = new ContextMenuActions(undefined, new GlobalActions()).collect(current);
  expect(actions.map(item => item.key)).toEqual(["delete-node", "copy-node"]);
  expect(actions[0].label).toBe(t("editor.context_menu.delete_image"));
});
