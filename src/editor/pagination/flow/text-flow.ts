import type { Node as ModelNode } from "@tiptap/pm/model";
import type { LayoutUnit } from "./page-planner";
import { LayoutSnapshot } from "../measurement/layout-snapshot";
import { paginationNode } from "../measurement/node-layout";
import { measureTextLines, type FlowAtom, type LineMetric } from "./text-lines";

export interface FlowLine extends LayoutUnit {
  bounds(): { top: number; bottom: number };
}
interface CachedFlow {
  width: number;
  style: string;
  lines: LineMetric[];
}

/** Reuse immutable source measurements after schema round-trips, with bounded ownership. */
class SourceMeasurements<T> {
  private weak = new WeakMap<ModelNode, T>();
  private stable = new Map<
    string,
    { node: ModelNode; value: T; bytes: number }
  >();
  private bytes = 0;
  private readonly budget = 4 * 1024 * 1024;
  private key(node: ModelNode) {
    return node.attrs.id ? `${node.type.name}\0${node.attrs.id}` : undefined;
  }
  get(node: ModelNode) {
    const direct = this.weak.get(node);
    if (direct) return direct;
    const key = this.key(node),
      entry = key && this.stable.get(key);
    if (!entry || !entry.node.eq(node)) return;
    this.stable.delete(key!);
    this.stable.set(key!, entry);
    this.weak.set(node, entry.value);
    return entry.value;
  }
  set(node: ModelNode, value: T) {
    this.weak.set(node, value);
    const key = this.key(node);
    if (!key) return;
    const bytes =
      2 * (JSON.stringify(node.toJSON()).length + JSON.stringify(value).length);
    const previous = this.stable.get(key);
    if (previous) {
      this.bytes -= previous.bytes;
      this.stable.delete(key);
    }
    if (bytes > this.budget) return;
    while (this.stable.size && this.bytes + bytes > this.budget) {
      const oldest = this.stable.keys().next().value!;
      this.bytes -= this.stable.get(oldest)!.bytes;
      this.stable.delete(oldest);
    }
    this.stable.set(key, { node, value, bytes });
    this.bytes += bytes;
  }
  delete(node: ModelNode) {
    this.weak.delete(node);
    const key = this.key(node),
      entry = key && this.stable.get(key);
    if (entry) {
      this.bytes -= entry.bytes;
      this.stable.delete(key!);
    }
  }
  clear() {
    this.weak = new WeakMap();
    this.stable.clear();
    this.bytes = 0;
  }
}

export interface FurnitureMeasurement {
  height: number;
  html: string;
  compact: boolean;
}

/** Model nodes are immutable: unchanged paragraphs can reuse line measurements. */
export class FlowCache {
  private entries = new SourceMeasurements<CachedFlow>();
  private furniture = new SourceMeasurements<{
    key: string;
    value: FurnitureMeasurement;
  }>();
  measured = 0;
  reused = 0;
  get(node: ModelNode, width: number, style: string) {
    const entry = this.entries.get(node);
    if (entry && entry.style === style && Math.abs(entry.width - width) < 0.5) {
      this.reused++;
      return entry.lines;
    }
    return undefined;
  }
  set(node: ModelNode, width: number, style: string, lines: LineMetric[]) {
    this.measured++;
    this.entries.set(node, { width, style, lines });
  }
  invalidate(node: ModelNode) {
    this.entries.delete(node);
    this.furniture.delete(node);
    node.descendants((child) => {
      this.entries.delete(child);
      this.furniture.delete(child);
    });
  }
  clear() {
    this.entries.clear();
    this.furniture.clear();
  }
  getFurniture(node: ModelNode, key: string) {
    const entry = this.furniture.get(node);
    return entry?.key === key ? entry.value : undefined;
  }
  setFurniture(node: ModelNode, key: string, value: FurnitureMeasurement) {
    this.furniture.set(node, { key, value });
  }
}

