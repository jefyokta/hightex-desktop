import { editorNonContentSelector, paginationSpacer } from "../presentation/decorations";
import {
  measureTextLines,
  textPoint,
  textPointRect,
  type FlowTextRun,
  type FlowAtom,
} from "./text-lines";
import type { LayoutSnapshot } from "../measurement/layout-snapshot";
import type { LayoutUnit } from "./page-planner";

/** Addresses count source text/inline atoms only, so inserting page gaps is stable. */
function generatedTextSource(element: HTMLElement) {
  const runs: FlowTextRun[] = [],
    atoms: FlowAtom[] = [];
  let offset = 0;
  const visit = (node: Node) => {
    if (node instanceof Text) {
      if (node.length) runs.push({ from: offset, node });
      offset += node.length;
    } else if (node instanceof HTMLElement) {
      if (node.matches(editorNonContentSelector)) return;
      const display = getComputedStyle(node).display;
      if (display === "none") return;
      if (
        node.matches("br,img,hr,.katex") ||
        ["inline-block", "inline-flex"].includes(display)
      ) {
        atoms.push({
          from: offset++,
          element: node,
          hardBreak: node.tagName === "BR",
        });
      } else for (const child of node.childNodes) visit(child);
    }
  };
  for (const child of element.childNodes) visit(child);
  const point = (from: number) => textPoint(runs, from);
  const atom = (from: number) =>
    atoms.find((item) => item.from === from)?.element;
  const anchor = (from: number) =>
    textPointRect(point(from)) ?? atom(from)?.getBoundingClientRect();
  return { element, runs, atoms, emptyFrom: 0, anchor, point, atom };
}

/** Apply a recorded inline gap; no layout decision or source mutation happens here. */
export function insertGeneratedSpacer(
  element: HTMLElement,
  offset: number,
  height: number,
) {
  const source = generatedTextSource(element),
    point = source.point(offset);
  const spacer = paginationSpacer(height);
  if (point) point.node.splitText(point.offset).before(spacer);
  else {
    const atom = source.atom(offset);
    if (!atom)
      throw Error(
        `Generated text offset ${offset} is unavailable in ${element.dataset.sectionCompositionBlock}`,
      );
    atom.before(spacer);
  }
}

/** Generated DOM uses the same line boxes and planner policy, outside PM ranges. */
export async function generatedFlow(
  snapshot: LayoutSnapshot,
  before: boolean,
  checkpoint: () => Promise<void>,
): Promise<LayoutUnit[]> {
  const units: LayoutUnit[] = [];
  let group = 0;
  for (const [slot, element] of snapshot.generated) {
    group--;
    if (
      Boolean(
        element.compareDocumentPosition(snapshot.root) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ) !== before
    )
      continue;
    const source = generatedTextSource(element),
      box = element.getBoundingClientRect(),
      computed = getComputedStyle(element);
    if (element.matches("table,img,hr")) {
      units.push({
        from: 0,
        slot,
        kind: "block",
        top: box.top - snapshot.origin,
        bottom: box.bottom - snapshot.origin,
      });
      continue;
    }
    const lines = await measureTextLines(source, checkpoint);
    units.push(
      ...lines.map((line, index): LayoutUnit => {
        const rect = source.anchor(line.from) ?? box;
        return {
          from: 0,
          slot,
          offset: line.from,
          kind: "line",
          top: rect.top - snapshot.origin + line.top,
          bottom: rect.top - snapshot.origin + line.bottom,
          group,
          lineIndex: index,
          lineCount: lines.length,
          keepWithNext: /^H[1-6]$/.test(element.tagName),
          breakBefore:
            index === 0 &&
            ["page", "always", "left", "right"].includes(computed.breakBefore),
          anchor:
            index === 0
              ? {
                  from: 0,
                  to: 0,
                  top: box.top - snapshot.origin,
                  marginTop: parseFloat(computed.marginTop) || 0,
                  offset: undefined,
                }
              : undefined,
        };
      }),
    );
  }
  return units;
}
