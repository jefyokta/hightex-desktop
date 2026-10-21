import { useEffect, useState } from "react";
import { t } from "@/utils/lang";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export const SubmissionReviewResult = ({
  documentId,
  submissionId,
}: {
  documentId: string;
  submissionId: string;
}) => {
  const [detail, setDetail] = useState<SubmissionDetail>();
  const [status, setStatus] = useState<SubmissionStatus>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let canceled = false;
    setDetail(undefined);
    setStatus(undefined);
    setError(undefined);
    void (async () => {
      const context = await window.hightex.submission.context();
      if (!context.ok) throw new Error(context.error.code);
      const history = await window.hightex.submission.history({
        sessionId: context.data.sessionId,
        documentId,
      });
      if (!history.ok) throw new Error(history.error.code);
      if (canceled) return;
      const item = history.data.items.find((item) => item.id === submissionId);
      if (!item) throw new Error("not_found");
      setStatus(item.status);
      if (item.status !== "reviewed") return;
      const response = await window.hightex.submission.detail({
        sessionId: context.data.sessionId,
        documentId,
        submissionId,
      });
      if (!response.ok) throw new Error(response.error.code);
      if (!canceled) setDetail(response.data);
    })().catch((cause) => {
      if (!canceled)
        setError(
          t(
            `submission_review.errors.${cause instanceof Error && ["not_authenticated", "session_changed", "forbidden", "not_found", "invalid_response", "integrity_failed", "active_submission", "invalid_document"].includes(cause.message) ? (cause.message as SubmissionErrorCode) : "request_failed"}`,
          ),
        );
    });
    return () => {
      canceled = true;
    };
  }, [documentId, submissionId, revision]);
  return (
    <section className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          {t("submission_student.review_result")}
        </h2>
        {status && (
          <Badge variant="secondary">
            {t(`submission_review.status.${status}`)}
          </Badge>
        )}
        {error && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRevision((value) => value + 1)}
          >
            {t("submission_review.refresh")}
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : status !== "reviewed" ? (
        <p className="text-sm text-muted-foreground">
          {t("submission_student.review_pending")}
        </p>
      ) : (
        detail && (
          <div className="space-y-3">
            {detail.submission.reviewedAt && (
              <p className="text-xs text-muted-foreground">
                {new Date(detail.submission.reviewedAt).toLocaleString()}
              </p>
            )}
            {!detail.comments.length && (
              <p className="text-sm text-muted-foreground">
                {t("submission_student.no_comments")}
              </p>
            )}
            {detail.comments.map((comment) => (
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
        )
      )}
    </section>
  );
};
