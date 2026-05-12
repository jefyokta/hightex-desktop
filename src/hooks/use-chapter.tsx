import { create } from "zustand";
import { Chapter } from "@/editor/chapter";

interface ChapterStore {
  chapter: Chapter | null;
  setChapter: (c: Chapter | null) => void;
}

export const useChapterStore = create<ChapterStore>((set) => ({
  chapter: null,
  setChapter: (chapter) => set({ chapter }),
}));
