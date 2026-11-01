import { useLayoutEffect, type RefObject } from "react";
import { trackChapterScroll } from "@/editor/chapter/scroll-position";

export function useChapterScroll(
  chapterId: string | undefined,
  ready: boolean,
  contentRef: RefObject<HTMLElement>,
  restore = true,
) {
  useLayoutEffect(() => {
    const container = document.getElementById("main-scroll");
    const content = contentRef.current;
    if (!chapterId || !ready || !container || !content) return;

    return trackChapterScroll(chapterId, container, content, restore);
  }, [chapterId, ready, contentRef, restore]);
}
