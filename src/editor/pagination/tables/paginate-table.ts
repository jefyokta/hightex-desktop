import type { Node as ModelNode } from "@tiptap/pm/model";
import type { FlowCache } from "../flow/text-flow";
import { recordPageBreak, type LayoutUnit, type PageLayout } from "../flow/page-planner";
import type { LayoutSnapshot } from "../measurement/layout-snapshot";
import {
  tableSource,
  tableOpeningFlow,
  collectTableFlow,
} from "./table-source";
import { tableFurniture } from "./table-furniture";
import { tableBreaks, applyTableBreaks } from "./table-breaks";
import { TableRows } from "./table-rows";
import { applyFlowLayout } from "../flow/apply-flow";

/** Read grid -> reserve furniture -> collect flow -> place nested tables and breaks. */
export async function paginateTable(
  snapshot: LayoutSnapshot,
  node: ModelNode,
  pos: number,
  layout: PageLayout,
  cache: FlowCache,
  checkpoint: () => Promise<void>,
  options: {
    reservedTop?: number;
    depth?: number;
    leading?: LayoutUnit[];
  } = {},
) {
  const { reservedTop = 0, depth = 0, leading = [] } = options;
  if (depth > 24) throw Error("Table nesting exceeds the layout budget");
  const source = await tableSource(snapshot, node, pos, checkpoint);
  const { wrapper, table, rows, cells, headerCount, containerPos, figure } =
    source;
  const { contentHeight, stride, margins } = snapshot.geometry;
  const {
    height: furnitureHeight,
    html: furnitureHTML,
    compact,
  } = tableFurniture(snapshot, source, contentHeight - reservedTop - 48, cache);
  if (reservedTop + furnitureHeight > contentHeight - 48)
    throw Error(
      `The repeated table caption/header${compact ? " (first visual lines)" : ""} leaves no room for content: ${furnitureHeight.toFixed(2)}px repeated + ${reservedTop.toFixed(2)}px enclosing headers; page content ${contentHeight.toFixed(2)}px, minimum body 48px`,
    );
  await applyFlowLayout(
    snapshot,
    layout,
    [
      ...leading,
      ...(await tableOpeningFlow(
        snapshot,
        source,
        pos,
        cache,
        checkpoint,
        contentHeight - reservedTop,
      )),
    ],
    checkpoint,
    reservedTop,
  );
  // Once caption lines have moved independently, moving the whole figure would
  // move those already placed lines again. The remaining opening group is the grid.
  const captionFragmented =
    figure &&
    layout.breaks.some((cut) => cut.from > containerPos && cut.from < pos);
  const openingPos = captionFragmented ? pos : containerPos;
  const groupTop =
    (captionFragmented ? wrapper : (figure ?? wrapper)).getBoundingClientRect()
      .top - snapshot.origin;
  const headerBottom =
    rows[Math.max(0, headerCount - 1)]?.element.getBoundingClientRect()
      .bottom ?? table.getBoundingClientRect().top;
  const firstGroupBottom =
    Math.min(table.getBoundingClientRect().bottom, headerBottom + 24) -
    snapshot.origin;
  const firstPage = Math.max(0, Math.floor(groupTop / stride));
  if (
    firstGroupBottom - groupTop <= contentHeight - reservedTop &&
    firstGroupBottom > firstPage * stride + contentHeight
  ) {
    const height = (firstPage + 1) * stride + reservedTop - groupTop;
    const margin = snapshot.margin(openingPos, height);
    const container = snapshot.model.nodeAt(openingPos)!;
    recordPageBreak(
      layout,
      {
        from: openingPos,
        to: openingPos + container.nodeSize,
        top: groupTop,
        bottom: firstGroupBottom,
        kind: "block",
        ...margin,
      },
      {
        kind: "break",
        placement: "block",
        from: openingPos,
        to: openingPos + container.nodeSize,
        trigger: { from: openingPos, to: openingPos + container.nodeSize },
        reasons: ["table-start"],
        fromPage: firstPage + 1,
        toPage: firstPage + 2,
        beforeTop: groupTop,
        beforeBottom: firstGroupBottom,
        limit: firstPage * stride + contentHeight,
        targetTop: (firstPage + 1) * stride + reservedTop,
        displacement: height,
      },
    );
  }
  await collectTableFlow(
    snapshot,
    cells,
    layout,
    cache,
    checkpoint,
    contentHeight - furnitureHeight - reservedTop,
  );
  for (const row of rows)
    row.height = row.element.getBoundingClientRect().height;
  const rowState = new TableRows(snapshot, rows);
  let page = Math.max(
    0,
    Math.floor((table.getBoundingClientRect().top - snapshot.origin) / stride),
  );
  let steps = 0;
  const maxSteps = Math.max(
    128,
    cells.reduce((sum, cell) => sum + cell.lines.length, 0) * 3 +
      rows.length * 3 +
      layout.pages * 3,
  );
  const forcedBreaks = cells.flatMap((cell) =>
    cell.lines.filter((line) => line.breakBefore),
  );
  for (;;) {
    const naturalLimit = page * stride + contentHeight;
    for (const cell of cells) {
      for (const inner of cell.nested) {
        if (inner.done) continue;
        const top =
          snapshot.elements.get(inner.container)!.getBoundingClientRect().top -
          snapshot.origin;
        if (
          top > naturalLimit + 0.5 ||
          cell.lines.some(
            (line) =>
              line.from < inner.container &&
              line.bounds().bottom > naturalLimit + 0.5,
          )
        )
          break;
        rowState.freeze();
        await paginateTable(
          snapshot,
          inner.node,
          inner.pos,
          layout,
          cache,
          checkpoint,
          { reservedTop: reservedTop + furnitureHeight, depth: depth + 1 },
        );
        inner.done = true;
        // Child gaps can grow this row; frozen earlier rows cannot redistribute
        // that growth and shift a previously measured child or page.
        rowState.refresh();
      }
    }
    let forcedTop = Infinity;
    for (const line of forcedBreaks) {
      const { top } = line.bounds();
      if (
        top > page * stride + furnitureHeight + reservedTop + 0.5 &&
        top <= naturalLimit + 0.5
      )
        forcedTop = Math.min(forcedTop, top);
    }
    if (
      !Number.isFinite(forcedTop) &&
      table.getBoundingClientRect().bottom - snapshot.origin <= naturalLimit + 1
    )
      break;
    const limit = Math.min(naturalLimit, forcedTop);
    const nextStart = (page + 1) * stride;
    const target = nextStart + furnitureHeight + reservedTop;
    rowState.freeze();
    let rowIndex = 0;
    while (
      rowIndex < rows.length &&
      rows[rowIndex].element.getBoundingClientRect().bottom - snapshot.origin <=
        limit + 0.5
    )
      rowIndex++;
    while (rowIndex < rows.length) {
      if (++steps > maxSteps) throw Error("Table pagination did not converge");
      const row = rows[rowIndex];
      if (
        row.element.getBoundingClientRect().top - snapshot.origin >=
        target - 0.5
      )
        break;
      const changes = tableBreaks(cells, rowIndex, {
        fromPage: page + 1,
        pageStart: page * stride,
        limit,
        target,
        forcedTop,
        availableHeight: contentHeight - furnitureHeight - reservedTop,
      });
      applyTableBreaks(snapshot, layout, changes);
      if (!rowState.grow(row, changes) && !changes.length) rowIndex++;
      await checkpoint();
    }
    page++;
    if (
      table.getBoundingClientRect().bottom - snapshot.origin > nextStart + 1 &&
      furnitureHTML
    ) {
      const bounds = table.getBoundingClientRect();
      layout.furniture!.push({
        top: nextStart + reservedTop + margins.top,
        left: bounds.left - snapshot.left,
        width: bounds.width,
        html: furnitureHTML,
      });
      const container = snapshot.model.nodeAt(containerPos)!;
      if (
        compact &&
        !layout.issues?.some(
          (issue) => issue.kind === "table" && issue.from === containerPos,
        )
      )
        (layout.issues ??= []).push({
          kind: "table",
          key: String(container.attrs.id || containerPos),
          from: containerPos,
          to: containerPos + container.nodeSize,
          message:
            "Pengulangan caption/header tabel memakai baris visual pertama karena versi lengkap tidak menyisakan ruang isi. Caption dan header sumber tetap dicetak lengkap.",
        });
      (layout.decisions ??= []).push({
        kind: "table-continuation",
        from: containerPos,
        to: containerPos + container.nodeSize,
        page: page + 1,
        x: bounds.left - snapshot.left,
        y: reservedTop + margins.top,
        width: bounds.width,
        height: furnitureHeight,
      });
    }
    await checkpoint();
    if (++steps > maxSteps)
      throw Error("Table pagination exceeded its page budget");
  }
  layout.rows!.push(...rowState.effects.values());
  layout.pages = Math.max(layout.pages, page + 1);
  snapshot.completedTables.add(pos);
  snapshot.completedTables.add(containerPos);
  if (cells.some((cell) => cell.nested.some((inner) => !inner.done)))
    throw Error("A nested table did not reach its parent layout position");
}
