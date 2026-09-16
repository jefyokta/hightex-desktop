import { Plugin, PluginKey } from "@tiptap/pm/state";
import { TableMap } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";

export interface ColumnResizingOptions {
  tableTypeName: string;
  cellTypeNames: string[];
  cellMinWidth?: number;
  handleWidth?: number;
}

interface DragState {
  view: EditorView;
  tablePos: number;
  colIndex: number;
  startX: number;
  startWidth: number;
  rectRight: number;
}

function findCellInfo(
  view: EditorView,
  opts: ColumnResizingOptions,
  target: HTMLElement,
) {
  const cellEl = target.closest("td, th") as HTMLElement | null;

  if (!cellEl) {
    return null;
  }

  const pos = view.posAtDOM(cellEl, 0);
  const $pos = view.state.doc.resolve(pos);

  let cellPos = -1;
  let tablePos = -1;

  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);

    if (cellPos === -1 && opts.cellTypeNames.includes(node.type.name)) {
      cellPos = $pos.before(depth);
    }

    if (node.type.name === opts.tableTypeName) {
      tablePos = $pos.before(depth);
      break;
    }
  }

  if (cellPos === -1 || tablePos === -1) {
    return null;
  }

  return {
    cellEl,
    cellPos,
    tablePos,
  };
}

export function createColumnResizing(opts: ColumnResizingOptions) {
  const cellMinWidth = opts.cellMinWidth ?? 40;
  const handleWidth = opts.handleWidth ?? 6;

  const pluginKey = new PluginKey(`columnResizing_${opts.tableTypeName}`);

  let dragLine: HTMLDivElement | null = null;
  let dragging: DragState | null = null;
  let hoveredCell: HTMLElement | null = null;

  function ensureDragLine() {
    if (dragLine) {
      return dragLine;
    }

    dragLine = document.createElement("div");

    Object.assign(dragLine.style, {
      position: "fixed",
      top: "0",
      bottom: "0",
      width: "2px",
      background: "#4f83ff",
      zIndex: "9999",
      pointerEvents: "none",
    });

    document.body.appendChild(dragLine);

    return dragLine;
  }

  function removeDragLine() {
    dragLine?.remove();
    dragLine = null;
  }

  function clearHover() {
    hoveredCell?.classList.remove("resize-edge-hover");
    hoveredCell = null;
  }

  function isNearRightEdge(cellEl: HTMLElement, clientX: number) {
    const rect = cellEl.getBoundingClientRect();

    return Math.abs(clientX - rect.right) <= handleWidth;
  }

  return new Plugin({
    key: pluginKey,

    props: {
      handleDOMEvents: {
        mousemove(view, event) {
          const target = event.target;

          if (!(target instanceof HTMLElement)) {
            clearHover();
            return false;
          }

          const info = findCellInfo(view, opts, target);

          /*
           * This is important:
           *
           * If this event belongs to our table type, consume it so
           * another columnResizing plugin (the built-in Table plugin)
           * cannot process the same DOM event.
           */
          if (info) {
            if (dragging) {
              return true;
            }

            if (isNearRightEdge(info.cellEl, event.clientX)) {
              if (hoveredCell !== info.cellEl) {
                clearHover();

                hoveredCell = info.cellEl;
                hoveredCell.classList.add("resize-edge-hover");
              }
            } else {
              clearHover();
            }

            return true;
          }

          clearHover();

          return false;
        },

        mouseleave() {
          if (!dragging) {
            clearHover();
          }

          return false;
        },

        mousedown(view, event) {
          const target = event.target;

          if (!(target instanceof HTMLElement)) {
            return false;
          }

          const info = findCellInfo(view, opts, target);

          /*
           * Not our table.
           *
           * Let the built-in Table columnResizing plugin handle it.
           */
          if (!info) {
            return false;
          }

          /*
           * Event belongs to our table, so don't allow the normal
           * tableColumnResizing plugin to process it.
           */
          if (!hoveredCell || info.cellEl !== hoveredCell) {
            return true;
          }

          event.preventDefault();

          const tableNode = view.state.doc.nodeAt(info.tablePos);

          if (!tableNode) {
            return true;
          }

          const map = TableMap.get(tableNode);

          const cellStart = info.cellPos - info.tablePos - 1;

          const cellNode = view.state.doc.nodeAt(info.cellPos);

          if (!cellNode) {
            return true;
          }

          const colspan = cellNode.attrs.colspan ?? 1;

          const colIndex = map.colCount(cellStart) + colspan - 1;

          const rect = info.cellEl.getBoundingClientRect();

          dragging = {
            view,
            tablePos: info.tablePos,
            colIndex,
            startX: event.clientX,
            startWidth: rect.width,
            rectRight: rect.right,
          };

          const line = ensureDragLine();

          line.style.left = `${rect.right}px`;

          const onMove = (moveEvent: MouseEvent) => {
            if (!dragging || !dragLine) {
              return;
            }

            const delta = moveEvent.clientX - dragging.startX;

            dragLine.style.left = `${dragging.rectRight + delta}px`;
          };

          const onUp = (upEvent: MouseEvent) => {
            window.removeEventListener("mousemove", onMove);

            window.removeEventListener("mouseup", onUp);

            removeDragLine();
            clearHover();

            if (!dragging) {
              return;
            }

            const currentDrag = dragging;
            dragging = null;

            const delta = upEvent.clientX - currentDrag.startX;

            const newWidth = Math.max(
              cellMinWidth,
              Math.round(currentDrag.startWidth + delta),
            );

            const { view: currentView, tablePos, colIndex } = currentDrag;

            const table = currentView.state.doc.nodeAt(tablePos);

            if (!table) {
              return;
            }

            const tableMap = TableMap.get(table);

            const tr = currentView.state.tr;

            const updatedCells = new Set<number>();

            for (let row = 0; row < tableMap.height; row++) {
              const mapIndex = row * tableMap.width + colIndex;

              const relPos = tableMap.map[mapIndex];

              /*
               * A rowspan cell appears in multiple rows
               * in TableMap. Only update it once.
               */
              if (
                row > 0 &&
                tableMap.map[mapIndex - tableMap.width] === relPos
              ) {
                continue;
              }

              if (updatedCells.has(relPos)) {
                continue;
              }

              updatedCells.add(relPos);

              const absPos = tablePos + 1 + relPos;

              const node = currentView.state.doc.nodeAt(absPos);

              if (!node) {
                continue;
              }

              const span = node.attrs.colspan ?? 1;

              const leftCol = tableMap.colCount(relPos);

              const localIndex = colIndex - leftCol;

              if (localIndex < 0 || localIndex >= span) {
                continue;
              }

              const widths: number[] = node.attrs.colwidth
                ? [...node.attrs.colwidth]
                : new Array(span).fill(0);

              widths[localIndex] = newWidth;

              tr.setNodeMarkup(absPos, undefined, {
                ...node.attrs,
                colwidth: widths,
              });
            }

            if (tr.docChanged) {
              currentView.dispatch(tr);
            }
          };

          window.addEventListener("mousemove", onMove);

          window.addEventListener("mouseup", onUp);

          return true;
        },
      },
    },

    destroy() {
      window.removeEventListener("mousemove", () => {});

      window.removeEventListener("mouseup", () => {});

      removeDragLine();
      clearHover();

      dragging = null;
    },
  });
}
