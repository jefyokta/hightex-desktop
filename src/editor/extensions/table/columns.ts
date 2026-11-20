/** Preserve measured columns when a table is split or its body is absent. */
export function copyTableColumns(columns: Element, scale = 1): HTMLElement {
  const copy = columns.cloneNode(true) as HTMLElement;
  Array.from(columns.children).forEach((column, index) => {
    const style = (copy.children[index] as HTMLElement).style;
    style.width =
      style.minWidth =
      style.maxWidth =
        `${column.getBoundingClientRect().width / scale}px`;
  });
  return copy;
}
