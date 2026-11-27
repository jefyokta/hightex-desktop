import { Plugin } from "@tiptap/pm/state";
import type { Node } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import {
  columnResizing,
  columnResizingPluginKey,
  TableMap,
  type ColumnResizingOptions,
} from "@tiptap/pm/tables";
import { presentTableColumns, presentedTableColumns, tableWidthBudget } from "./view";
import {
  resizedTableColumns,
  setTableColumnWidths,
  TABLE_CELL_MIN_WIDTH,
} from "./widths";
import { TableResizeFeedback } from "./resize-feedback";

interface ColumnDrag {
  source: Node;
  tableNode: Node;
  table: HTMLTableElement;
  tablePos: number;
  column: number;
  widths: number[];
  available: number;
  scale: number;
  startX: number;
  edgeFactor: number;
  cell: HTMLElement;
}

/** Own the window listeners and source revision for one native column gesture. */
class TableColumnDrag {
  private current?: ColumnDrag;
  private feedback?: TableResizeFeedback;
  private readonly window: Window;

  constructor(private readonly view: EditorView) {
    this.window = view.dom.ownerDocument.defaultView!;
  }

  start(event: MouseEvent) {
    const state = columnResizingPluginKey.getState(this.view.state);
    if (
      !this.view.editable || !state || state.dragging ||
      state.activeHandle < 0 || event.button !== 0
    ) return false;
    const cell = this.view.state.doc.resolve(state.activeHandle);
    const tableNode = cell.node(-1);
    const tablePos = cell.before(-1);
    const wrapper = this.view.nodeDOM(tablePos) as HTMLElement;
    const table = wrapper.querySelector("table")!;
    const available = tableWidthBudget(table);
    const scale = table.getBoundingClientRect().width /
      parseFloat(getComputedStyle(table).width);
    const widths = presentedTableColumns(table);
    const map = TableMap.get(tableNode);
    const column = map.colCount(cell.pos - cell.start(-1)) +
      cell.nodeAfter!.attrs.colspan - 1;
    this.current = {
      source: this.view.state.doc, tableNode, table, tablePos, column,
      widths, available, scale, startX: event.clientX,
      // A centered table expands on both sides; its outer edge moves by half the width delta.
      edgeFactor: column === widths.length - 1 && getComputedStyle(wrapper).alignItems === "center" ? 2 : 1,
      cell: this.view.nodeDOM(state.activeHandle) as HTMLElement,
    };
    this.view.dispatch(this.view.state.tr.setMeta(columnResizingPluginKey, {
      setDragging: { startX: event.clientX, startWidth: widths[column] },
    }));
    this.window.addEventListener("mousemove", this.move);
    this.window.addEventListener("mouseup", this.finish);
    this.window.addEventListener("blur", this.cancel);
    this.window.addEventListener("keydown", this.keydown);
    this.feedback = new TableResizeFeedback(table);
    this.feedback.update(this.current.cell, column, widths, false, event.clientY);
    event.preventDefault();
    return true;
  }

  private resize(event: MouseEvent) {
    const drag = this.current!;
    const requested = drag.widths[drag.column] +
      (event.clientX - drag.startX) / drag.scale * drag.edgeFactor;
    const widths = resizedTableColumns(
      drag.widths, drag.column, requested, drag.available,
    );
    const limited = widths[drag.column] !== requested ||
      widths[drag.column] === TABLE_CELL_MIN_WIDTH ||
      widths[drag.column + 1] === TABLE_CELL_MIN_WIDTH;
    return { widths, limited };
  }

  private move = (event: MouseEvent) => {
    if (!this.current) return;
    if (!(event.buttons & 1)) return this.cancel();
    const { widths, limited } = this.resize(event);
    presentTableColumns(this.current.table, this.current.tableNode, widths);
    this.feedback?.update(this.current.cell, this.current.column, widths, limited, event.clientY);
  };

  private finish = (event: MouseEvent) => {
    const drag = this.current;
    if (!drag) return;
    if (event.clientX === drag.startX) return this.cancel();
    const { widths } = this.resize(event);
    this.stop();
    const transaction = this.view.state.tr;
    setTableColumnWidths(transaction, drag.tablePos, widths);
    transaction.setMeta(columnResizingPluginKey, { setDragging: null });
    this.view.dispatch(transaction);
  };

  private keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.cancel();
    }
  };

  private cancel = () => {
    const drag = this.current;
    if (!drag) return;
    this.stop();
    if (this.view.state.doc === drag.source)
      presentTableColumns(drag.table, drag.tableNode);
    if (!this.view.isDestroyed)
      this.view.dispatch(this.view.state.tr.setMeta(columnResizingPluginKey, {
        setDragging: null,
      }));
  };

  update() {
    if (this.current && this.current.source !== this.view.state.doc) this.cancel();
  }

  private stop() {
    this.current = undefined;
    this.feedback?.destroy();
    this.feedback = undefined;
    this.window.removeEventListener("mousemove", this.move);
    this.window.removeEventListener("mouseup", this.finish);
    this.window.removeEventListener("blur", this.cancel);
    this.window.removeEventListener("keydown", this.keydown);
  }

  destroy() {
    const drag = this.current;
    this.stop();
    if (drag && this.view.state.doc === drag.source)
      presentTableColumns(drag.table, drag.tableNode);
  }
}

/** Keep ProseMirror's hit testing, handle state and decorations; customize the gesture. */
export function chapterColumnResizing(options: ColumnResizingOptions) {
  const native = columnResizing({
    ...options,
    cellMinWidth: TABLE_CELL_MIN_WIDTH,
    defaultCellMinWidth: TABLE_CELL_MIN_WIDTH,
    View: null,
  });
  let drag: TableColumnDrag;
  return new Plugin({
    ...native.spec,
    props: {
      ...native.props,
      handleDOMEvents: {
        ...native.props.handleDOMEvents,
        mousedown: (_view, event) => drag.start(event),
      },
    },
    view(view) {
      drag = new TableColumnDrag(view);
      return drag;
    },
  });
}
