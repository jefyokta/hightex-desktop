/** Fill the final title line to the page column; dots share one right-aligned rhythm. */
export function fillIndexLeaders(root: HTMLElement) {
  for (const row of root.querySelectorAll<HTMLElement>(".toc-row")) {
    const dots = row.querySelector<HTMLElement>(".toc-dots");
    const inner = row.querySelector<HTMLElement>(".toc-inner");
    if (!dots || !inner) continue;
    // Reserve three dots first, moving to a fresh line when the title fills it.
    dots.style.width = "18px";
    const start = dots.getBoundingClientRect();
    const end = inner.getBoundingClientRect();
    dots.style.width = `${Math.max(18, end.right - start.left)}px`;
  }
}
