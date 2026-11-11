import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { paginationKey } from "@/editor/pagination";
import { t, useAppLanguage } from "@/utils/lang";

export function PaginationStatus({ editor }: { editor: Editor | null }) {
  useAppLanguage();
  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      const state = editor && paginationKey.getState(editor.state);
      return {
        enabled: state?.enabled ?? false,
        pages: state?.layout.pages ?? 1,
        unsupported: state?.layout.unsupported ?? false,
      };
    },
  });
  if (!state?.enabled) return null;
  return (
    <p
      className="w-[21cm] max-w-full px-1 pb-2 text-xs text-muted-foreground"
      data-pagination-status
      role="status"
    >
      {state.unsupported
        ? t("editor.pagination.unsupported")
        : t("editor.pagination.pages", { count: state.pages })}
    </p>
  );
}
