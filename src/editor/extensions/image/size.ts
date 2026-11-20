export const DEFAULT_IMAGE_WIDTH = 200;

/** Invalid authored metadata affects presentation only; never rewrite stored attrs. */
export function imageWidth(value: unknown): number {
  const width =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : NaN;
  return Number.isFinite(width) && width > 0 ? width : DEFAULT_IMAGE_WIDTH;
}
