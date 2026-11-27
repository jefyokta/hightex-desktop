import type { Editor } from "@tiptap/core";
import { AlertCircle, Check, CheckCircle2, ChevronDown, ExternalLink, FileDown, Loader2, RotateCcw, SquareTerminal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { DocumentPDFRequest } from "@/hooks/use-document-pdf";
import { useAppLanguage } from "@/hooks/use-app-language";
import { cn } from "@/lib/utils";
import { t } from "@/utils/lang";
import { PaginationDiagnostics } from "./pagination-diagnostics";

/** One non-modal status surface for workspace and editor exports. */
export function PDFRequestStatus({ request, editor }: { request: DocumentPDFRequest; editor?: Editor }) {
  useAppLanguage();
  const { phase, busy, error, section, sections, warnings, diagnostics, progress, elapsedMs, outcome, savedFile } = request;
  if (!busy && !outcome && !error && !warnings && !diagnostics.length) return null;
  const visibleDiagnostics = diagnostics.filter(issue => issue.message !== error || Boolean(issue.source));

  const seconds = Math.floor(elapsedMs / 1000);
  const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const saved = outcome === "saved" && !error;
  const cancelling = phase === "cancel";
  const debugging = phase === "debug";
  const step = phase === "capture" || cancelling && !progress ? 0 : progress?.stage === "assembling" || progress?.stage === "writing" ? 2 : 1;
  const steps = ["pdf_step_prepare", "pdf_step_print", "pdf_step_save"] as const;
  // Each meter reports its own completed units, never an estimated overall percentage.
  const units = !cancelling && !debugging
    ? phase === "capture" ? sections : progress?.stage === "printing"
      ? { completed: progress.completedPages, total: progress.pages } : undefined
    : undefined;
  const determinate = units && units.total > 0;
  const percent = determinate ? Math.min(100, Math.max(0, units.completed / units.total * 100)) : undefined;
  const phaseText = {
    idle: "",
    capture: sections && section
      ? t("editor.pagination.pdf_preparing_sections", { ...sections, section })
      : section ? t("editor.pagination.pdf_preparing_section", { section }) : t("common.preparing_pdf"),
    export: t("editor.pagination.pdf_saving"),
    debug: t("editor.pagination.pdf_debug_open"),
    cancel: t("editor.pagination.pdf_cancelling"),
  }[phase];
  const nativeText = progress ? {
    destination: t("editor.pagination.pdf_destination"),
    loading: t("editor.pagination.pdf_loading"),
    printing: t("editor.pagination.pdf_printing", { completed: progress.completedPages, total: progress.pages }),
    assembling: t("editor.pagination.pdf_assembling"),
    writing: t("editor.pagination.pdf_writing"),
  }[progress.stage] : undefined;
  const detail = phase === "export" ? nativeText ?? phaseText : phaseText;
  const title = t(`editor.pagination.${error ? "pdf_failed" : saved ? "pdf_saved_title" : outcome === "cancelled" && !busy ? "pdf_cancelled_title" : debugging ? "pdf_debug_title" : "pdf_in_progress"}`);
  const Icon = error ? AlertCircle : saved ? CheckCircle2 : busy ? debugging ? SquareTerminal : Loader2 : FileDown;

  return (
    <section
      aria-label={t("editor.pagination.pdf_title")}
      data-editor-pdf-status
      className={cn("my-3 min-w-0 overflow-hidden rounded-xl border bg-background text-foreground", error && "border-destructive/30")}
    >
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted", error ? "bg-destructive/10 text-destructive" : saved ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "text-primary")}>
          <Icon aria-hidden="true" className={cn("size-4", busy && !debugging && "animate-spin motion-reduce:animate-none")} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p
            role={error ? "alert" : "status"}
            data-editor-pdf-error={error ? "" : undefined}
            data-editor-pdf-completed={!busy && !error ? outcome : undefined}
            className="text-sm font-medium leading-5"
          >
            {title}
          </p>
          {busy ? (
            <p role="status" data-editor-pdf-progress data-editor-pdf-phase={phase} className="break-words text-xs leading-relaxed text-muted-foreground">
              {detail}
            </p>
          ) : error ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{t("editor.pagination.pdf_failed_description")}</p>
          ) : savedFile ? (
            <p data-editor-pdf-filename className="break-words text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{savedFile.filename}</p>
          ) : outcome === "cancelled" ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{t("editor.pagination.pdf_cancelled_description")}</p>
          ) : null}
          <span role="timer" aria-live="off" data-editor-pdf-elapsed className="block text-[11px] tabular-nums text-muted-foreground">
            {t(busy ? "editor.pagination.pdf_elapsed" : "editor.pagination.pdf_duration", { duration })}
          </span>
        </div>
        {!busy && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={request.clear} aria-label={t("common.close")} data-editor-pdf-dismiss>
            <X className="size-4" />
          </Button>
        )}
      </div>

      {busy && !debugging && (
        <div className="space-y-3 px-3 pb-3 sm:px-4">
          <ol className="grid grid-cols-3 gap-2" aria-label={t("editor.pagination.pdf_steps")}>
            {steps.map((label, index) => (
              <li key={label} aria-current={index === step ? "step" : undefined} className={cn("flex min-w-0 items-center gap-1.5 text-[11px]", index === step ? "font-medium text-foreground" : "text-muted-foreground")}>
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border tabular-nums", index <= step && "border-primary/25 bg-primary/10 text-primary")} aria-hidden="true">
                  {index < step ? <Check className="size-3" /> : index + 1}
                </span>
                <span className="break-words">{t(`editor.pagination.${label}`)}</span>
              </li>
            ))}
          </ol>
          <div
            role="progressbar"
            aria-label={t(`editor.pagination.${steps[step]}`)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={detail}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div className={cn("h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none", !determinate && !cancelling && "w-1/3 animate-pulse motion-reduce:animate-none", cancelling && "w-1/3 opacity-40")} style={determinate ? { width: `${percent}%` } : undefined} />
          </div>
        </div>
      )}

      {(busy || savedFile || error) && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/25 px-3 py-2">
          {busy ? (
            <Button type="button" size="sm" variant="outline" data-editor-pdf-cancel disabled={cancelling} onClick={request.dismiss}>
              <X className="size-3.5" />
              {t(debugging ? "editor.pagination.pdf_close_debug" : cancelling ? "editor.pagination.pdf_cancelling" : "common.cancel")}
            </Button>
          ) : error ? (
            <Button type="button" size="sm" variant="outline" data-editor-pdf-retry onClick={() => void request.retry()} disabled={!request.available}>
              <RotateCcw className="size-3.5" />{t("editor.pagination.pdf_retry")}
            </Button>
          ) : savedFile ? (
            <Button type="button" size="sm" data-editor-pdf-open onClick={() => void request.openFile()}>
              <ExternalLink className="size-3.5" />{t("editor.inline.open_file")}
            </Button>
          ) : null}
        </div>
      )}

      {error && (
        <Collapsible className="border-t text-xs">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="group h-auto w-full justify-between whitespace-normal px-3 py-2 text-left text-xs">
              {t("editor.pagination.pdf_error_details")}
              <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p data-editor-pdf-error-details className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t px-3 py-3 leading-relaxed text-muted-foreground">{error}</p>
          </CollapsibleContent>
        </Collapsible>
      )}
      {(warnings > 0 && !error || visibleDiagnostics.length > 0) && (
        <div className="space-y-2 border-t px-3 py-3">
          {warnings > 0 && !error && <p role="status" data-editor-pdf-warning className="text-xs leading-relaxed text-muted-foreground">{t("editor.pagination.pdf_missing_references", { count: warnings })}</p>}
          {visibleDiagnostics.length > 0 && <PaginationDiagnostics diagnostics={visibleDiagnostics} editor={editor} />}
        </div>
      )}
    </section>
  );
}
