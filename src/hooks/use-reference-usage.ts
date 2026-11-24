import { useCallback, useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import { ReferenceRepository } from "@/editor/storage/reference-repository";
import { citationUsageIndex, type UsageChapter, type UsageLocation } from "@/editor/document/reference-usage";
import { getEditorChapter } from "@/editor/event";
import { useCurrentEditor } from "./use-editor";

export function useReferenceUsage(documentId?: string) {
  const { editor } = useCurrentEditor();
  const repository = useMemo(() => new ReferenceRepository(), []);
  const [stored, setStored] = useState<{ scope?: string; chapters: UsageChapter[] }>();
  const [buffer, setBuffer] = useState<UsageChapter>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    setStatus("loading");
    const subscription = liveQuery(() => repository.usageChapters(documentId)).subscribe({
      next(chapters) {
        setStored({ scope: documentId, chapters });
        setStatus("ready");
      },
      error() { setStatus("error"); },
    });
    return () => subscription.unsubscribe();
  }, [repository, documentId, revision]);

  useEffect(() => {
    const update = () => {
      const chapter = editor && getEditorChapter(editor);
      setBuffer(chapter && editor?.isEditable ? {
        id: chapter.getId(),
        documentId: chapter.getDocumentId(),
        content: editor.getJSON().content ?? [],
      } : undefined);
    };
    update();
    editor?.on("update", update);
    return () => { editor?.off("update", update); };
  }, [editor]);

  const byKey = useMemo(() => {
    if (!stored || stored.scope !== documentId) return new Map<string, UsageLocation[]>();
    const chapters = [...stored.chapters];
    if (buffer && (!documentId || buffer.documentId === documentId)) {
      const documentTitle = stored.chapters.find(chapter => chapter.documentId === buffer.documentId)?.documentTitle;
      const index = chapters.findIndex(chapter => chapter.id === buffer.id);
      const current = { ...buffer, documentTitle };
      if (index < 0) chapters.push(current);
      else chapters[index] = current;
    }
    return citationUsageIndex(chapters);
  }, [stored, buffer, documentId]);

  return { byKey, status: status === "error" ? status : stored?.scope !== documentId ? "loading" as const : status, retry };
}
