/** Fill the final title line to the page column; dots share one right-aligned rhythm. */
export function fillIndexLeaders(root: HTMLElement) {
  for (const row of root.querySelectorAll<HTMLElement>(".toc-row")) {
    const dots = row.querySelector<HTMLElement>(".toc-dots");
    const inner = row.querySelector<HTMLElement>(".toc-inner");
    if (!dots || !inner) continue;
    // Measure real period glyphs in the document font, as in the legacy index.
    // Reserve three before finding the final line so a long title keeps its leader.
    dots.style.width = "auto";
    dots.textContent = "...";
    const start = dots.getBoundingClientRect();
    const step = start.width / 3;
    if (!step) continue;
    const end = inner.getBoundingClientRect();
    const width = Math.max(start.width, end.right - start.left);
    dots.style.width = `${width}px`;
    dots.textContent = ".".repeat(Math.max(3, Math.floor(width / step)));
  }
}
