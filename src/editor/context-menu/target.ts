import type { Editor } from "@tiptap/core";
import type { Node as ModelNode, ResolvedPos } from "@tiptap/pm/model";
import { NodeSelection, Selection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export class EditorContextTarget {
  private constructor(
    readonly element: HTMLElement,
    readonly node: ModelNode,
    readonly position: number,
    private readonly resolved: ResolvedPos,
    private readonly caret: number,
  ) {}

  static resolve(view: EditorView, event: MouseEvent): EditorContextTarget | null {
    const element = event.target;
    if (!(element instanceof Element) || !view.dom.contains(element)) return null;
    if (element.closest("[data-editor-ui]")) return null;

    const position = view.posAtDOM(element, 0);
    const resolved = view.state.doc.resolve(position);
    const atom = resolved.nodeAfter;
    const node = atom?.isAtom && !atom.isText ? atom : resolved.parent;
    if (node === view.state.doc) return null;

    const nodePosition = node === atom ? position : resolved.before();
    const dom = view.nodeDOM(nodePosition);
    const caret = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
      ?? position;
    return new EditorContextTarget(
      dom instanceof HTMLElement ? dom : view.dom,
      node,
      nodePosition,
      resolved,
      caret,
    );
  }

  find(type: string): { node: ModelNode; position: number } | null {
    if (this.node.type.name === type)
      return { node: this.node, position: this.position };
    for (let depth = this.resolved.depth; depth > 0; depth--) {
      const node = this.resolved.node(depth);
      if (node.type.name === type)
        return { node, position: this.resolved.before(depth) };
    }
    return null;
  }

  select(editor: Editor) {
    const { state } = editor;
    if (!state.selection.empty && this.caret >= state.selection.from &&
      this.caret <= state.selection.to) return;

    const selection = this.node.isAtom
      ? NodeSelection.create(state.doc, this.position)
      : Selection.near(state.doc.resolve(this.caret));
    if (!state.selection.eq(selection))
      editor.view.dispatch(state.tr.setSelection(selection));
  }

  delete(editor: Editor) {
    const target = this.node.type.name === "image"
      ? this.find("imageFigure") ?? this
      : this;
    editor.view.dispatch(editor.state.tr.delete(
      target.position,
      target.position + target.node.nodeSize,
    ));
  }
}
