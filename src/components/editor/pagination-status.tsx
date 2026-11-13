import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { paginationKey } from "@/editor/pagination";
import { t, useAppLanguage } from "@/utils/lang";
import { Button } from "@/components/ui/button";
import { PaginationFeedback } from "./pagination-feedback";
import { toast } from "sonner";

export function PaginationStatus({ editor }: { editor: Editor | null }) {
  useAppLanguage();
  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      const state = editor && paginationKey.getState(editor.state);
      return {
        enabled: state?.enabled ?? false,
        pages: state?.layout.pages ?? 1,
        error: state?.layout.error ?? false,
        pending: state?.pending ?? false,
      };
    },
  });
  if (!state?.enabled) return null;
  return (
    <div
      className="w-[21cm] max-w-full space-y-1 px-1 pb-2 text-xs text-muted-foreground"
      data-pagination-status
      data-tour="editor-pagination-status"
    >
      <p role="status">
        {state.error
          ? t("editor.pagination.error")
          : state.pending
            ? t("editor.pagination.updating")
            : t("editor.pagination.pages", { count: state.pages })}
      </p>
      <p>{t("editor.pagination.experimental_notice")}</p>
      <div className="flex flex-wrap items-center gap-2">
        {state.error && (
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
            {t("editor.pagination.retry")}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-pagination-disable
          onClick={() => {
            editor?.commands.setEditorPagination(false);
            void window.config
              .set({ editor: { pagination: false } })
              .catch(() => {
                toast.error(t("editor.pagination.disable_save_failed"));
              });
          }}
        >
          {t("editor.pagination.disable")}
        </Button>
        <PaginationFeedback editor={editor} />
      </div>
    </div>
  );
}
