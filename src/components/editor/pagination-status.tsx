import { useConfig } from "@/hooks/use-config";
import { useAppLanguage } from "@/hooks/use-app-language";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { paginationKey } from "@/editor/pagination";
import { t } from "@/utils/lang";
import { Button } from "@/components/ui/button";
import { PaginationFeedback } from "./pagination-feedback";
import { toast } from "sonner";
import { EditorPDFExperimental } from "./editor-pdf-experimental";
import { PaginationDiagnostics } from "./pagination-diagnostics";
import type { PaginationDiagnostic } from "@/types/pagination/diagnostic";
import { ChapterContentError } from "@/exception/chapter-content-error";
import { useMemo } from "react";
import { AlertCircle, Layers, Loader2, RotateCcw, Monitor } from "lucide-react";
import "@/css/pagination-controls.css";

export function PaginationStatus({ editor }: { editor: Editor | null }) {
  useAppLanguage();
  const { saveConfig } = useConfig();
  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      const state = editor && paginationKey.getState(editor.state);
      return {
        enabled: state?.enabled ?? false,
        pages: state?.layout.pages ?? 1,
        error: state?.layout.error ?? false,
        detail: state?.error,
        diagnostic: state?.diagnostic,
        issues: state?.result?.issues,
        pending: state?.pending ?? false,
        documentNumbering: state?.options.documentNumbering !== false,
        numbering: state?.numbering,
      };
    },
  });
  const contentDiagnostics = useMemo(
    () =>
      (state?.issues ?? []).map((issue) => {
        const warning = new ChapterContentError([issue]);
        return {
          message: warning.message,
          code: warning.code,
          level: warning.level,
          source: issue.source,
        };
      }),
    [state?.issues],
  );
  if (!state?.enabled) return null;
  const diagnostics = [
    ...contentDiagnostics,
    ...[state.diagnostic, state.numbering?.diagnostic].filter(
      (issue): issue is PaginationDiagnostic => !!issue,
    ),
  ];
  return (
    <div
      className="pagination-controls w-[21cm] max-w-full text-xs text-muted-foreground"
      data-pagination-status
      data-tour="editor-pagination-status"
    >
      {editor && (
        <EditorPDFExperimental
          editor={editor}
          disabled={state.pending || state.error}
          status={
            <div className="pagination-mode-summary">
              <span className="pagination-mode-icon" aria-hidden="true">
                {state.error ? <AlertCircle className="size-4 text-destructive" />
                  : state.pending ? <Loader2 className="size-4 animate-spin" />
                    : <Layers className="size-4" />}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{t("editor.pagination.mode_title")}</span>
                  <span className="pagination-experimental-badge">{t("editor.pagination.experimental_badge")}</span>
                </div>
                <span
                  className="block mt-0.5 text-[11px]"
                  title={state.detail}
                >
                  {state.error
                    ? t("editor.pagination.error_title")
                    : state.pending
                      ? t("editor.pagination.updating")
                      : t("editor.pagination.page_count", { count: state.pages })}
                </span>
                {state.documentNumbering && !state.error && (
                  <span
                    className="block text-[11px]"
                    data-document-numbering-status
                    title={state.numbering?.error}
                  >
                    {state.numbering?.error
                      ? t("editor.pagination.numbering_failed")
                      : !state.numbering || state.numbering.pending
                        ? t("editor.pagination.numbering_updating")
                        : null}
                  </span>
                )}
              </div>
            </div>
          }
          options={
            <>
              <p className="px-2 pb-3 leading-relaxed text-muted-foreground">{t("editor.pagination.experimental_notice")}</p>
              {(state.error || state.numbering?.error) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-pagination-retry
                  onClick={() => {
                    editor?.commands.setEditorPagination(false);
                    editor?.commands.setEditorPagination(true);
                  }}
                >
                  <RotateCcw className="size-3.5" /> {t("editor.pagination.retry")}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-pagination-disable
                onClick={() => {
                  editor?.commands.setEditorPagination(false);
                  void saveConfig({ editor: { pagination: false } })
                    .catch(() => {
                      toast.error(t("editor.pagination.disable_save_failed"));
                    });
                }}
              >
                <Monitor className="size-3.5" /> {t("editor.pagination.disable")}
              </Button>
              <PaginationFeedback editor={editor} />
            </>
          }
        />
      )}
      {diagnostics.length > 0 && (
        <PaginationDiagnostics
          diagnostics={diagnostics}
          editor={editor ?? undefined}
        />
      )}
    </div>
  );
}
