import { visualLineEnd } from "./visual-line";

export interface FlowTextRun {
  from: number;
  node: Text;
}
export interface FlowAtom {
  from: number;
  element: HTMLElement;
  hardBreak?: boolean;
}
export interface LineMetric {
  from: number;
  top: number;
  bottom: number;
}

export function textPoint(runs: readonly FlowTextRun[], from: number) {
  let low = 0,
    high = runs.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1,
      run = runs[middle];
    if (from < run.from) high = middle - 1;
    else if (from >= run.from + run.node.length) low = middle + 1;
    else return { node: run.node, offset: from - run.from };
  }
  return null;
}

export function textPointRect(point: { node: Text; offset: number } | null) {
  if (!point) return null;
  const range = point.node.ownerDocument.createRange();
  range.setStart(point.node, point.offset);
  range.setEnd(point.node, point.offset + 1);
  return range.getBoundingClientRect();
}

/** Browser line ink and spacing shared by authored text and generated template flow. */
export async function measureTextLines(
  source: {
    element: HTMLElement;
    runs: Iterable<FlowTextRun>;
    atoms: Iterable<FlowAtom>;
    emptyFrom: number;
    anchor(from: number): DOMRect | undefined | null;
  },
  checkpoint: () => Promise<void>,
): Promise<LineMetric[]> {
  const { element } = source;
  const box = element.getBoundingClientRect();
  const tokens: {
    from: number;
    top: number;
    bottom: number;
    atom?: boolean;
  }[] = [];
  const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 24;
  for (const run of source.runs) {
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
      cursor = visualLineEnd(cursor, run.node.length, at, first, lineHeight);
      await checkpoint();
    }
  }
  for (const { from, element: atom, hardBreak } of source.atoms) {
    const rect = atom.getBoundingClientRect();
    if (hardBreak) {
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
  }
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
        Math.min(previous.bottom - previous.top, token.bottom - token.top) * 0.3
    ) {
      previous.from = Math.min(previous.from, token.from);
      previous.top = Math.min(previous.top, token.top);
      previous.bottom = Math.max(previous.bottom, token.bottom);
      // Prefer a text position; atom geometry can have different ink.
      previous.atom = previous.atom && token.atom;
    } else groups.push({ ...token });
  }
  if (!groups.length)
    groups.push({
      from: source.emptyFrom,
      top: box.top,
      bottom: box.bottom,
      atom: true,
    });
  const style = getComputedStyle(element);
  const innerTop = box.top + (parseFloat(style.paddingTop) || 0);
  const innerBottom = box.bottom - (parseFloat(style.paddingBottom) || 0);
  return groups.map((group, index) => {
    const anchor = source.anchor(group.from) ?? box;
    const top =
      index === 0
        ? Math.min(innerTop, group.top)
        : Math.min(group.top, (groups[index - 1].bottom + group.top) / 2);
    const bottom =
      index === groups.length - 1
        ? Math.max(group.bottom, innerBottom)
        : Math.max(group.bottom, (group.bottom + groups[index + 1].top) / 2);
    return {
      from: group.from,
      top: top - anchor.top,
      bottom: bottom - anchor.top,
    };
  });
}
