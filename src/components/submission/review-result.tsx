import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { confirm } from "@/utils/confirm";
import { t } from "@/utils/lang";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

export const SubmissionReviewResult = ({
  documentId,
  submissionId,
  onAccessDenied,
}: {
  documentId: string;
  submissionId: string;
  onAccessDenied?(code: SubmissionErrorCode): void;
}) => {
  const [state, setState] = useState<AdvisorReviewState>();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const operation = useRef(false);
  const generation = useRef(0);
  const current = useRef<AdvisorReviewState>();
  const denied = useRef(onAccessDenied);
  denied.current = onAccessDenied;

  const showError = (code: SubmissionErrorCode) => {
    setError(t(`submission_review.errors.${code}`));
    if (
      [
        "forbidden",
        "not_authenticated",
        "session_changed",
        "not_found",
      ].includes(code)
    )
      denied.current?.(code);
  };
  const applyState = (next: AdvisorReviewState) => {
    const pending = current.current?.pending;
    if (
      pending?.action === "comment" &&
      !next.pending &&
      next.comments.some(
        (comment) =>
          !pending.baselineCommentIds.includes(comment.id) &&
          comment.text === pending.comment &&
          comment.authorId === next.session.accountId,
      )
    )
      setDraft((value) => (value === pending.comment ? "" : value));
    if (next.pending?.action === "comment")
      setDraft(next.pending.comment ?? "");
    current.current = next;
    setState(next);
  };
  const load = async (request: number) => {
    const context = await window.hightex.submission.context();
    if (generation.current !== request) return;
    if (!context.ok) {
      current.current = undefined;
      setState(undefined);
      return showError(context.error.code);
    }
    const response = await window.hightex.submission.advisor.state({
      sessionId: context.data.sessionId,
      documentId,
      submissionId,
    });
    if (generation.current !== request) return;
    if (response.ok) applyState(response.data);
    else {
      current.current = undefined;
      setState(undefined);
      showError(response.error.code);
    }
  };

  useEffect(() => {
    const request = ++generation.current;
    current.current = undefined;
    setState(undefined);
    setDraft("");
    setError(undefined);
    setBusy(true);
    void load(request)
      .catch(() => {
        if (generation.current === request) showError("request_failed");
      })
      .finally(() => {
        if (generation.current === request) setBusy(false);
      });
    return () => {
      // This is a request counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
    // Each target owns its load; refresh and writes use the same generation guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, submissionId]);

  const run = async (action?: AdvisorReviewAction) => {
    if (operation.current) return;
    operation.current = true;
    const request = generation.current;
    setBusy(true);
    setError(undefined);
    try {
      if (!action) {
        await load(request);
        return;
      }
      const selected = current.current;
      if (!selected) return;
      if (
        action === "complete" &&
        !(await confirm({
          title: t("submission_advisor.complete_title"),
          desc: t("submission_advisor.complete_description"),
          confirmText: t("submission_advisor.complete"),
        }))
      )
        return;
      if (generation.current !== request) return;
      const response = await window.hightex.submission.advisor.action({
        sessionId: selected.session.sessionId,
        documentId,
        submissionId,
        requestId: crypto.randomUUID(),
        action,
        ...(action === "comment" ? { comment: draft } : {}),
      });
      if (generation.current !== request) return;
      if (response.ok) {
        applyState(response.data);
        if (action === "comment" && !response.data.pending) setDraft("");
      } else {
        await load(request);
        if (generation.current === request) showError(response.error.code);
      }
    } catch {
      if (generation.current === request) {
        showError("request_failed");
        // Read only: a lost IPC response must never trigger another POST.
        await load(request).catch(() => {});
      }
    } finally {
      operation.current = false;
      if (generation.current === request) setBusy(false);
    }
  };
  const count = [...draft].length;
  const canWrite = state?.canReview && state.active && !state.pending && !busy;
  return (
    <section className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          {t("submission_student.review_result")}
        </h2>
        <div className="flex items-center gap-2">
          {state && (
            <Badge variant="secondary">
              {t(`submission_review.status.${state.submission.status}`)}
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run()}
          >
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
            {t("submission_review.refresh")}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {state?.submission.recipientName && (
        <p className="text-sm text-muted-foreground">
          {t("submission_student.recipient")}: {state.submission.recipientName}
        </p>
      )}
      {state?.submission.snapshotPurgedAt && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("submission_review.archive_purged")}
        </p>
      )}
      {state?.pending && (
        <p role="status" className="text-sm text-muted-foreground">
          {t(
            state.pending.mismatch
              ? "submission_advisor.mismatch"
              : "submission_review.errors.outcome_unknown",
          )}
        </p>
      )}
      {state &&
        (!state.canReview && state.submission.status !== "reviewed" ? (
          <p className="text-sm text-muted-foreground">
            {t("submission_student.review_pending")}
          </p>
        ) : (
          <div className="space-y-3">
            {state.submission.reviewedAt && (
              <p className="text-xs text-muted-foreground">
                {new Date(state.submission.reviewedAt).toLocaleString()}
              </p>
            )}
            {!state.comments.length && (
              <p className="text-sm text-muted-foreground">
                {t(
                  state.submission.status === "reviewed"
                    ? "submission_student.no_comments"
                    : "submission_advisor.no_comments",
                )}
              </p>
            )}
            {state.comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-xl border bg-background p-3 space-y-1"
              >
                <p className="text-xs text-muted-foreground">
                  {comment.author || t("submission_student.advisor")}
                  {comment.createdAt &&
                  !Number.isNaN(Date.parse(comment.createdAt))
                    ? ` · ${new Date(comment.createdAt).toLocaleString()}`
                    : ""}
                </p>
                <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
              </div>
            ))}
          </div>
        ))}
      {state?.canReview &&
        state.active &&
        state.submission.status === "waiting_for_review" && (
          <Button
            size="sm"
            disabled={!canWrite}
            onClick={() => void run("start")}
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {t("submission_advisor.start")}
          </Button>
        )}
      {state?.canReview &&
        state.active &&
        state.submission.status === "on_review" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="review-comment" className="text-sm font-medium">
                {t("submission_advisor.comment")}
              </label>
              <Textarea
                id="review-comment"
                value={draft}
                disabled={!canWrite}
                onChange={(event) => setDraft(event.target.value)}
                aria-describedby="review-comment-count"
              />
              <p
                id="review-comment-count"
                className={`text-xs ${count > 200 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {count}/200
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!canWrite || !draft.trim() || count > 200}
                onClick={() => void run("comment")}
              >
                {t("submission_advisor.send")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canWrite || Boolean(draft.trim())}
                onClick={() => void run("complete")}
              >
                {t("submission_advisor.complete")}
              </Button>
            </div>
            {draft.trim() && (
              <p className="text-xs text-muted-foreground">
                {t("submission_advisor.unsent")}
              </p>
            )}
          </div>
        )}
    </section>
  );
};
