import { useNavigate, useParams as useRouteParams } from "react-router-dom";
import type { Editor } from "@tiptap/core";
import { toast } from "sonner";
import { t } from "@/utils/lang";
import { useCurrentEditor } from "@/hooks/use-editor";
import { useParams } from "@/hooks/use-params";
import { getEditorChapter } from "@/editor/event";
import {
  encodeScannerDiagnostic,
  focusEditorDiagnostic,
  type EditorDiagnostic,
  scannerChapterRoute,
} from "@/scanner/navigation";

export function useScannerNavigation(activeEditor?: Editor) {
  const current = useCurrentEditor();
  const editor = activeEditor ?? current.editor;
  const { id: routeId } = useRouteParams();
  const id =
    routeId ?? (editor ? getEditorChapter(editor)?.getDocumentId() : undefined);
  const { setParams } = useParams();
  const go = useNavigate();

  return async (diagnostic: EditorDiagnostic) => {
    const route = scannerChapterRoute(diagnostic.chapterId, id);
    if (!route) return;
    if (editor && getEditorChapter(editor)?.getId() === diagnostic.chapterId) {
      if (!(await focusEditorDiagnostic(editor, diagnostic))) {
        toast.info(
          t(
            diagnostic.source
              ? "editor.pagination.source_stale"
              : "editor.inline.scanner_stale",
          ),
        );
      }
      return;
    }
    setParams([encodeScannerDiagnostic(diagnostic)]);
    go(route);
  };
}
