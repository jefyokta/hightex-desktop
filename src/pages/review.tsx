import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@/hooks/use-user";
import { useOnline } from "@/hooks/use-online";
import {
  readSnapshot,
  SnapshotReadError,
  type SnapshotReadModel,
} from "@/review/snapshot-reader";
import { snapshotCache } from "@/review/snapshot-cache";
import { SubmissionSnapshotViewer } from "@/components/submission/snapshot-viewer";
import { LoginGate } from "@/components/login-gate";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { t } from "@/utils/lang";
import { SubmissionReviewResult } from "@/components/submission/review-result";

export const Review = () => {
  const { documentId, submissionId } = useParams();
  const { user } = useUser();
  const online = useOnline();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<SnapshotReadModel>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let canceled = false;
    setSnapshot(undefined);
    setError(undefined);
    if (!user || !online || !documentId || !submissionId) return;
    const load = async () => {
      const context = await window.hightex.submission.context();
      if (canceled) return;
      if (!context.ok) {
        setError(t(`submission_review.errors.${context.error.code}`));
        return;
      }
      const response = await window.hightex.submission.file({
        sessionId: context.data.sessionId,
        documentId,
        submissionId,
      });
      if (canceled) return;
      if (!response.ok) {
        setError(t(`submission_review.errors.${response.error.code}`));
        return;
      }
      // Always request the file first to recheck server access, even on a cache hit.
      const download = response.data;
      const model =
        snapshotCache.get(download) ??
        (await readSnapshot(download.file, {
          kind: "submission",
          session: download.session,
          documentId: download.documentId,
          submissionId: download.submissionId,
          sha256: download.sha256,
        }));
      if (canceled) return;
      const current = await window.hightex.submission.context();
      if (canceled) return;
      if (
        !current.ok ||
        current.data.sessionId !== download.session.sessionId
      ) {
        snapshotCache.clear();
        setError(t("submission_review.errors.session_changed"));
        return;
      }
      snapshotCache.put(model);
      setSnapshot(model);
    };
    void load().catch((error) => {
      if (!canceled)
        setError(
          t(
            `submission_review.errors.${error instanceof SnapshotReadError ? error.code : "request_failed"}`,
          ),
        );
    });
    return () => {
      canceled = true;
    };
  }, [user, online, documentId, submissionId]);

  useEffect(() => {
    if (!user || !online) snapshotCache.clear();
    return () => {
      snapshotCache.clear();
    };
  }, [user, online]);

  if (!user) return <LoginGate />;
  if (!online)
    return (
      <Alert>
        <AlertDescription>{t("submission_review.offline")}</AlertDescription>
      </Alert>
    );
  if (error)
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/submissions">{t("submission_review.back")}</Link>
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        {documentId && submissionId && (
          <SubmissionReviewResult
            key={`${user.id}:${documentId}:${submissionId}`}
            documentId={documentId}
            submissionId={submissionId}
          />
        )}
      </div>
    );
  if (
    !snapshot ||
    snapshot.source.kind !== "submission" ||
    snapshot.source.documentId !== documentId ||
    snapshot.source.submissionId !== submissionId ||
    snapshot.source.session.accountId !== String(user.id)
  )
    return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  return (
    <div className="space-y-4">
      <SubmissionReviewResult
        key={`${user.id}:${documentId}:${submissionId}`}
        documentId={documentId!}
        submissionId={submissionId!}
      />
      <SubmissionSnapshotViewer
        key={`${snapshot.source.session.sessionId}:${submissionId}:${snapshot.sha256}`}
        snapshot={snapshot}
        onBack={() => navigate("/dashboard/submissions")}
      />
    </div>
  );
};
