import {
  TextSelection,
  type EditorState,
  type PluginKey,
} from "@tiptap/pm/state";
import type { DecorationSet, EditorProps, EditorView } from "@tiptap/pm/view";

interface InputState {
  enabled: boolean;
  decorations: DecorationSet;
}

type GraphemeIntl = typeof Intl & {
  Segmenter: new (
    locale?: string,
    options?: { granularity: "grapheme" },
  ) => {
    segment(text: string): {
      containing(index: number): { segment: string } | undefined;
    };
  };
};
const graphemes = new (Intl as GraphemeIntl).Segmenter(undefined, {
  granularity: "grapheme",
});
export class PaginationInput<State extends InputState> {
  constructor(private readonly key: PluginKey<State>) {}

  get props(): Pick<EditorProps, "handleDOMEvents" | "handleKeyDown"> {
    return {
      handleDOMEvents: { beforeinput: this.beforeInput.bind(this) },
      handleKeyDown: this.keyDown.bind(this),
    };
  }

  private nearBreak(state: EditorState, from: number, to: number) {
    const layout = this.key.getState(state);
    return (
      layout?.enabled &&
      layout.decorations
        .find(
          Math.max(0, from - 1),
          Math.min(state.doc.content.size, to + 1),
          (spec) => spec.paginationBreak === true,
        )
        .some((item) => item.from >= from - 1 && item.from <= to + 1)
    );
  }

  private notifyInput(
    view: EditorView,
    inputType: string,
    data: string | null,
  ) {
    // Keep the editor's normal input/commit listeners informed when the browser's
    // ambiguous editing around an uneditable widget is replaced by a transaction.
    view.dom.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType, data }),
    );
  }

  private beforeInput(view: EditorView, event: Event): boolean {
    const input = event as InputEvent;
    const { selection } = view.state;
    if (
      !input.cancelable ||
      input.isComposing ||
      view.composing ||
      input.inputType !== "insertText" ||
      !input.data ||
      /[\r\n]/.test(input.data) ||
      !(selection instanceof TextSelection) ||
      !this.nearBreak(view.state, selection.from, selection.to)
    )
      return false;
    const insert = () =>
      view.state.tr
        .insertText(input.data!, selection.from, selection.to)
        .scrollIntoView();
    if (
      !view.someProp("handleTextInput", (handler) =>
        handler(view, selection.from, selection.to, input.data!, insert),
      )
    )
      view.dispatch(insert());
    input.preventDefault();
    this.notifyInput(view, "insertText", input.data);
    return true;
  }

  private keyDown(view: EditorView, event: KeyboardEvent): boolean {
    if (
      view.composing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return false;
    if (event.key === "ArrowUp" || event.key === "ArrowDown")
      return this.verticalArrow(view, event);
    if (event.key !== "Backspace" && event.key !== "Delete") return false;
    const { selection } = view.state;
    if (
      !(selection instanceof TextSelection) ||
      !selection.empty ||
      !this.nearBreak(
        view.state,
        selection.$from.start(),
        selection.$from.end(),
      )
    )
      return false;
    const { parent, parentOffset } = selection.$from;
    const backward = event.key === "Backspace";
    if (backward ? parentOffset === 0 : parentOffset === parent.content.size)
      return false;
    const text = backward
      ? parent.textBetween(0, parentOffset, "", "\ufffc")
      : parent.textBetween(parentOffset, parent.content.size, "", "\ufffc");
    const length =
      graphemes.segment(text).containing(backward ? text.length - 1 : 0)
        ?.segment.length ?? 0;
    if (!length) return false;
    const from = backward ? selection.from - length : selection.from;
    const to = backward ? selection.to : selection.to + length;
    if (!this.nearBreak(view.state, from, to)) return false;
    view.dispatch(view.state.tr.delete(from, to).scrollIntoView());
    this.notifyInput(
      view,
      backward ? "deleteContentBackward" : "deleteContentForward",
      null,
    );
    return true;
  }

  private verticalArrow(view: EditorView, event: KeyboardEvent): boolean {
    const { selection } = view.state;
    const layout = this.key.getState(view.state);
    if (!layout?.enabled || !(selection instanceof TextSelection) ||
        (!selection.empty && !event.shiftKey)) return false;
    const down = event.key === "ArrowDown";
    const caret = view.coordsAtPos(selection.head, down ? -1 : 1);
    const breaks = layout.decorations.find(
      selection.$head.start(), selection.$head.end(),
      spec => spec.paginationBreak === true,
    );
    for (const gap of breaks) {
      if (gap.from !== gap.to) continue; // Block margins keep native navigation.
      if (down ? selection.head >= gap.from : selection.head < gap.from) continue;
      const before = view.coordsAtPos(gap.from - 1, -1);
      const after = view.coordsAtPos(gap.from, 1);
      const adjacent = down ? before : after;
      if (Math.abs(caret.top - adjacent.top) > 1) continue;
      const target = down ? after : before;
      const hit = view.posAtCoords({
        left: caret.left,
        top: (target.top + target.bottom) / 2,
      });
      if (!hit || (down ? hit.pos < gap.from : hit.pos >= gap.from)) continue;
      // Chromium can skip the remaining paragraph around a tall uneditable
      // inline widget. Resolve only this crossing on the adjacent text line.
      view.dispatch(view.state.tr.setSelection(TextSelection.create(
        view.state.doc, event.shiftKey ? selection.anchor : hit.pos, hit.pos,
      )).scrollIntoView());
      return true;
    }
    return false;
  }
}
