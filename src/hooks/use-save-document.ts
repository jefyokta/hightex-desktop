import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { Chapter } from "@/editor/chapter";
import { getEditorChapter } from "@/editor/event";
import { Manager } from "@/editor/manager";
import { Exporter } from "@/utils/htx/exporter";
import { t } from "@/utils/lang";
import { toast } from "sonner";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useSaveDocument(
  editor: Editor | null,
  chapter: Chapter | null,
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const saving = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const currentGeneration = ++generation.current;
    setStatus("idle");
    const onUpdate = () =>
      setStatus((current) => (current === "saving" ? current : "idle"));
    editor?.on("update", onUpdate);
    return () => {
      generation.current = currentGeneration + 1;
      editor?.off("update", onUpdate);
    };
  }, [editor, chapter]);

  useEffect(() => {
    if (status !== "saved") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const save = useCallback(async (): Promise<void> => {
    const boundChapter = editor ? getEditorChapter(editor) : undefined;
    const doc = boundChapter?.document;
    if (
      saving.current ||
      !doc ||
      !chapter ||
      boundChapter !== chapter ||
      chapter.frozen ||
      chapter.document.id !== doc.id ||
      !editor ||
      editor.isDestroyed ||
      !editor.isEditable
    ) {
      return;
    }

    saving.current = true;
    const run = generation.current;
    const content = editor.state.doc;
    setStatus("saving");
    try {
      await Manager.emit("update", { editor });
      const { buffer, document } = await new Exporter(doc.id).buildExport();
      const filePath = await window.editor.save(
        buffer,
        `${document.title.replace("_", "")}.hightex`,
      );
      if (filePath) await doc.setFilePath(filePath);
      if (run === generation.current) {
        setStatus(filePath && editor.state.doc === content ? "saved" : "idle");
      }
    } catch (error) {
      console.error("Failed to save document", error);
      toast.error(t("editor.save.failed"));
      if (run === generation.current) setStatus("error");
    } finally {
      saving.current = false;
    }
  }, [editor, chapter]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !editor.isEditable || chapter?.frozen)
      return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "s"
      ) {
        return;
      }
      event.preventDefault();
      if (!event.repeat) void save();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor, chapter, save]);

  return { save, status };
}
