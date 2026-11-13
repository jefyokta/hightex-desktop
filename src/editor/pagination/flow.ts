import type { Node as ModelNode } from "@tiptap/pm/model";
import type { LayoutUnit } from "./layout";
import { LayoutSnapshot } from "./snapshot";

interface LineMetric {
  from: number;
  top: number;
  bottom: number;
}
export interface FlowLine extends LayoutUnit {
  bounds(): { top: number; bottom: number };
}
interface CachedFlow {
  width: number;
  style: string;
  lines: LineMetric[];
}

/** Model nodes are immutable: unchanged paragraphs can reuse line measurements. */
export class FlowCache {
  private entries = new WeakMap<ModelNode, CachedFlow>();
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
    node.descendants((child) => {
      this.entries.delete(child);
    });
  }
  clear() {
    this.entries = new WeakMap();
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
  ].join("|");
  let metrics = cache.get(node, box.width, styleKey);
  if (!metrics) {
    const tokens: {
      from: number;
      top: number;
      bottom: number;
      atom?: boolean;
    }[] = [];
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 24;
    for (const run of snapshot.textRuns(pos + 1, pos + node.nodeSize - 1)) {
      let cursor = 0;
      const range = document.createRange();
      const at = (offset: number) => {
        range.setStart(run.node, offset);
        range.setEnd(run.node, offset + 1);
        return range.getBoundingClientRect();
      };
      while (cursor < run.node.length) {
        const first = at(cursor);
        if (first.height)
          tokens.push({
            from: run.from + cursor,
            top: first.top,
            bottom: first.bottom,
          });
        let low = cursor;
        let high = run.node.length - 1;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (
            Math.abs(at(middle).top - first.top) <
            Math.min(first.height, lineHeight) / 2
          )
            low = middle;
          else high = middle - 1;
        }
        cursor = low + 1;
        await checkpoint();
      }
    }
    node.descendants((child, offset) => {
      if (!child.isAtom || child.isText) return !child.isText;
      const from = pos + 1 + offset;
      const atom = snapshot.elements.get(from);
      if (!atom) return false;
      const rect = atom.getBoundingClientRect();
      if (child.type.name === "hardBreak") {
        tokens.push({
          from,
          top: rect.top,
          bottom: rect.height ? rect.bottom : rect.top + lineHeight,
          atom: true,
        });
      } else {
        // Inline node wrappers can be only one em high while their visible
        // contents (fractions, summation limits, etc.) extend above and below.
        const range = document.createRange();
        range.selectNodeContents(atom.querySelector(".katex-html") ?? atom);
        const ink = range.getBoundingClientRect();
        tokens.push({
          from,
          top: ink.height ? Math.min(rect.top, ink.top) : rect.top,
          bottom: ink.height ? Math.max(rect.bottom, ink.bottom) : rect.bottom,
          atom: true,
        });
      }
      return false;
    });
    tokens.sort((a, b) => a.top - b.top || a.from - b.from);
    const groups: typeof tokens = [];
    for (const token of tokens) {
      const previous = groups[groups.length - 1];
      const overlap = previous
        ? Math.min(previous.bottom, token.bottom) -
          Math.max(previous.top, token.top)
        : 0;
      if (
        previous &&
        overlap >
          Math.min(previous.bottom - previous.top, token.bottom - token.top) *
            0.3
      ) {
        previous.from = Math.min(previous.from, token.from);
        previous.top = Math.min(previous.top, token.top);
        previous.bottom = Math.max(previous.bottom, token.bottom);
        // Prefer a model text position; atom geometry can have different ink.
        previous.atom = previous.atom && token.atom;
      } else groups.push({ ...token });
    }
    if (!groups.length)
      groups.push({
        from: pos + 1,
        top: box.top,
        bottom: box.bottom,
        atom: true,
      });
    const style = getComputedStyle(element);
    const innerTop = box.top + (parseFloat(style.paddingTop) || 0);
    const innerBottom = box.bottom - (parseFloat(style.paddingBottom) || 0);
    metrics = groups.map((group, index) => {
      const anchor =
        snapshot.charRect(group.from) ??
        snapshot.elements.get(group.from)?.getBoundingClientRect() ??
        box;
      const top =
        index === 0
          ? Math.min(innerTop, group.top)
          : Math.min(group.top, (groups[index - 1].bottom + group.top) / 2);
      const bottom =
        index === groups.length - 1
          ? Math.max(group.bottom, innerBottom)
          : Math.max(group.bottom, (group.bottom + groups[index + 1].top) / 2);
      return {
        from: group.from - pos,
        top: top - anchor.top,
        bottom: bottom - anchor.top,
      };
    });
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
    if (
      child.isTextblock ||
      (!child.isAtom &&
        child.type.name !== "imageFigure" &&
        child.type.name !== "table")
    ) {
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
  return result;
}
