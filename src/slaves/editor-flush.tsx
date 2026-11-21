import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useCurrentEditor } from "@/hooks/use-editor";
import { useChapterStore } from "@/hooks/use-chapter";
import { getEditorChapter } from "@/editor/event";
import { Manager } from "@/editor/manager";
import { documentSaving } from "@/editor/document/saving";
import { captureDocumentArchive, flushDocumentChanges } from "@/editor/document/archive";
import { Exporter } from "@/utils/htx/exporter";
import { Storage } from "@/editor/storage";
import { documentFiles } from "@/editor/document/file-source";

export const EditorFlushSlave = () => {
  const { editor } = useCurrentEditor();
  const { chapter } = useChapterStore();
  const { id } = useParams();
  const initialized = useRef<string | undefined>();
  useEffect(() => {
    if (
      !id ||
      !chapter?.document?.ready ||
      initialized.current === id ||
      !window.editor?.ready
    )
      return;
    const bound = editor ? getEditorChapter(editor) : undefined;
    if (!chapter.frozen && (bound !== chapter || !editor?.isEditable)) return;
    initialized.current = id;
    void (async () => {
      const initialContent = editor?.state.doc;
      // Capture Tiptap's normalized starting content before tracking user edits.
      if (editor?.isEditable && bound === chapter)
        await Manager.emit("update", { editor });
      await Storage.instance.waitForDocument(id);
      const { buffer } = await new Exporter(id).buildExport();
      // Never mark user edits made during initialization as the clean file baseline.
      const source = !editor || editor.state.doc === initialContent
        ? await documentFiles.initialized(id, buffer)
        : undefined;
      await documentSaving.start(id, buffer);
      await window.editor.ready(buffer, source);
    })().catch((error) => {
      initialized.current = undefined;
      console.error("Could not initialize archive tracking", error);
    });
  }, [id, chapter, editor]);
  useEffect(() => () => documentSaving.stop(), [id]);
  useEffect(() => {
    const off = window.editor?.onCloseState?.((locked) => {
      document.body.inert = locked;
    });
    return () => {
      off?.();
      document.body.inert = false;
    };
  }, []);
  useEffect(() => {
    return window.editor?.onFlush?.((request, documentId, archive) => {
      void (async () => {
        try {
          if (id !== documentId) throw new Error("Editor document changed");
          if (!archive) {
            await flushDocumentChanges(documentId, editor, chapter);
            window.editor.completeFlush(request);
            return;
          }
          const captured = await captureDocumentArchive(documentId, editor, chapter);
          const snapshot: EditorArchiveSnapshot = {
            buffer: captured.buffer,
            fileName: captured.fileName,
          };
          if (archive === "save") {
            const result = await documentSaving.save(captured);
            if (result.status === "saved") snapshot.filePath = result.filePath;
            if (result.status === "failed") throw Error(result.error.detail);
          }
          window.editor.completeFlush(request, undefined, snapshot);
        } catch (error) {
          window.editor.completeFlush(
            request,
            error instanceof Error ? error.message : String(error),
          );
        }
      })();
    });
  }, [editor, chapter, id]);
  return null;
};
