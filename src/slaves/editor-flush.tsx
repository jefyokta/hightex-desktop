import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useCurrentEditor } from "@/hooks/use-editor";
import { useChapterStore } from "@/hooks/use-chapter";
import { getEditorChapter } from "@/editor/event";
import { Manager } from "@/editor/manager";
import { Storage } from "@/editor/storage";

export const EditorFlushSlave = () => {
  const { editor } = useCurrentEditor();
  const { chapter } = useChapterStore();
  const { id } = useParams();
  useEffect(() => {
    return window.editor?.onFlush?.((request, documentId) => {
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
            throw new Error("Editor is not ready for PDF export");
          }
          await Storage.instance.waitForDocument(documentId);
          window.editor.completeFlush(request);
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
