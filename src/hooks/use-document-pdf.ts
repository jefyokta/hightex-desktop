import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { Document } from "@/editor/document";
import { captureDocumentPDF } from "@/document-export/capture";
import { paginationReport } from "@/editor/pagination/report-error";
import { paginationDiagnostic } from "@/editor/pagination/diagnostic";
import type { PaginationDiagnostic } from "@/types/pagination/diagnostic";
import { toast } from "sonner";
import { t } from "@/utils/lang";

/** One owner for capture, print/debug requests, cancellation and diagnostics. */
export function useDocumentPDF(editor: Editor | Document) {
  const [phase, setPhase] = useState<"idle" | "capture" | "export" | "debug">(
    "idle",
  );
  const busy = phase !== "idle";
  const [error, setError] = useState("");
  const [section, setSection] = useState("");
  const [warnings, setWarnings] = useState(0);
  const [diagnostics, setDiagnostics] = useState<PaginationDiagnostic[]>([]);
  const exportButton = useRef<HTMLButtonElement>(null);
  const request = useRef<{ controller: AbortController; id: string }>();
  const cancel = useCallback(() => {
    const active = request.current;
    request.current = undefined;
    if (!active) return;
    active.controller.abort();
    void window.editorPDFExperimental.cancel(active.id).catch((error) => {
      const report = paginationReport(
        error,
        "Membatalkan ekspor PDF experimental",
      );
      if (report) throw report;
    });
  }, []);
  useEffect(() => {
    setPhase("idle");
    setError("");
    setSection("");
    setWarnings(0);
    setDiagnostics([]);
    return cancel;
  }, [editor, cancel]);

  const prepare = async (action: "export" | "debug") => {
    if (request.current) return;
    const active = {
      controller: new AbortController(),
      id: crypto.randomUUID(),
    };
    request.current = active;
    setPhase("capture");
    setError("");
    setSection("");
    setWarnings(0);
    setDiagnostics([]);
    try {
      const snapshot = await captureDocumentPDF(
        editor,
        active.controller.signal,
        (engine) => {
          engine.events.on("section.before", (event) => {
            if (request.current === active) setSection(event.section.title);
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
      );
      active.controller.signal.throwIfAborted();
      if (request.current !== active) return;
      setPhase(action);
      const result = await window.editorPDFExperimental[action](
        snapshot,
        active.id,
      );
      if (request.current !== active || active.controller.signal.aborted)
        return;
      if (result)
        toast.success(t("editor.inline.pdf_saved"), {
          description: result.filename,
          action: {
            label: t("editor.inline.open_file"),
            onClick: () => window.file.openPath(result.path),
          },
        });
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
      if (request.current === active) {
        request.current = undefined;
        setPhase("idle");
      }
    }
  };

  const dismiss = () => {
    cancel();
    setPhase("idle");
    setWarnings(0);
    setDiagnostics([]);
    requestAnimationFrame(() => exportButton.current?.focus());
  };
  return {
    phase, busy, error, section, warnings, diagnostics,
    exportButton, prepare, dismiss,
  };
}
