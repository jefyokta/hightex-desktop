import { useEffect, useId, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { paginationKey } from "@/editor/pagination";
import {
  PAGINATION_FEEDBACK_LIMIT,
  paginationDiagnostics,
  paginationFeedbackText,
  type PaginationDiagnostics,
} from "@/editor/pagination/feedback";
import { t, useAppLanguage } from "@/utils/lang";

export function PaginationFeedback({ editor }: { editor: Editor | null }) {
  useAppLanguage();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState("");
  const [diagnostics, setDiagnostics] = useState<PaginationDiagnostics>();
  const [loading, setLoading] = useState(false);
  const [versionFailed, setVersionFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<
    "sent" | "send_failed" | "copied" | "copy_failed"
  >();
  const request = useRef(false);

  const changeOpen = (next: boolean) => {
    if (request.current) return;
    if (next) {
      // Capture settings at opening so the reviewed report stays consistent
      // if a background layout finishes while the dialog is open.
      const state =
        editor && !editor.isDestroyed
          ? paginationKey.getState(editor.state)
          : undefined;
      setDiagnostics(
        paginationDiagnostics(state, "unknown", navigator.userAgent),
      );
      setDetails("");
      setNotice(undefined);
      setSent(false);
      setVersionFailed(false);
      setLoading(true);
    }
    setOpen(next);
  };

  useEffect(() => {
    if (!open) return;
    let active = true;
    void window.hightex.version().then(
      (version) => {
        if (!active) return;
        setDiagnostics(
          (previous) => previous && { ...previous, appVersion: version },
        );
        setLoading(false);
      },
      () => {
        if (!active) return;
        setVersionFailed(true);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [open]);

  const report = diagnostics
    ? paginationFeedbackText(diagnostics, details)
    : "";
  const ready = !loading && Boolean(details.trim()) && Boolean(diagnostics);
  const send = async () => {
    if (!ready || request.current || sent) return;
    request.current = true;
    setSending(true);
    setNotice(undefined);
    try {
      await window.hightex.reportError({
        title: t("editor.pagination.feedback.issue_title"),
        description: report,
      });
      setSent(true);
      setNotice("sent");
    } catch {
      // Keep the reviewed draft available for retry or offline copying.
      setNotice("send_failed");
    } finally {
      request.current = false;
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-pagination-report
        >
          {t("editor.pagination.feedback.open")}
        </Button>
      </DialogTrigger>
      <DialogContent
        data-pagination-feedback
        className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto sm:max-w-xl"
        showCloseButton={!sending}
        onEscapeKeyDown={(event) => {
          if (sending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (sending) event.preventDefault();
        }}
      >
        <DialogTitle>{t("editor.pagination.feedback.title")}</DialogTitle>
        <DialogDescription>
          {t("editor.pagination.feedback.description")}
        </DialogDescription>
        <p className="text-xs text-muted-foreground">
          {t("editor.pagination.feedback.privacy")}
        </p>
        <label htmlFor={`${id}-details`} className="text-sm font-medium">
          {t("editor.pagination.feedback.details")}
        </label>
        <Textarea
          id={`${id}-details`}
          data-pagination-feedback-details
          value={details}
          maxLength={PAGINATION_FEEDBACK_LIMIT}
          disabled={sending || sent}
          onChange={(event) => {
            setDetails(event.target.value);
            setNotice(undefined);
          }}
          placeholder={t("editor.pagination.feedback.placeholder")}
          className="min-h-24"
        />
        <label htmlFor={`${id}-preview`} className="text-sm font-medium">
          {t("editor.pagination.feedback.preview")}
        </label>
        <Textarea
          id={`${id}-preview`}
          data-pagination-feedback-preview
          value={report}
          readOnly
          className="max-h-48 min-h-32 resize-none font-mono text-xs"
        />
        {versionFailed && (
          <p className="text-xs text-muted-foreground">
            {t("editor.pagination.feedback.version_failed")}
          </p>
        )}
        {notice && (
          <p role="status" data-pagination-feedback-notice className="text-sm">
            {t(`editor.pagination.feedback.${notice}`)}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={sending}
            onClick={() => changeOpen(false)}
          >
            {t("common.close")}
          </Button>
          <Button
            type="button"
            variant="outline"
            data-pagination-feedback-copy
            disabled={!ready || sending}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(report);
                setNotice("copied");
              } catch {
                setNotice("copy_failed");
              }
            }}
          >
            {t("editor.pagination.feedback.copy")}
          </Button>
          <Button
            type="button"
            data-pagination-feedback-send
            disabled={!ready || sending || sent}
            onClick={() => void send()}
          >
            {t(
              sending
                ? "editor.pagination.feedback.sending"
                : "editor.pagination.feedback.send",
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
