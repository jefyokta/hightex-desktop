import { useIPC } from "@/hooks/use-ipc";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/core";
import type { Chapter } from "@/editor/chapter";
import { captureDocumentArchive, flushDocumentChanges } from "@/editor/document/files/archive";
import { documentSaving } from "@/editor/document/files/saving";
import { confirm } from "@/utils/confirm";
import { t } from "@/utils/lang";
import { getEditorChapter } from "@/editor/event";
import { documentFiles } from "@/editor/document/files/source";
import { toast } from "sonner";

export function useSaveDocument(editor: Editor | null, chapter: Chapter | null) {
  const state = useSyncExternalStore(documentSaving.subscribe, documentSaving.read);
  const capturing = useRef(false);
  const [preparing, setPreparing] = useState(false);
  useEffect(() => documentSaving.watchChapter({
    snapshot() {
      const bound = editor && !editor.isDestroyed ? getEditorChapter(editor) : undefined;
      if (!editor?.isEditable || !bound || bound !== chapter) return;
      return { id: bound.getId(), content: editor.getJSON().content ?? [] };
    },
    async flush() {
      if (chapter) await flushDocumentChanges(chapter.document.id, editor, chapter);
    },
  }), [editor, chapter]);
  useEffect(() => {
    const changed = () => documentSaving.changed();
    editor?.on("update", changed);
    return () => { editor?.off("update", changed); };
  }, [editor]);

  const save = useCallback(async (mode: DocumentSaveMode = "save") => {
    if (!chapter?.document.ready || capturing.current || documentSaving.read().saving) return;
    capturing.current = true;
    setPreparing(true);
    try {
      const archive = await captureDocumentArchive(chapter.document.id, editor, chapter);
      await documentSaving.save(archive, mode);
    } catch (error) {
      documentSaving.failed(error);
    } finally {
      capturing.current = false;
      setPreparing(false);
    }
  }, [editor, chapter]);

  const reload = useCallback(async () => {
    if (!chapter || documentSaving.read().saving) return;
    if (!await confirm({
      title: t("editor.save.reload_title"), desc: t("editor.save.reload_description"),
      confirmText: t("editor.save.reload"), cancelText: t("common.cancel"),
    })) return;
    try {
      const archive = await captureDocumentArchive(chapter.document.id, editor, chapter);
      await documentSaving.reload(archive);
    } catch (error) { documentSaving.failed(error, "io"); }
  }, [editor, chapter]);

  const refresh = () => documentSaving.reconcile();
  const locate = () => {
    if (chapter) return documentFiles.locate(chapter.document.id);
  };
  const reveal = async () => {
    if (!state.path) return;
    try {
      await useIPC("file").file.showInFolder(state.path);
    } catch (error) {
      toast.error(t("editor.save.reveal_failed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  useEffect(() => {
    if (!chapter?.document.ready) return;
    const keydown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (!event.repeat) void save(event.shiftKey ? "save-as" : "save");
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [chapter, save]);

  return { save, reload, refresh, locate, reveal, state: { ...state, saving: state.saving || preparing } };
}
