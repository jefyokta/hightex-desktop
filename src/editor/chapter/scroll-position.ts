type ScrollPosition = { top: number; left: number };

// Keep reading positions outside document content, for this editor window's session.
const positions = new Map<string, ScrollPosition>();

export function trackChapterScroll(
  chapterId: string,
  container: HTMLElement,
  content: HTMLElement,
  restore = true,
): () => void {
  const saved = positions.get(chapterId) ?? { top: 0, left: 0 };
  let restoring = restore;
  let frame: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observer: ResizeObserver | undefined;

  const remember = () => {
    if (restoring) return;
    positions.set(chapterId, {
      top: container.scrollTop,
      left: container.scrollLeft,
    });
  };

  const stopRestoring = () => {
    restoring = false;
    if (frame !== undefined) cancelAnimationFrame(frame);
    clearTimeout(timer);
    observer?.disconnect();
    remember();
  };

  const scheduleRestore = () => {
    if (!restoring) return;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      container.scrollTo({ ...saved, behavior: "instant" });
    });
  };

  container.addEventListener("scroll", remember, { passive: true });
  const intents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
  for (const event of intents) {
    document.addEventListener(event, stopRestoring, {
      capture: true,
      passive: true,
    });
  }

  if (restore) {
    // Images and fonts may settle after the editor becomes ready. Retry briefly,
    // but let any user interaction take control immediately.
    observer = new ResizeObserver(scheduleRestore);
    observer.observe(content);
    content.addEventListener("load", scheduleRestore, true);
    timer = setTimeout(stopRestoring, 1500);
    scheduleRestore();
  }

  return () => {
    container.removeEventListener("scroll", remember);
    for (const event of intents) {
      document.removeEventListener(event, stopRestoring, true);
    }
    content.removeEventListener("load", scheduleRestore, true);
    observer?.disconnect();
    clearTimeout(timer);
    if (frame !== undefined) cancelAnimationFrame(frame);
    // The outgoing page may already have shrunk. Keep the last recorded offset.
  };
}
