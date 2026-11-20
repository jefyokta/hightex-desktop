/** Calibrate collapsed margins against actual displacement on an isolated surface. */
export function calibratePageMargin(element: HTMLElement, height: number) {
  const before = element.getBoundingClientRect().top;
  const original = parseFloat(getComputedStyle(element).marginTop) || 0;
  element.style.setProperty("--editor-original-margin", `${original}px`);
  element.classList.add("editor-pagination-block");
  let cssHeight = height;
  let previous: { css: number; moved: number } | undefined;
  // Sibling margins can collapse, and table minimum heights can absorb an initial
  // displacement. Calibrate CSS against movement instead of assuming additivity.
  for (let attempt = 0; attempt < 8; attempt++) {
    element.style.setProperty("--editor-break-height", `${cssHeight}px`);
    const moved = element.getBoundingClientRect().top - before,
      error = height - moved;
    if (Math.abs(error) <= 0.05)
      return { height: cssHeight, marginTop: original };
    const slope = previous
      ? (moved - previous.moved) / (cssHeight - previous.css)
      : 1;
    previous = { css: cssHeight, moved };
    cssHeight += error / (Number.isFinite(slope) && slope > 0 ? slope : 1);
  }
  throw Error("A block page break did not reach its measured position");
}
