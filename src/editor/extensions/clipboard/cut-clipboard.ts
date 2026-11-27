import { Plugin, Selection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { Node as ModelNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { uniqId } from "@/utils/uniq-id";

const cutFormat = "application/x-hightex-cut";

interface CutOrigin {
  token: string;
  source: ModelNode;
  after: ModelNode;
  selection: Selection;
  end: number;
}

/** Own one same-editor cut origin; other clipboard operations keep native fitting. */
export class CutClipboard {
  private origin?: CutOrigin;

  readonly plugin = new Plugin({
    state: {
      init: () => null,
      apply: (transaction, _value, previous, next) => {
        this.changed(transaction, previous, next);
        return null;
      },
    },
    props: {
      handleDOMEvents: {
        copy: () => { this.origin = undefined; return false; },
        cut: (view, event) => this.cut(view, event),
      },
      handlePaste: (view, event) => this.paste(view, event),
    },
    view: () => ({ destroy: () => { this.origin = undefined; } }),
  });

  private cut(view: EditorView, event: ClipboardEvent) {
    this.origin = undefined;
    if (!view.editable || view.composing || view.state.selection.empty || !event.clipboardData) return false;
    const { dom, text } = view.serializeForClipboard(view.state.selection.content());
    const token = uniqId();
    event.clipboardData.clearData();
    event.clipboardData.setData("text/html", dom.innerHTML);
    event.clipboardData.setData("text/plain", text);
    event.clipboardData.setData(cutFormat, token);
    event.preventDefault();
    const transaction = view.state.tr.deleteSelection().scrollIntoView().setMeta("uiEvent", "cut");
    this.origin = {
      token, source: view.state.doc, after: transaction.doc,
      selection: transaction.selection, end: view.state.selection.to,
    };
    view.dispatch(transaction);
    // Include synchronous appended repairs (for example table normalization) in
    // the actual cut state, after all transaction owners have finished.
    if (this.origin) {
      this.origin.after = view.state.doc;
      this.origin.selection = view.state.selection;
    }
    return true;
  }

  private paste(view: EditorView, event: ClipboardEvent) {
    const origin = this.origin;
    if (!origin) return false;
    if (event.clipboardData?.getData(cutFormat) !== origin.token) {
      this.origin = undefined;
      return false;
    }
    if (!view.editable || view.composing || !view.state.doc.eq(origin.after) ||
        !view.state.selection.eq(origin.selection)) return false;
    // Native deletion can collapse a mixed selection into its ending caption.
    // Re-fitting an open list slice there changes list text into a new caption.
    // At the exact cut state (including after undo), restore source and IDs through
    // an ordinary transaction, retaining undo/redo and authored references.
    const transaction = view.state.tr.replaceWith(0, view.state.doc.content.size, origin.source.content);
    transaction.setSelection(Selection.near(transaction.doc.resolve(origin.end), -1));
    view.dispatch(transaction.scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"));
    return true;
  }

  private changed(transaction: Transaction, previous: EditorState, next: EditorState) {
    const origin = this.origin;
    if (!origin) return;
    if (transaction.getMeta("uiEvent") === "cut" && previous.doc === origin.source) return;
    if (transaction.getMeta("nodeIdentity:normalized") && previous.doc === origin.after) {
      origin.after = next.doc;
      origin.selection = next.selection;
    }
    // Other edits/selections cannot match the recorded cut state. Keep one
    // bounded origin until clipboard replacement/copy/destroy so undo followed
    // by paste can return to that exact state without native slice re-fitting.
  }
}
