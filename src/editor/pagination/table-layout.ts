import type { Node as ModelNode } from "@tiptap/pm/model";
import { collectFlow, FlowCache, type FlowLine } from "./flow";
import type { PageLayout } from "./layout";
import { LayoutSnapshot } from "./snapshot";
import { fitAtomicContent } from "./atomic-layout";

interface Row {
  from: number;
  node: ModelNode;
  element: HTMLElement;
  height: number;
}
interface Cell {
  row: number;
  end: number;
  from: number;
  node: ModelNode;
  lines: FlowLine[];
  nested: { node: ModelNode; pos: number; container: number; done: boolean }[];
}

/** Freeze row heights before adding gaps so rowspan growth cannot move earlier pages. */
export async function paginateTable(
  snapshot: LayoutSnapshot,
  node: ModelNode,
  pos: number,
  layout: PageLayout,
  cache: FlowCache,
  checkpoint: () => Promise<void>,
  reservedTop = 0,
  depth = 0,
) {
  if (depth > 24) throw Error("Table nesting exceeds the layout budget");
  const wrapper = snapshot.elements.get(pos);
  const table = wrapper?.matches("table")
    ? (wrapper as HTMLTableElement)
    : wrapper?.querySelector("table");
  if (!table) throw Error("Missing table layout");
  const rows: Row[] = [];
  const cells: Cell[] = [];
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
  const { contentHeight, stride, margins, repeatTableCaption, repeatTableHeader } = snapshot.geometry;
  let headerCount = 0;
  while (
    headerCount < rows.length &&
    rows[headerCount].node.content.content.every(
      (cell) => cell.type.name === "tableHeader",
    )
  ) {
    const row = rows[headerCount];
    const spanEnd = Math.max(
      headerCount + 1,
      ...row.node.content.content.map(
        (cell) => headerCount + (Number(cell.attrs.rowspan) || 1),
      ),
    );
    headerCount = Math.min(rows.length, spanEnd);
  }
  const $pos = snapshot.model.resolve(pos);
  const containerPos = $pos.parent.type.name === "figureTable" ? $pos.before() : pos;
  const figure = containerPos !== pos ? snapshot.elements.get(containerPos) : undefined;
  const caption = figure?.querySelector<HTMLElement>("figcaption");
  const furniture = document.createElement("figure");
  furniture.dataset.type = "figureTable";
  furniture.className = "tiptap ProseMirror editor-pagination-repeat";
  furniture.style.cssText = `position:absolute;left:0;top:0;margin:0;width:${table.getBoundingClientRect().width}px`;
  if (caption && repeatTableCaption) {
    const copy = caption.cloneNode(true) as HTMLElement;
    copy.classList.add("editor-pagination-repeat-caption");
    copy.dataset.repeatLabel = caption.dataset.label ?? "Tabel";
    copy.style.position = "relative";
    // A caption can be wider than a narrow table. Keep its measured width
    // instead of wrapping it to the continuation table's width and reserving
    // a different header height from the original.
    copy.style.setProperty("width", `${caption.getBoundingClientRect().width}px`, "important");
    copy.style.maxWidth = "none";
    copy.style.left = `${caption.getBoundingClientRect().left - table.getBoundingClientRect().left}px`;
    furniture.append(copy);
  }
  if (headerCount && repeatTableHeader) {
    const headerTable = table.cloneNode(false) as HTMLTableElement;
    headerTable.style.width = `${table.getBoundingClientRect().width}px`;
    const columns = table.querySelector("colgroup");
    if (columns) headerTable.append(columns.cloneNode(true));
    const body = document.createElement("tbody");
    for (const row of rows.slice(0, headerCount))
      body.append(row.element.cloneNode(true));
    headerTable.append(body);
    furniture.append(headerTable);
  }
  snapshot.host.append(furniture);
  const furnitureHeight = furniture.getBoundingClientRect().height;
  const furnitureHTML = furniture.childElementCount ? furniture.outerHTML : "";
  furniture.remove();
  if (reservedTop + furnitureHeight > contentHeight - 48)
    throw Error("The repeated table header leaves no room for content");
  const groupTop = (figure ?? wrapper!).getBoundingClientRect().top - snapshot.origin;
  const headerBottom = rows[Math.max(0, headerCount - 1)]?.element.getBoundingClientRect().bottom ?? table.getBoundingClientRect().top;
  const firstGroupBottom = Math.min(table.getBoundingClientRect().bottom, headerBottom + 24) - snapshot.origin;
  const firstPage = Math.max(0, Math.floor(groupTop / stride));
  if (firstGroupBottom - groupTop <= contentHeight - reservedTop && firstGroupBottom > firstPage * stride + contentHeight) {
    const height = (firstPage + 1) * stride + reservedTop - groupTop;
    const margin = snapshot.margin(containerPos, height);
    const container = snapshot.model.nodeAt(containerPos)!;
    layout.breaks.push({ from: containerPos, to: containerPos + container.nodeSize, top: groupTop, bottom: firstGroupBottom, kind: "block", ...margin });
  }
  for (const cell of cells) {
    cell.node.descendants((child, offset) => {
      if (child.type.name === "figureTable" || child.type.name === "table") {
        let inner = child;
        let innerPos = cell.from + 1 + offset;
        if (child.type.name === "figureTable") {
          let innerOffset = 0;
          for (const part of child.content.content) {
            if (part.type.name === "table") { inner = part; innerPos += 1 + innerOffset; break; }
            innerOffset += part.nodeSize;
          }
        }
        const container = cell.from + 1 + offset;
        cell.nested.push({ node: inner, pos: innerPos, container, done: false });
        // Defer its contents until the preceding parent rows have reached
        // their final positions. Parent flow must not paginate this subtree.
        snapshot.completedTables.add(container);
        snapshot.completedTables.add(innerPos);
        return false;
      }
      if (child.type.name === "imageFigure" || (child.isAtom && child.isBlock)) {
        fitAtomicContent(snapshot, child, cell.from + 1 + offset, contentHeight - furnitureHeight - reservedTop, layout);
        return false;
      }
      return true;
    });
    cell.lines = await collectFlow(snapshot, cell.node, cell.from, cache, checkpoint);
  }
  for (const row of rows) row.height = row.element.getBoundingClientRect().height;
  const rowEffects = new Map<number, NonNullable<PageLayout["rows"]>[number]>();
  const freeze = () => {
    if (rowEffects.size) return;
    for (const row of rows) {
      row.element.style.setProperty("--editor-row-height", `${row.height}px`);
      row.element.classList.add("editor-pagination-row");
      rowEffects.set(row.from, {
        from: row.from,
        to: row.from + row.node.nodeSize,
        height: row.height,
      });
    }
  };
  let page = Math.max(
    0,
    Math.floor((table.getBoundingClientRect().top - snapshot.origin) / stride),
  );
  let steps = 0;
  const maxSteps = Math.max(
    128,
    cells.reduce((sum, cell) => sum + cell.lines.length, 0) * 3 +
      rows.length * 3 + layout.pages * 3,
  );
  const forcedBreaks = cells.flatMap(cell => cell.lines.filter(line => line.breakBefore));
  for (;;) {
    const naturalLimit = page * stride + contentHeight;
    for (const cell of cells) {
      for (const inner of cell.nested) {
        if (inner.done) continue;
        const top = snapshot.elements.get(inner.container)!.getBoundingClientRect().top - snapshot.origin;
        if (top > naturalLimit + 0.5 || cell.lines.some(line => line.from < inner.container && line.bounds().bottom > naturalLimit + 0.5)) break;
        freeze();
        await paginateTable(snapshot, inner.node, inner.pos, layout, cache, checkpoint, reservedTop + furnitureHeight, depth + 1);
        inner.done = true;
        // Child gaps can grow this row; frozen earlier rows cannot redistribute
        // that growth and shift a previously measured child or page.
        for (const row of rows) {
          row.height = row.element.getBoundingClientRect().height;
          rowEffects.get(row.from)!.height = row.height;
          row.element.style.setProperty("--editor-row-height", `${row.height}px`);
        }
      }
    }
    let forcedTop = Infinity;
    for (const line of forcedBreaks) {
      const { top } = line.bounds();
      if (top > page * stride + furnitureHeight + reservedTop + 0.5 && top <= naturalLimit + 0.5)
        forcedTop = Math.min(forcedTop, top);
    }
    if (!Number.isFinite(forcedTop) &&
        table.getBoundingClientRect().bottom - snapshot.origin <= naturalLimit + 1) break;
    const limit = Math.min(naturalLimit, forcedTop);
    const nextStart = (page + 1) * stride;
    const target = nextStart + furnitureHeight + reservedTop;
    freeze();
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
      const changes: { cell: Cell; line: FlowLine; bounds: { top: number; bottom: number }; height: number }[] = [];
      for (const cell of cells) {
        if (cell.row > rowIndex || cell.end <= rowIndex || !cell.lines.length)
          continue;
        let low = 0;
        const deferred = cell.nested.find(inner => !inner.done);
        const lineEnd = deferred ? cell.lines.findIndex(line => line.from > deferred.container) : -1;
        const availableLines = lineEnd < 0 ? cell.lines.length : lineEnd;
        let high = availableLines;
        while (low < high) {
          const middle = (low + high) >>> 1;
          const candidate = cell.lines[middle];
          const bounds = candidate.bounds();
          if (bounds.bottom <= limit + 0.5 &&
              !(candidate.breakBefore && bounds.top >= forcedTop - 0.5))
            low = middle + 1;
          else high = middle;
        }
        if (low >= availableLines) continue;
        let line = cell.lines[low];
        let bounds = line.bounds();
        if (bounds.top >= target - 0.5) continue;
        if (
          line.lineCount! >= 4 &&
          line.lineCount! - line.lineIndex! === 1 &&
          low > 0
        ) {
          const previous = cell.lines[low - 1];
          if (previous.bounds().top >= page * stride) {
            line = previous;
            bounds = line.bounds();
          }
        }
        // If only the first line of this paragraph fits, move it together with
        // the following line when both fit on a continuation page.
        if (!Number.isFinite(forcedTop) && line.lineIndex === 1 && low > 0) {
          const first = cell.lines[low - 1];
          const firstBounds = first.bounds();
          if (firstBounds.top >= page * stride &&
              bounds.bottom - firstBounds.top <= contentHeight - furnitureHeight - reservedTop) {
            line = first;
            bounds = firstBounds;
          }
        }
        if (bounds.bottom - bounds.top > contentHeight - furnitureHeight - reservedTop + 1)
          throw Error("A table content unit is taller than its page");
        const height = target - bounds.top;
        if (height <= 0.5) continue;
        changes.push({ cell, line, bounds, height });
      }
      for (const { line, bounds, height } of changes) {
        const anchor = line.lineIndex === 0 ? line.anchor : undefined;
        if (anchor || line.kind === "block") {
          const from = anchor?.from ?? line.from;
          const to = anchor?.to ?? line.to!;
          const margin = snapshot.margin(from, height);
          layout.breaks.push({
            from,
            to,
            top: bounds.top,
            bottom: bounds.bottom,
            kind: "block",
            ...margin,
          });
        } else {
          snapshot.spacer(line.from, height);
          layout.breaks.push({
            from: line.from,
            top: bounds.top,
            bottom: bounds.bottom,
            kind: "line",
            height,
          });
        }
      }
      let growth = 0;
      for (const { cell } of changes) {
        const element = snapshot.elements.get(cell.from)!;
        const box = element.getBoundingClientRect();
        let contentBottom = box.top;
        for (const child of Array.from(element.children)) {
          const bounds = child.getBoundingClientRect();
          contentBottom = Math.max(contentBottom, bounds.bottom + (parseFloat(getComputedStyle(child).marginBottom) || 0));
        }
        const required = contentBottom - box.top + (parseFloat(getComputedStyle(element).paddingBottom) || 0);
        const available = rows.slice(cell.row, cell.end).reduce((sum, item) => sum + item.height, 0);
        growth = Math.max(growth, required - available);
      }
      if (growth > 0) {
        row.height += growth;
        row.element.style.setProperty("--editor-row-height", `${row.height}px`);
        rowEffects.get(row.from)!.height = row.height;
      } else if (!changes.length) rowIndex++;
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
    }
    await checkpoint();
    if (++steps > maxSteps)
      throw Error("Table pagination exceeded its page budget");
  }
  layout.rows!.push(...rowEffects.values());
  layout.pages = Math.max(layout.pages, page + 1);
  snapshot.completedTables.add(pos);
  snapshot.completedTables.add(containerPos);
  if (cells.some(cell => cell.nested.some(inner => !inner.done)))
    throw Error("A nested table did not reach its parent layout position");
}
