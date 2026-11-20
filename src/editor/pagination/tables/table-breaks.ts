import type { FlowLine } from "../flow/text-flow";
import {
  recordPageBreak,
  type LayoutBreakDecision,
  type PageLayout,
} from "../flow/page-planner";
import type { LayoutSnapshot } from "../measurement/layout-snapshot";

export interface TableBreakChange {
  cell: PaginationTableCell;
  line: FlowLine;
  bounds: { top: number; bottom: number };
  height: number;
  decision: LayoutBreakDecision;
}
interface TablePageLimit {
  fromPage: number;
  pageStart: number;
  limit: number;
  target: number;
  forcedTop: number;
  availableHeight: number;
}

/** Choose overflow lines with the same widow/orphan and forced-break policy. */
export function tableBreaks(
  cells: PaginationTableCell[],
  rowIndex: number,
  page: TablePageLimit,
) {
  const { pageStart, limit, target, forcedTop, availableHeight } = page;
  const changes: TableBreakChange[] = [];
  for (const cell of cells) {
    if (cell.row > rowIndex || cell.end <= rowIndex || !cell.lines.length)
      continue;
    let low = 0;
    const deferred = cell.nested.find((inner) => !inner.done);
    const lineEnd = deferred
      ? cell.lines.findIndex((line) => line.from > deferred.container)
      : -1;
    const availableLines = lineEnd < 0 ? cell.lines.length : lineEnd;
    let high = availableLines;
    while (low < high) {
      const middle = (low + high) >>> 1;
      const candidate = cell.lines[middle];
      const bounds = candidate.bounds();
      if (
        bounds.bottom <= limit + 0.5 &&
        !(candidate.breakBefore && bounds.top >= forcedTop - 0.5)
      )
        low = middle + 1;
      else high = middle;
    }
    if (low >= availableLines) continue;
    let line = cell.lines[low];
    const trigger = { from: line.from, to: line.to };
    const reasons: LayoutBreakDecision["reasons"] = [
      Number.isFinite(forcedTop) ? "forced-break" : "overflow",
    ];
    let bounds = line.bounds();
    if (bounds.top >= target - 0.5) continue;
    if (
      line.lineCount! >= 4 &&
      line.lineCount! - line.lineIndex! === 1 &&
      low > 0
    ) {
      const previous = cell.lines[low - 1];
      if (previous.bounds().top >= pageStart) {
        line = previous;
        bounds = line.bounds();
        reasons.push("widow");
      }
    }
    // If only the first line of this paragraph fits, move it together with
    // the following line when both fit on a continuation page.
    if (!Number.isFinite(forcedTop) && line.lineIndex === 1 && low > 0) {
      const first = cell.lines[low - 1];
      const firstBounds = first.bounds();
      if (
        firstBounds.top >= pageStart &&
        bounds.bottom - firstBounds.top <= availableHeight
      ) {
        line = first;
        bounds = firstBounds;
        reasons.push("orphan");
      }
    }
    if (bounds.bottom - bounds.top > availableHeight + 1)
      throw Error("A table content unit is taller than its page");
    const height = target - bounds.top;
    if (height <= 0.5) continue;
    const anchor = line.lineIndex === 0 ? line.anchor : undefined;
    changes.push({
      cell,
      line,
      bounds,
      height,
      decision: {
        kind: "break",
        placement: anchor || line.kind === "block" ? "block" : "line",
        from: anchor?.from ?? line.from,
        to: anchor?.to ?? line.to,
        reasons,
        trigger,
        container: { from: cell.from, to: cell.from + cell.node.nodeSize },
        fromPage: page.fromPage,
        toPage: page.fromPage + 1,
        beforeTop: bounds.top,
        beforeBottom: bounds.bottom,
        limit,
        targetTop: target,
        displacement: height,
      },
    });
  }
  return changes;
}

/** Replay the selected effects onto the measurement surface and recorded plan. */
export function applyTableBreaks(
  snapshot: LayoutSnapshot,
  layout: PageLayout,
  changes: TableBreakChange[],
) {
  for (const { line, bounds, height, decision } of changes) {
    const anchor = line.lineIndex === 0 ? line.anchor : undefined;
    if (anchor || line.kind === "block") {
      const from = anchor?.from ?? line.from;
      const to = anchor?.to ?? line.to!;
      const margin = snapshot.margin(from, height);
      recordPageBreak(
        layout,
        {
          from,
          to,
          top: bounds.top,
          bottom: bounds.bottom,
          kind: "block",
          ...margin,
        },
        decision,
      );
    } else {
      snapshot.spacer(line.from, height);
      recordPageBreak(
        layout,
        {
          from: line.from,
          top: bounds.top,
          bottom: bounds.bottom,
          kind: "line",
          height,
        },
        decision,
      );
    }
  }
}
