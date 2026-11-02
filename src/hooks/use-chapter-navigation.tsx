import { useCallback } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import type { Chapter } from "@/editor/chapter";
import { useChapterStore } from "@/hooks/use-chapter";

export function useChapterNavigation() {
  const { chapter: activeChapter } = useChapterStore();
  const match = useMatch("/document/:id/:chapter?/:version?");
  const navigate = useNavigate();
  const { id, chapter: routeChapter = "1", version } = match?.params ?? {};
  const chapterId = `${id}.${routeChapter}${version ? `.${version}` : ""}`;
  // Disable navigation while a different document/chapter is still loading.
  const chapter =
    match && activeChapter?.getId() === chapterId ? activeChapter : null;
  const chapters = chapter?.document.chapters ?? [];
  const index = chapters.findIndex((item) => item.getId() === chapterId);
  const first = chapters[0];
  const previous = index > 0 ? chapters[index - 1] : undefined;
  const following = index >= 0 ? chapters[index + 1] : undefined;

  const goTo = useCallback(
    (target: Chapter | undefined) => {
      if (!chapter || !target || target.getId() === chapter.getId()) return;
      const version = target.getVersion();
      navigate(
        `/document/${target.getDocumentId()}/${target.getChapter()}${version ? `/${version}` : ""}`,
      );
    },
    [chapter, navigate],
  );

  const back = useCallback(() => goTo(previous), [goTo, previous]);
  const next = useCallback(() => goTo(following), [goTo, following]);
  // App navigation requests can cycle; toolbar buttons stop at the ends.
  const cycleNext = useCallback(() => {
    if (index < 0) return;
    goTo(following ?? first);
  }, [goTo, following, first, index]);

  return {
    chapter,
    chapters,
    index,
    total: chapters.length,
    previous,
    following,
    canBack: !!previous,
    canNext: !!following,
    back,
    next,
    cycleNext,
    goTo,
  };
}
