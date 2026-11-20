import type { Node as ModelNode } from "@tiptap/pm/model";
import type { LayoutUnit, PageLayout } from "../flow/page-planner";
import type { LayoutSnapshot } from "../measurement/layout-snapshot";
import { paginationNode } from "../measurement/node-layout";
import { collectFlow, textFlow, flowUnits, type FlowCache } from "../flow/text-flow";
import { fitAtomicContent } from "../measurement/fit-content";
import { tableHeaderRowCount } from "../../plugins/table-border";

export interface TableSource {
  node: ModelNode;
  wrapper: HTMLElement;
  table: HTMLTableElement;
  rows: PaginationTableRow[];
  cells: PaginationTableCell[];
  headerCount: number;
  containerPos: number;
  figure?: HTMLElement;
}

export async function tableSource(
  snapshot: LayoutSnapshot,
  node: ModelNode,
  pos: number,
  checkpoint: () => Promise<void>,
): Promise<TableSource> {
  const wrapper = snapshot.elements.get(pos);
  const table = wrapper?.matches("table")
    ? (wrapper as HTMLTableElement)
    : wrapper?.querySelector("table");
  if (!table) throw Error("Missing table layout");
  const rows: PaginationTableRow[] = [];
  const cells: PaginationTableCell[] = [];
  let offset = 0;
  for (let index = 0; index < node.childCount; index++) {
    const row = node.child(index);
    const from = pos + 1 + offset;
    const element = snapshot.elements.get(from);
    if (!element) throw Error("Missing table row");
    rows.push({
      from,
      node: row,
      element,
      height: element.getBoundingClientRect().height,
    });
    let cellOffset = 0;
    for (const cell of row.content.content) {
      const cellPos = from + 1 + cellOffset;
      cells.push({
        row: index,
        from: cellPos,
        node: cell,
        end: Math.min(
          node.childCount,
          index + Math.max(1, Number(cell.attrs.rowspan) || 1),
        ),
        lines: [],
        nested: [],
      });
      cellOffset += cell.nodeSize;
    }
    offset += row.nodeSize;
    await checkpoint();
  }
  const headerCount = tableHeaderRowCount(
    rows.map((row) =>
      row.node.content.content.map((cell) => ({
        header: cell.type.name === "tableHeader",
        rowspan: Number(cell.attrs.rowspan) || 1,
      })),
    ),
    snapshot.model.resolve(pos).parent.type.name === "figureTable",
  );
  const $pos = snapshot.model.resolve(pos);
  const containerPos =
    $pos.depth && paginationNode($pos.parent, $pos.before())?.kind === "table"
      ? $pos.before()
      : pos;
  const figure =
    containerPos !== pos ? snapshot.elements.get(containerPos) : undefined;
  return {
    node,
    wrapper: wrapper!,
    table,
    rows,
    cells,
    headerCount,
    containerPos,
    figure,
  };
}

/** Caption flow and the first usable grid unit share one owner at every depth. */
export async function tableOpeningFlow(
  snapshot: LayoutSnapshot,
  source: TableSource,
  pos: number,
  cache: FlowCache,
  checkpoint: () => Promise<void>,
  availableHeight: number,
): Promise<LayoutUnit[]> {
  const { containerPos, figure, wrapper, rows } = source;
  const container = snapshot.model.nodeAt(containerPos)!;
  const caption = figure ? container.firstChild : null;
  const units = caption
    ? flowUnits(
        await textFlow(snapshot, caption, containerPos + 1, cache, checkpoint),
      )
    : [];
  if (units.length) {
    units[0].anchor = {
      from: containerPos,
      to: containerPos + container.nodeSize,
      top: figure!.getBoundingClientRect().top - snapshot.origin,
      marginTop: parseFloat(getComputedStyle(figure!).marginTop) || 0,
    };
    units[units.length - 1].keepWithNext = true;
  }
  const row = rows[0]?.element;
  if (row) {
    const bounds = row.getBoundingClientRect();
    const openingTop = units[0]?.top ?? bounds.top - snapshot.origin;
    // Large rows are paginated internally; reserve their opening line only.
    const bottom =
      bounds.bottom - snapshot.origin - openingTop > availableHeight
        ? bounds.top + (parseFloat(getComputedStyle(row).lineHeight) || 24)
        : bounds.bottom;
    const from = units.length ? pos : containerPos;
    const element = units.length ? wrapper : (figure ?? wrapper);
    units.push({
      from,
      to: from + snapshot.model.nodeAt(from)!.nodeSize,
      kind: "block",
      top: element.getBoundingClientRect().top - snapshot.origin,
      bottom: bottom - snapshot.origin,
      marginTop: parseFloat(getComputedStyle(element).marginTop) || 0,
    });
  }
  return units;
}

/** Defer nested tables until their parent rows have final positions. */
export async function collectTableFlow(
  snapshot: LayoutSnapshot,
  cells: PaginationTableCell[],
  layout: PageLayout,
  cache: FlowCache,
  checkpoint: () => Promise<void>,
  availableHeight: number,
) {
  for (const cell of cells) {
    const atoms: { node: ModelNode; pos: number }[] = [];
    cell.node.descendants((child, offset) => {
      const target = paginationNode(child, cell.from + 1 + offset);
      if (target?.kind === "table") {
        const inner = target.node;
        const innerPos = target.position;
        const container = cell.from + 1 + offset;
        cell.nested.push({
          node: inner,
          pos: innerPos,
          container,
          done: false,
        });
        // Defer its contents until the preceding parent rows have reached
        // their final positions. Parent flow must not paginate this subtree.
        snapshot.completedTables.add(container);
        snapshot.completedTables.add(innerPos);
        return false;
      }
      if (
        child.isBlock &&
        (target?.kind === "atomic" || target?.kind === "image-figure")
      ) {
        atoms.push({ node: child, pos: cell.from + 1 + offset });
        return false;
      }
      return true;
    });
    for (const { node, pos } of atoms)
      await fitAtomicContent(
        snapshot,
        node,
        pos,
        availableHeight,
        layout,
        cache,
        checkpoint,
      );
    cell.lines = await collectFlow(
      snapshot,
      cell.node,
      cell.from,
      cache,
      checkpoint,
    );
  }
}
