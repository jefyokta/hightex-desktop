import { useEffect, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import type { Document } from "@/editor/document";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t } from "@/utils/lang";
import { CodeXml, FileDown, Loader2, MoreHorizontal, SquareTerminal, X } from "lucide-react";
import { PaginationDiagnostics } from "./pagination-diagnostics";
import { useDocumentPDF } from "@/hooks/use-document-pdf";

export function EditorPDFExperimental({
  editor,
  disabled,
  status,
  options,
}: {
  editor: Editor | Document;
  disabled: boolean;
  status?: ReactNode;
  options?: ReactNode;
}) {
  const {
    phase, busy, error, section, warnings, diagnostics,
    exportButton, prepare, dismiss,
  } = useDocumentPDF(editor);
  const [optionsOpen, setOptionsOpen] = useState(false);
  useEffect(() => setOptionsOpen(false), [editor]);
  const progressText = {
    idle: "",
    capture: section
      ? t("editor.pagination.pdf_preparing_section", { section })
      : t("common.preparing_pdf"),
    export: t("editor.pagination.pdf_saving"),
    debug: t("editor.pagination.pdf_debug_open"),
  }[phase];

  return (
    <section className="w-full min-w-0 space-y-2" aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        {status && (
          <div className="min-w-0 flex-1" role="status">
            {status}
          </div>
        )}
        <Button
          ref={exportButton}
          type="button"
          size="sm"
          data-editor-pdf-export
          title={t("editor.pagination.pdf_description")}
          disabled={disabled || busy}
          onClick={() => void prepare("export")}
        >
          <FileDown className="size-4" />
          {t("editor.pagination.pdf_action")}
        </Button>

        {(options || import.meta.env.DEV) && (
          <Popover open={optionsOpen} onOpenChange={setOptionsOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                data-editor-pdf-options
                aria-label={t("editor.pagination.pdf_options")}
                title={t("editor.pagination.pdf_options")}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              data-editor-pdf-options-panel
              aria-label={t("editor.pagination.pdf_options")}
              className="max-h-[var(--radix-popover-content-available-height)] w-72 max-w-[calc(100vw-1.5rem)] space-y-1 overflow-y-auto p-3 text-xs [&>button]:w-full [&>button]:justify-start"
            >
              {options}
              {import.meta.env.DEV && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  data-editor-pdf-debug
                  disabled={disabled || busy}
                  onClick={() => {
                    setOptionsOpen(false);
                    void prepare("debug");
                  }}
                >
                  <CodeXml className="size-4" /> Debug HTML
                </Button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
      {busy && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
          {phase === "debug" ? (
            <SquareTerminal className="size-4 shrink-0" />
          ) : (
            <Loader2 className="size-4 shrink-0 animate-spin" />
          )}
          <span
            role="status"
            data-editor-pdf-progress
            className="min-w-0 flex-1 break-words"
          >
            {progressText}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-editor-pdf-cancel
            onClick={dismiss}
          >
            <X className="size-3" />
            {phase === "debug"
              ? t("editor.pagination.pdf_close_debug")
              : t("common.cancel")}
          </Button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          data-editor-pdf-error
          className="whitespace-pre-wrap break-words rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive"
        >
          {error}
        </p>
      )}
      {warnings > 0 && !error && (
        <p
          role="status"
          data-editor-pdf-warning
          className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed"
        >
          {t("editor.pagination.pdf_missing_references", { count: warnings })}
        </p>
      )}
      {diagnostics.length > 0 && (
        <PaginationDiagnostics
          diagnostics={diagnostics}
          editor={"commands" in editor ? editor : undefined}
        />
      )}
    </section>
  );
}
