import type { EditorView } from "@tiptap/pm/view";
import type { Node as ModelNode } from "@tiptap/pm/model";
import { textFlow, FlowCache } from "./flow";
import {
  paginateUnits,
  type LayoutUnit,
  type PageLayout,
} from "./layout";
import { LayoutSnapshot, layoutCheckpoint } from "./snapshot";
import { paginateTable } from "./table-layout";
import { fitAtomicContent } from "./atomic-layout";
import { DEFAULT_PAGINATION, type PaginationGeometry } from "./options";

/** A bounded, cancellable layout pass over a snapshot of one editor document. */
export async function measureEditor(
  view: EditorView,
  cache: FlowCache,
  signal: AbortSignal,
  geometry: PaginationGeometry = DEFAULT_PAGINATION,
): Promise<PageLayout | null> {
  if (!view.dom.isConnected || !view.dom.getBoundingClientRect().width)
    return null;
  const snapshot = new LayoutSnapshot(view, geometry);
  const checkpoint = layoutCheckpoint(signal);
  const layout: PageLayout = {
    breaks: [],
    pages: 1,
    rows: [],
    scales: [],
    furniture: [],
  };
  const { contentHeight } = geometry;
  try {
    snapshot.model.descendants((node, pos) => {
      if (node.type.name === "imageFigure" || (node.isAtom && node.isBlock)) {
        fitAtomicContent(snapshot, node, pos, contentHeight, layout);
        return false;
      }
      return true;
    });
    const plan = async (units: LayoutUnit[]) => {
      if (!units.length) return;
      const result = paginateUnits(units, geometry);
      for (const item of result.breaks) {
        if (item.kind === "block") Object.assign(item, snapshot.margin(item.from, item.height));
        else snapshot.spacer(item.from, item.height);
      }
      layout.breaks.push(...result.breaks);
      layout.pages = Math.max(layout.pages, result.pages);
      await checkpoint();
    };
    let pending: LayoutUnit[] = [];
    const flush = async () => {
      await plan(pending);
      pending = [];
    };
    const visit = async (node: ModelNode, pos: number, listItem?: { node: ModelNode; pos: number }) => {
      await checkpoint();
      const element = snapshot.elements.get(pos);
      if (!element || snapshot.completedTables.has(pos)) return;
      if (node.type.name === "table" || node.type.name === "figureTable") {
        let tableNode = node;
        let tablePos = pos;
        if (node.type.name === "figureTable") {
          let offset = 0;
          for (const child of node.content.content) {
            if (child.type.name === "table") {
              tableNode = child;
              tablePos = pos + 1 + offset;
              break;
            }
            offset += child.nodeSize;
          }
        }
        const tableElement = snapshot.elements.get(tablePos);
        const row = tableElement?.querySelector("tr");
        if (row)
          pending.push(
            {
              from: pos,
              to: pos + node.nodeSize,
              kind: "block",
              top: element.getBoundingClientRect().top - snapshot.origin,
              bottom: row.getBoundingClientRect().bottom - snapshot.origin,
              marginTop: parseFloat(getComputedStyle(element).marginTop) || 0,
            },
          );
        await flush();
        await paginateTable(
          snapshot,
          tableNode,
          tablePos,
          layout,
          cache,
          checkpoint,
        );
      } else if (node.type.name === "imageFigure" || node.isAtom) {
        const bounds = element.getBoundingClientRect();
        pending.push({
          from: pos,
          to: pos + node.nodeSize,
          top: bounds.top - snapshot.origin,
          bottom: bounds.bottom - snapshot.origin,
          kind: "block",
          breakBefore: node.type.name === "horizontalRule",
          marginTop: parseFloat(getComputedStyle(element).marginTop) || 0,
        });
      } else if (node.isTextblock) {
        const lines = await textFlow(snapshot, node, pos, cache, checkpoint);
        if (listItem && lines.length) {
          const item = snapshot.elements.get(listItem.pos)!;
          lines[0].anchor = {
            from: listItem.pos,
            to: listItem.pos + listItem.node.nodeSize,
            top: item.getBoundingClientRect().top - snapshot.origin,
            marginTop: parseFloat(getComputedStyle(item).marginTop) || 0,
          };
        }
        pending.push(
          ...lines.map((line) => ({
            from: line.from,
            to: line.to,
            top: line.top,
            bottom: line.bottom,
            kind: line.kind,
            marginTop: line.marginTop,
            group: line.group,
            lineIndex: line.lineIndex,
            lineCount: line.lineCount,
            anchor: line.anchor,
            // Keep the chain through every line of consecutive headings.
            // Marking only the last line stops lookahead inside a subheading
            // and can leave its preceding heading alone on the old page.
            keepWithNext: node.type.name === "heading",
            breakBefore: line.breakBefore,
          })),
        );
      } else {
        let offset = 0;
        for (let index = 0; index < node.childCount; index++) {
          const child = node.child(index);
          await visit(child, pos + 1 + offset,
            index === 0 && node.type.name === "listItem" ? { node, pos } : undefined);
          offset += child.nodeSize;
        }
      }
    };
    let pos = 0;
    for (const node of snapshot.model.content.content) {
      await visit(node, pos);
      pos += node.nodeSize;
    }
    await flush();
    signal.throwIfAborted();
    return layout;
  } finally {
    snapshot.destroy();
  }
}
