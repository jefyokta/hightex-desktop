interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Link annotations cover the visible intersection of a template's column viewport. */
export function intersectLayoutRect(rect: Bounds, clip: Bounds) {
  const left = Math.max(rect.left, clip.left),
    top = Math.max(rect.top, clip.top);
  const right = Math.min(rect.right, clip.right),
    bottom = Math.min(rect.bottom, clip.bottom);
  return right > left && bottom > top
    ? { left, top, right, bottom, width: right - left, height: bottom - top }
    : undefined;
}
