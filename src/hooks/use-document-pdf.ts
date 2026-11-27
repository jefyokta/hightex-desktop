import { useIPC } from "@/hooks/use-ipc";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { Document } from "@/editor/document";
import { captureDocumentPDF, type DocumentPDFOptions } from "@/document-export/capture";
import { paginationReport } from "@/editor/pagination/report-error";
import { paginationDiagnostic } from "@/editor/pagination/diagnostic";
import type { PaginationDiagnostic } from "@/types/pagination/diagnostic";
import { toast } from "sonner";
import { t } from "@/utils/lang";

interface PDFRequest {
  controller: AbortController;
  id: string;
  started: number;
  unsubscribe?: () => void;
}

/** One owner for capture, print/debug requests, cancellation and diagnostics. */
export function useDocumentPDF(editor: Editor | Document | string | null) {
  const [phase, setPhase] = useState<"idle" | "capture" | "export" | "debug" | "cancel">(
    "idle",
  );
  const busy = phase !== "idle";
  const [error, setError] = useState("");
  const [section, setSection] = useState("");
  const [sections, setSections] = useState<{completed: number; total: number}>();
  const [warnings, setWarnings] = useState(0);
  const [diagnostics, setDiagnostics] = useState<PaginationDiagnostic[]>([]);
  const [progress, setProgress] = useState<EditorPDFProgress>();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [outcome, setOutcome] = useState<"saved" | "cancelled">();
  const exportButton = useRef<HTMLButtonElement>(null);
  const request = useRef<PDFRequest>();
  const cancel = useCallback(() => {
    const active = request.current;
    if (!active) return;
    active.controller.abort();
    void useIPC("editorPDFExperimental").editorPDFExperimental.cancel(active.id).catch((error) => {
      const report = paginationReport(
        error,
        "Membatalkan ekspor PDF experimental",
      );
      if (report) throw report;
    });
  }, []);
  useEffect(() => {
    if (!busy) return;
    const update = () => {
      if (request.current) setElapsedMs(performance.now() - request.current.started);
    };
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    setPhase("idle");
    setError("");
    setSection("");
    setSections(undefined);
    setWarnings(0);
    setDiagnostics([]);
    setProgress(undefined);
    setElapsedMs(0);
    setOutcome(undefined);
    return () => {
      request.current?.unsubscribe?.();
      cancel();
      request.current = undefined;
    };
  }, [editor, cancel]);

  const prepare = async (action: "export" | "debug", options: DocumentPDFOptions = {}) => {
    if (!editor || request.current) return;
    const active: PDFRequest = {
      controller: new AbortController(),
      id: crypto.randomUUID(),
      started: performance.now(),
    };
    request.current = active;
    setPhase("capture");
    setError("");
    setSection("");
    setSections(undefined);
    setWarnings(0);
    setDiagnostics([]);
    setProgress(undefined);
    setElapsedMs(0);
    setOutcome(undefined);
    try {
      const snapshot = await captureDocumentPDF(
        editor,
        active.controller.signal,
        (engine) => {
          let total = 0;
          const completed = new Set<string>();
          engine.events.on("start", event => {
            total = event.sections;
            if (request.current === active) setSections({completed:0,total});
          });
          engine.events.on("section.before", (event) => {
            if (request.current === active) setSection(event.section.title);
          });
          engine.events.on("section.after", event => {
            // Index convergence may render the same section more than once.
            if (event.sectionId) completed.add(event.sectionId);
            if (request.current === active && !active.controller.signal.aborted)
              setSections({completed:completed.size,total});
          });
          engine.events.on("diagnostic", ({ error }) => {
            if (request.current === active) {
              if (error.level === "warning") setWarnings((count) => count + 1);
              setDiagnostics((items) => [
                ...items,
                paginationDiagnostic(error),
              ]);
            }
          });
        },
        options,
      );
      active.controller.signal.throwIfAborted();
      if (request.current !== active) return;
      setPhase(action);
      active.unsubscribe = useIPC("editorPDFExperimental").editorPDFExperimental.onProgress(active.id, value => {
        if (request.current === active && !active.controller.signal.aborted) setProgress(value);
      });
      const result = await useIPC("editorPDFExperimental").editorPDFExperimental[action](
        snapshot,
        active.id,
      );
      if (request.current !== active || active.controller.signal.aborted)
        return;
      if (result) {
        setOutcome("saved");
        toast.success(t("editor.inline.pdf_saved"), {
          description: result.filename,
          action: {
            label: t("editor.inline.open_file"),
            onClick: () => useIPC("file").file.openPath(result.path),
          },
        });
      } else if (action === "export") setOutcome("cancelled");
    } catch (error) {
      if (request.current === active && !active.controller.signal.aborted) {
        setError(error instanceof Error ? error.message : String(error));
        setDiagnostics((items) =>
          items.some((item) => item.level === "fatal")
            ? items
            : [...items, paginationDiagnostic(error)],
        );
        const report = paginationReport(error, "Ekspor PDF experimental");
        if (report) throw report; // The application's ErrorSlave owns notification/report actions.
      }
    } finally {
      active.unsubscribe?.();
      if (request.current === active) {
        setElapsedMs(performance.now() - active.started);
        if (active.controller.signal.aborted && action === "export") setOutcome("cancelled");
        request.current = undefined;
        setPhase("idle");
        if (active.controller.signal.aborted) requestAnimationFrame(() => exportButton.current?.focus());
      }
    }
  };

  const dismiss = () => {
    if (!request.current || request.current.controller.signal.aborted) return;
    setPhase("cancel");
    cancel();
    setWarnings(0);
    setDiagnostics([]);
  };
  return {
    available: Boolean(editor),
    phase, busy, error, section, sections, warnings, diagnostics, progress, elapsedMs, outcome,
    exportButton, prepare, dismiss,
  };
}

export type DocumentPDFRequest = ReturnType<typeof useDocumentPDF>;
