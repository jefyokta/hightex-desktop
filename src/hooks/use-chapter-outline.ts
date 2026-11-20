import { useEffect, useMemo, useState } from "react";
import { useEditorState } from "@tiptap/react";
import type { Chapter } from "@/editor/chapter";
import { ChapterGraph } from "@/editor/chapter/chapter-graph";
import { chapterOutline } from "@/editor/chapter/outline";
import { getEditorChapter } from "@/editor/event";
import { Manager } from "@/editor/manager";
import { useCurrentEditor } from "./use-editor";

/** Active headings follow the buffer; other chapters use their existing graph. */
export function useChapterOutline(chapter: Chapter) {
  const { editor } = useCurrentEditor();
  const source = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor && getEditorChapter(editor)?.getId() === chapter.getId()
        ? editor.state.doc
        : null,
  });
  const [headings, setHeadings] = useState(chapter.graph.data.headings ?? []);
  useEffect(() => {
    setHeadings(chapter.graph.data.headings ?? []);
    return Manager.app.on("chapter:update", ({ chapter: updated }) => {
      if (updated.getId() === chapter.getId())
        setHeadings([...(updated.graph.data.headings ?? [])]);
    });
  }, [chapter]);

  return useMemo(() => {
    const current = source
      ? ChapterGraph.extractFromContent({ chapter, content: source.toJSON() }).headings
      : headings;
    return chapterOutline(current);
  }, [chapter, source, headings]);
}
