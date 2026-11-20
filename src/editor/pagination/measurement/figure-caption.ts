/** Prefer a whole short caption; long captions reserve their opening lines only. */
export function captionImageHeight(
  available: number,
  insets: number,
  caption: { top: number; bottom: number },
  lines: readonly { top: number; bottom: number }[],
) {
  const count = lines.length <= 3 ? lines.length : 2;
  const tail = lines.length
    ? Math.max(0, caption.bottom - lines[lines.length - 1].bottom)
    : 0;
  const reserved = count
    ? Math.max(0, lines[count - 1].bottom - caption.top) + tail
    : caption.bottom - caption.top;
  const remaining = available - Math.max(0, insets) - reserved;
  // If opening caption lines alone fill the page, let the caption follow the
  // image on a later page; never drop its text or shrink its typography.
  return remaining >= 1
    ? remaining
    : Math.max(1, available - Math.max(0, insets));
}