/** Read line ink, including inline atoms, then partition the actual line boxes. */
export async function textFlow(
  snapshot: LayoutSnapshot,
  node: ModelNode,
  pos: number,
  cache: FlowCache,
  checkpoint: () => Promise<void>,
): Promise<FlowLine[]> {
  const element = snapshot.elements.get(pos);
  if (!element) return [];
  const box = element.getBoundingClientRect();
  const computed = getComputedStyle(element);
  const styleKey = [
    computed.font,
    computed.lineHeight,
    computed.textIndent,
    computed.textAlign,
    computed.whiteSpace,
    computed.paddingTop,
    computed.paddingBottom,
    computed.direction,
    computed.breakBefore,
  ].join("|");
  let metrics = cache.get(node, box.width, styleKey);
  if (!metrics) {
    const atoms: FlowAtom[] = [];
    node.descendants((child, offset) => {
      if (!child.isAtom || child.isText) return !child.isText;
      const from = pos + 1 + offset,
        element = snapshot.elements.get(from);
      if (element)
        atoms.push({
          from,
          element,
          hardBreak: child.type.name === "hardBreak",
        });
      return false;
    });
    metrics = (
      await measureTextLines(
        {
          element,
          runs: snapshot.textRuns(pos + 1, pos + node.nodeSize - 1),
          atoms,
          emptyFrom: pos + 1,
          anchor: (from) =>
            snapshot.charRect(from) ??
            snapshot.elements.get(from)?.getBoundingClientRect(),
        },
        checkpoint,
      )
    ).map((line) => ({ ...line, from: line.from - pos }));
    cache.set(node, box.width, styleKey, metrics);
  }
  return metrics.map((metric, index) => {
    const from = pos + metric.from;
    const anchorPos = from;
    const bounds = () => {
      const rect =
        snapshot.charRect(anchorPos) ??
        snapshot.elements.get(anchorPos)?.getBoundingClientRect() ??
        element.getBoundingClientRect();
      return {
        top: rect.top - snapshot.origin + metric.top,
        bottom: rect.top - snapshot.origin + metric.bottom,
      };
    };
    return {
      from,
      ...bounds(),
      kind: "line",
      breakBefore:
        index === 0 &&
        ["page", "always", "left", "right"].includes(computed.breakBefore),
      group: pos,
      lineIndex: index,
      lineCount: metrics!.length,
      anchor:
        index === 0
          ? {
              from: pos,
              to: pos + node.nodeSize,
              top: element.getBoundingClientRect().top - snapshot.origin,
              marginTop: parseFloat(getComputedStyle(element).marginTop) || 0,
            }
          : undefined,
      bounds,
    };
  });
}

/** Containers use the same paragraph/code rules while preserving model nesting. */
export async function collectFlow(
  snapshot: LayoutSnapshot,
  node: ModelNode,
  pos: number,
  cache: FlowCache,
  checkpoint: () => Promise<void>,
): Promise<FlowLine[]> {
  if (snapshot.completedTables.has(pos)) return [];
  if (node.isTextblock) return textFlow(snapshot, node, pos, cache, checkpoint);
  const result: FlowLine[] = [];
  for (let index = 0, offset = 0; index < node.childCount; index++) {
    const child = node.child(index);
    const childPos = pos + 1 + offset;
    if (snapshot.completedTables.has(childPos)) {
      offset += child.nodeSize;
      continue;
    }
    const element = snapshot.elements.get(childPos);
    const target = paginationNode(child, childPos);
    if (child.isTextblock || !target || target.kind === "image-figure") {
      const lines = await collectFlow(
        snapshot,
        child,
        childPos,
        cache,
        checkpoint,
      );
      if (index === 0 && lines.length && node.type.name === "listItem") {
        const rect = snapshot.elements.get(pos)?.getBoundingClientRect();
        if (rect)
          lines[0].anchor = {
            from: pos,
            to: pos + node.nodeSize,
            top: rect.top - snapshot.origin,
            marginTop:
              parseFloat(
                getComputedStyle(snapshot.elements.get(pos)!).marginTop,
              ) || 0,
          };
      }
      result.push(...lines);
    } else if (element) {
      const bounds = () => {
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top - snapshot.origin,
          bottom: rect.bottom - snapshot.origin,
        };
      };
      result.push({
        from: childPos,
        to: childPos + child.nodeSize,
        ...bounds(),
        kind: "block",
        breakBefore: child.type.name === "horizontalRule",
        marginTop: parseFloat(getComputedStyle(element).marginTop) || 0,
        bounds,
      });
    }
    offset += child.nodeSize;
    await checkpoint();
  }
  if (node.type.name === "imageFigure" && result[0]?.kind === "block") {
    const element = snapshot.elements.get(pos)!;
    result[0].keepWithNext = true;
    result[0].lineIndex = 0;
    result[0].anchor = {
      from: pos,
      to: pos + node.nodeSize,
      top: element.getBoundingClientRect().top - snapshot.origin,
      marginTop: parseFloat(getComputedStyle(element).marginTop) || 0,
    };
  }
  return result;
}

/** Drop measuring callbacks before units become portable page-plan effects. */
export function flowUnits(
  lines: readonly FlowLine[],
  keepWithNext = false,
): LayoutUnit[] {
  return lines.map((line) => ({
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
    keepWithNext: keepWithNext || line.keepWithNext,
    breakBefore: line.breakBefore,
  }));
}
