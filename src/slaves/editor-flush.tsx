import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useCurrentEditor } from "@/hooks/use-editor";
import { useChapterStore } from "@/hooks/use-chapter";
import { getEditorChapter } from "@/editor/event";
import { Manager } from "@/editor/manager";
import { documentDrafts } from "@/editor/document-drafts";
import { Exporter } from "@/utils/htx/exporter";
import { Storage } from "@/editor/storage";

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
      // Capture Tiptap's normalized starting content before tracking user edits.
      if (editor?.isEditable && bound === chapter)
        await Manager.emit("update", { editor });
      await Storage.instance.waitForDocument(id);
      const { buffer } = await new Exporter(id).buildExport();
      await window.editor.ready(buffer);
    })().catch((error) => {
      initialized.current = undefined;
      console.error("Could not initialize archive tracking", error);
    });
  }, [id, chapter, editor]);
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
          const boundChapter = editor ? getEditorChapter(editor) : undefined;
          if (
            boundChapter?.getDocumentId() === documentId &&
            editor?.isEditable
          ) {
            await Manager.emit("update", { editor });
          } else if (
            !chapter?.frozen ||
            chapter.getDocumentId() !== documentId
          ) {
            throw new Error("Editor is not ready to save");
          }
          await Storage.instance.waitForDocument(documentId);
          let snapshot: EditorArchiveSnapshot | undefined;
          if (archive) {
            const draft = documentDrafts.get(documentId);
            const { buffer, document } = await new Exporter(
              documentId,
            ).buildExport(undefined, draft?.document);
            snapshot = {
              buffer,
              fileName: `${document.title.replace(/[^a-zA-Z0-9-_. ]/g, "-")}.hightex`,
            };
            if (archive === "save") {
              snapshot.filePath = await window.editor.save(
                buffer,
                snapshot.fileName,
              );
              if (snapshot.filePath) {
                await draft?.commit();
                await chapter?.document.setFilePath(snapshot.filePath);
              }
            }
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
