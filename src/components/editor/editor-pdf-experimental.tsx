import { useEffect, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import type { Document } from "@/editor/document";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t } from "@/utils/lang";
import { CodeXml, FileDown, Loader2, MoreHorizontal, SquareTerminal, X } from "lucide-react";
import { PaginationDiagnostics } from "./pagination-diagnostics";
import { useDocumentPDF, type DocumentPDFRequest } from "@/hooks/use-document-pdf";
import { useDocumentPDFRequest } from "@/context/document-pdf-context";

interface PDFControlsProps {
  editor: Editor | Document;
  disabled: boolean;
  status?: ReactNode;
  options?: ReactNode;
}

export function EditorPDFExperimental(props: PDFControlsProps) {
  const shared = useDocumentPDFRequest(props.editor);
  return shared ? <DocumentPDFControls {...props} request={shared} /> : <StandalonePDFControls {...props} />;
}

function StandalonePDFControls(props: PDFControlsProps) {
  const request = useDocumentPDF(props.editor);
  return <DocumentPDFControls {...props} request={request} />;
}

function DocumentPDFControls({ editor, disabled, status, options, request }: PDFControlsProps & { request: DocumentPDFRequest }) {
  const { busy, exportButton, prepare } = request;
  const [optionsOpen, setOptionsOpen] = useState(false);
  useEffect(() => setOptionsOpen(false), [editor]);

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
      <PDFRequestStatus request={request} editor={"commands" in editor ? editor : undefined} />
    </section>
  );
}

/** Shared progress, cancellation, diagnostics and outcome for editor and workspace exports. */
export function PDFRequestStatus({ request, editor }: { request: DocumentPDFRequest; editor?: Editor }) {
  const { phase, busy, error, section, sections, warnings, diagnostics, progress, elapsedMs, outcome, dismiss } = request;
  const progressText = {
    idle: "",
    capture: sections && section
      ? t("editor.pagination.pdf_preparing_sections", {...sections,section})
      : section
      ? t("editor.pagination.pdf_preparing_section", { section })
      : t("common.preparing_pdf"),
    export: t("editor.pagination.pdf_saving"),
    debug: t("editor.pagination.pdf_debug_open"),
    cancel: t("editor.pagination.pdf_cancelling"),
  }[phase];
  const nativeProgressText = progress ? {
    destination: t("editor.pagination.pdf_destination"),
    loading: t("editor.pagination.pdf_loading"),
    printing: t("editor.pagination.pdf_printing", {completed:progress.completedPages,total:progress.pages}),
    assembling: t("editor.pagination.pdf_assembling"),
    writing: t("editor.pagination.pdf_writing"),
  }[progress.stage] : undefined;
  const seconds = Math.floor(elapsedMs / 1000);
  const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,"0")}`;


  return <>
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
            data-editor-pdf-phase={phase}
            className="min-w-0 flex-1 break-words"
          >
            {phase === "export" ? nativeProgressText ?? progressText : progressText}
          </span>
          <span role="timer" aria-live="off" data-editor-pdf-elapsed className="shrink-0 tabular-nums text-muted-foreground">
            {t("editor.pagination.pdf_elapsed", {duration})}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-editor-pdf-cancel
            disabled={phase === "cancel"}
            onClick={dismiss}
          >
            <X className="size-3" />
            {phase === "debug"
              ? t("editor.pagination.pdf_close_debug")
              : t("common.cancel")}
          </Button>
        </div>
      )}
      {!busy && outcome && !error && (
        <p role="status" data-editor-pdf-completed={outcome} className="text-xs text-muted-foreground">
          {t(outcome === "saved" ? "editor.pagination.pdf_completed" : "editor.pagination.pdf_cancelled", {duration})}
        </p>
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
          editor={editor}
        />
      )}
  </>;
}
