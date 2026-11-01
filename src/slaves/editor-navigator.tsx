import { Manager } from "@/editor/manager";
import { useChapterNavigation } from "@/hooks/use-chapter-navigation";
import { useEffect } from "react";

export const EditorNavigatorSlave = () => {
  const { chapters, cycleNext, goTo } = useChapterNavigation();

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        cycleNext();
        return;
      }

      if (!/^[0-9]$/.test(e.key)) return;
      const target = e.key === "0" ? "attachment" : e.key;
      const chapter = chapters.find((item) => item.getChapter() === target);
      if (!chapter) return;

      e.preventDefault();
      goTo(chapter);
    };

    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [chapters, cycleNext, goTo]);

  useEffect(() => {
    return Manager.app.on("navigate:next", cycleNext);
  }, [cycleNext]);

  return null;
};
