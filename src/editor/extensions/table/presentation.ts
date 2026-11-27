import { Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { columnResizingPluginKey } from "@tiptap/pm/tables";
import { presentTableColumns } from "./view";

/** One editor/view owns width refreshes, including nested tables and page-margin changes. */
class TableWidthPresentation {
  private observer: ResizeObserver;

  constructor(private readonly view: EditorView) {
    this.observer = new ResizeObserver(() => this.update());
    this.observer.observe(view.dom);
    this.update();
  }

  update() {
    if (
      this.view.isDestroyed ||
      columnResizingPluginKey.getState(this.view.state)?.dragging
    ) return;
    // Parent columns settle before nested containers are read.
    this.view.state.doc.descendants((node, pos) => {
      if (node.type.spec.tableRole !== "table") return;
      const wrapper = this.view.nodeDOM(pos) as HTMLElement;
      const table = wrapper.querySelector<HTMLTableElement>(":scope > table");
      if (table) presentTableColumns(table, node);
    });
  }

  destroy() {
    this.observer.disconnect();
  }
}

export function chapterTablePresentation() {
  return new Plugin({ view: (view) => new TableWidthPresentation(view) });
}
