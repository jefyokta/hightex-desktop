import { Document } from "@/editor/document";
import { Manager } from "@/editor/manager";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const EditorNavigatorSlave = () => {
  const go = useNavigate();

  const navigate = (chapter: number) => {
    const doc = Document.instance;
    if (!doc) return;

    if (chapter == 0) {
      go(`/document/${doc.id}/attachment`);
      return;
    }

    const validChapter = doc.category?.chapters?.find(
      (c) => Number(c.chapter) === chapter,
    );

    if (!validChapter) return;

    go(`/document/${doc.id}/${chapter}`);
  };

  const next = () => {
    const doc = Document.instance
    if (!doc) return;
    const chapters = doc.chapters ?? []
    const currentChapter = Document.current

    if (!currentChapter || chapters.length === 0) return

    const currentIndex = chapters.findIndex(
      (chapter) => chapter.getId() === currentChapter.getId(),
    )

    if (currentIndex === -1) return
    const n = (currentIndex + 1) % chapters.length;
    const nextChapter = chapters[n];
    if (!nextChapter) return;
    go(`/document/${doc.id}/${nextChapter.getChapter()}`);


  }

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key == 'n') {
        console.log(e)
        next();
        return;
      }

      const chapter = Number(e.key);

      if (Number.isNaN(chapter) || chapter < 0 || chapter > 9) {
        return;
      }

      e.preventDefault();
      navigate(chapter);
    };

    document.addEventListener("keydown", listener);

    return () => document.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    return Manager.app.on("navigate:next", () => {
      next()
    })
  }, [])

  return null;
};
