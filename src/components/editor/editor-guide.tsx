import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GuidePlanTour } from "@/components/dashboard/guide-plan-tour";
import { useUIGuide } from "@/hooks/use-ui-guide";
import { useChapterStore } from "@/hooks/use-chapter";
import { useExpandableSidebar } from "@/hooks/use-expandable-sidebar";
import { useCurrentEditor } from "@/hooks/use-editor";
import { getEditorChapter } from "@/editor/event";
import "@/css/workspace.css";

export const EditorGuide = () => {
  const guide = useUIGuide("editor");
  const { chapter } = useChapterStore();
  const { editor } = useCurrentEditor();
  const { open, content, setOpen, setContent } = useExpandableSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = useRef({ open, content, pathname });
  current.current = { open, content, pathname };
  const origin = useRef<typeof current.current>();
  const { replay, phase, activeGuide, index } = guide;
  const step = activeGuide?.steps[index];

  useEffect(() => {
    const start = () => void replay();
    window.addEventListener("hightex:editor-guide", start);
    return () => window.removeEventListener("hightex:editor-guide", start);
  }, [replay]);

  useEffect(() => {
    if (phase === "tour") {
      origin.current ??= current.current;
      return;
    }
    if (!origin.current) return;
    const previous = origin.current;
    origin.current = undefined;
    setOpen(previous.open);
    setContent(previous.content);
    if (current.current.pathname !== previous.pathname)
      navigate(previous.pathname);
  }, [phase, navigate, setOpen, setContent]);

  useEffect(() => {
    if (phase !== "tour" || !step?.editor || !chapter) return;
    const { sidebar, chapter: kind } = step.editor;
    if (kind) {
      const target = chapter.document.chapters.find((item) =>
        kind === "normal"
          ? item.query.isNormalChapter()
          : item.getChapter() === "abstract",
      );
      const matches =
        kind === "normal"
          ? chapter.query.isNormalChapter()
          : chapter.getChapter() === "abstract";
      if (!matches && target) navigate(target.query.url());
    }
    if (sidebar) {
      setContent(sidebar);
      setOpen(true);
    }
  }, [phase, step, chapter, setContent, setOpen, navigate]);

  const kind = step?.editor?.chapter;
  const ready =
    !kind ||
    Boolean(
      chapter &&
      editor?.isEditable &&
      !editor.isDestroyed &&
      getEditorChapter(editor) === chapter &&
      (kind === "normal"
        ? chapter.query.isNormalChapter()
        : chapter.getChapter() === "abstract"),
    );
  return <GuidePlanTour guide={guide} frozen={chapter?.frozen} ready={ready} />;
};
