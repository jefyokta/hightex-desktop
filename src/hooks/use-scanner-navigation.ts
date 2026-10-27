import { useNavigate, useParams as useRouteParams } from "react-router-dom";
import type { ScanDiagnostic } from "@hightex/scanner";
import { toast } from "sonner";
import { useCurrentEditor } from "@/hooks/use-editor";
import { useParams } from "@/hooks/use-params";
import { getEditorChapter } from "@/editor/event";
import {
  encodeScannerDiagnostic,
  focusScannerDiagnostic,
  scannerChapterRoute,
} from "@/scanner/navigation";

export function useScannerNavigation() {
  const { editor } = useCurrentEditor();
  const { id } = useRouteParams();
  const { setParams } = useParams();
  const go = useNavigate();

  return (diagnostic: ScanDiagnostic) => {
    const route = scannerChapterRoute(diagnostic.chapterId, id);
    if (!route) return;
    if (editor && getEditorChapter(editor)?.getId() === diagnostic.chapterId) {
      if (!focusScannerDiagnostic(editor, diagnostic)) {
        toast.info("Temuan tidak lagi ditemukan. Jalankan scan ulang.");
      }
      return;
    }
    setParams([encodeScannerDiagnostic(diagnostic)]);
    go(route);
  };
}
