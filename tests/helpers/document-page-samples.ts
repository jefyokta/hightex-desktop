interface ProjectedPage {
  projection?: {
    context: HTMLElement;
    geometry: { stride: number };
  };
}

/** Sample the resolved section contexts, which are shared rather than cloned per page. */
export function documentPageSamples(
  pages: readonly ProjectedPage[],
  options: { minimumTextLength?: number; preferUnique?: boolean } = {},
) {
  const contexts = new Map<HTMLElement, { first: number; stride: number }>();
  pages.forEach((page, index) => {
    if (page.projection && !contexts.has(page.projection.context))
      contexts.set(page.projection.context, { first: index + 1, stride: page.projection.geometry.stride });
  });
  const samples = new Map<number, { page: number; text: string }>();
  const candidates: { page: number; text: string }[] = [];
  const captions: { page: number; label: string; before: string; continued: boolean }[] = [];
  let textPages = 0;
  for (const [paper, { first, stride }] of contexts) {
    const origin = paper.getBoundingClientRect();
    const pageAt = (top: number) => first + Math.floor((top - origin.top) / stride);
    const walker = paper.ownerDocument.createTreeWalker(paper, NodeFilter.SHOW_TEXT);
    const occupied = new Set<number>();
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.parentElement?.closest('p,pre') || node.parentElement.closest('.katex,[data-editor-ui],.editor-pagination-furniture') || (node.textContent?.trim().length ?? 0) < (options.minimumTextLength ?? 20)) continue;
      const range = paper.ownerDocument.createRange();
      range.setStart(node, 0);range.setEnd(node, Math.min(node.textContent!.length, 80));
      const boxes = Array.from(range.getClientRects()).filter(box => box.width && box.height);
      if (!boxes.length) continue;
      const page = pageAt(boxes[0].top);
      if (boxes.some(box => pageAt(box.top) !== page)) continue;
      occupied.add(page);
      candidates.push({ page, text: range.toString() });
      if (!samples.has(page)) samples.set(page, { page, text: range.toString() });
    }
    textPages += occupied.size;
    for (const node of paper.querySelectorAll<HTMLElement>('.tiptap figcaption[data-label]')) {
      const label = node.dataset.label;
      if (label) captions.push({ page: pageAt(node.getBoundingClientRect().top), label,
        before: getComputedStyle(node, '::before').content, continued: node.classList.contains('editor-pagination-repeat-caption') });
    }
  }
  if (options.preferUnique) {
    const counts = new Map<string, number>();
    for (const candidate of candidates) counts.set(candidate.text, (counts.get(candidate.text) ?? 0) + 1);
    samples.clear();
    candidates.sort((a, b) => Number(counts.get(b.text) === 1) - Number(counts.get(a.text) === 1) || b.text.length - a.text.length);
    for (const candidate of candidates) if (!samples.has(candidate.page)) samples.set(candidate.page, candidate);
  }
  return { contexts: contexts.size, textPages, samples: Array.from(samples.values()).sort((a, b) => a.page - b.page), captions };
}
