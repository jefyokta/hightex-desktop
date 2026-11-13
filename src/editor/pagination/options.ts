export interface PaginationOptions {
  margins?: Partial<{ top: number; right: number; bottom: number; left: number }>;
  repeatTableHeader?: boolean;
  repeatTableCaption?: boolean;
}

export interface PaginationGeometry {
  width: number;
  height: number;
  gap: number;
  margins: { top: number; right: number; bottom: number; left: number };
  contentHeight: number;
  contentWidth: number;
  stride: number;
  repeatTableHeader: boolean;
  repeatTableCaption: boolean;
}

const mm = (value: number) => value * 96 / 25.4;
export function paginationGeometry(options: PaginationOptions = {}): PaginationGeometry {
  const margins = { top: 30, right: 30, bottom: 30, left: 30, ...options.margins };
  for (const value of Object.values(margins))
    if (!Number.isFinite(value) || value < 0) throw RangeError("Pagination margins must be finite, nonnegative millimetres");
  if (210 - margins.left - margins.right < 20 || 297 - margins.top - margins.bottom < 20)
    throw RangeError("Pagination margins must leave at least 20 mm of content width and height");
  for (const value of [options.repeatTableHeader, options.repeatTableCaption])
    if (value !== undefined && typeof value !== "boolean") throw TypeError("Table repetition options must be booleans");
  const pixels = { top: mm(margins.top), right: mm(margins.right), bottom: mm(margins.bottom), left: mm(margins.left) };
  return {
    width: mm(210), height: mm(297), gap: 24, margins: pixels,
    contentHeight: mm(297) - pixels.top - pixels.bottom,
    contentWidth: mm(210) - pixels.left - pixels.right,
    stride: mm(297) + 24,
    repeatTableHeader: options.repeatTableHeader ?? true,
    repeatTableCaption: options.repeatTableCaption ?? true,
  };
}

export const DEFAULT_PAGINATION = paginationGeometry();

/** Preserve separately configured sides when updating a subset of options. */
export function mergePaginationOptions(previous: PaginationOptions, patch: PaginationOptions): PaginationOptions {
  const next = { ...previous, ...patch, margins: { ...previous.margins, ...patch.margins } };
  paginationGeometry(next);
  return next;
}

export function applyPageGeometry(element: HTMLElement, page: PaginationGeometry) {
  for (const [side, value] of Object.entries(page.margins))
    element.style.setProperty(`--editor-margin-${side}`, `${value}px`);
  element.style.setProperty("--editor-content-width", `${page.contentWidth}px`);
}
