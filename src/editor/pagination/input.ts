import { TextSelection, type EditorState, type PluginKey } from "@tiptap/pm/state";
import type { DecorationSet, EditorProps, EditorView } from "@tiptap/pm/view";

interface InputState {
  enabled: boolean;
  decorations: DecorationSet;
}

type GraphemeIntl = typeof Intl & {
  Segmenter: new (locale?: string, options?: { granularity: "grapheme" }) => {
    segment(text: string): { containing(index: number): { segment: string } | undefined };
  };
};
const graphemes = new (Intl as GraphemeIntl).Segmenter(undefined, { granularity: "grapheme" });

function notifyInput(view: EditorView, inputType: string, data: string | null) {
  // Keep the editor's normal input/commit listeners informed when the browser's
  // ambiguous editing around an uneditable widget is replaced by a transaction.
  view.dom.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data }));
}

export function paginationInputProps<State extends InputState>(key: PluginKey<State>): Pick<EditorProps, "handleDOMEvents" | "handleKeyDown"> {
  const nearBreak = (state: EditorState, from: number, to: number) => {
    const layout = key.getState(state);
    return layout?.enabled && layout.decorations
      .find(Math.max(0, from - 1), Math.min(state.doc.content.size, to + 1), (spec) => spec.paginationBreak === true)
      .some((item) => item.from >= from - 1 && item.from <= to + 1);
  };
  return {
    handleDOMEvents: {
      beforeinput(view, event) {
        const input = event as InputEvent;
        const { selection } = view.state;
        if (!input.cancelable || input.isComposing || view.composing ||
            input.inputType !== "insertText" || !input.data || /[\r\n]/.test(input.data) ||
            !(selection instanceof TextSelection) || !nearBreak(view.state, selection.from, selection.to)) return false;
        const insert = () => view.state.tr.insertText(input.data!, selection.from, selection.to).scrollIntoView();
        if (!view.someProp("handleTextInput", (handler) => handler(view, selection.from, selection.to, input.data!, insert)))
          view.dispatch(insert());
        input.preventDefault();
        notifyInput(view, "insertText", input.data);
        return true;
      },
    },
    handleKeyDown(view, event) {
      if (view.composing || event.altKey || event.ctrlKey || event.metaKey ||
          (event.key !== "Backspace" && event.key !== "Delete")) return false;
      const { selection } = view.state;
      if (!(selection instanceof TextSelection) || !selection.empty ||
          !nearBreak(view.state, selection.$from.start(), selection.$from.end())) return false;
      const { parent, parentOffset } = selection.$from;
      const backward = event.key === "Backspace";
      if (backward ? parentOffset === 0 : parentOffset === parent.content.size) return false;
      const text = backward
        ? parent.textBetween(0, parentOffset, "", "\ufffc")
        : parent.textBetween(parentOffset, parent.content.size, "", "\ufffc");
      const length = graphemes.segment(text).containing(backward ? text.length - 1 : 0)?.segment.length ?? 0;
      if (!length) return false;
      const from = backward ? selection.from - length : selection.from;
      const to = backward ? selection.to : selection.to + length;
      if (!nearBreak(view.state, from, to)) return false;
      view.dispatch(view.state.tr.delete(from, to).scrollIntoView());
      notifyInput(view, backward ? "deleteContentBackward" : "deleteContentForward", null);
      return true;
    },
  };
}
