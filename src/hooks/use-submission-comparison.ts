import { useIPC } from "@/hooks/use-ipc";
import { useEffect, useState } from "react";
import type { DocumentComparison } from "@/editor/storage/document-comparison";
import { previousSubmission, compareSubmissionSnapshots } from "@/review/submission-comparison";
import type { SnapshotReadModel } from "@/review/snapshot-reader";
import { t } from "@/utils/lang";

export function useSubmissionComparison(snapshot: SnapshotReadModel, open: boolean) {
  const [result, setResult] = useState<{ comparison?: DocumentComparison; previous?: SubmissionSummary; error?: string }>();
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open || snapshot.source.kind !== "submission") return;
    let active = true;
    const source = snapshot.source;
    const input = { sessionId: source.session.sessionId, documentId: source.documentId, submissionId: source.submissionId };
    setLoading(true);
    setResult(undefined);
    const load = async () => {
      const [detail, history] = await Promise.all([
        useIPC("hightex").hightex.submission.detail(input), useIPC("hightex").hightex.submission.history(input),
      ]);
      if (!detail.ok) throw Error(t(`submission_review.errors.${detail.error.code}`));
      if (!history.ok) throw Error(t(`submission_review.errors.${history.error.code}`));
      const previous = previousSubmission(detail.data.submission, history.data.items);
      if (!previous) throw Error(t("mentoring.no_previous"));
      if (previous.snapshotPurgedAt) throw Error(t("mentoring.previous_purged"));
      const downloaded = await useIPC("hightex").hightex.submission.file({ ...input, submissionId: previous.id });
      if (!downloaded.ok) throw Error(t(`submission_review.errors.${downloaded.error.code}`));
      const comparison = await compareSubmissionSnapshots(downloaded.data, {
        ...source, file: snapshot.originalFile(),
      });
      const current = await useIPC("hightex").hightex.submission.context();
      if (!current.ok || current.data.sessionId !== source.session.sessionId) throw Error(t("submission_review.errors.session_changed"));
      if (active) setResult({ comparison, previous });
    };
    // SnapshotSource carries the session object; the bridge takes its request identity.
    void load().catch(error => { if (active) setResult({ error: error instanceof Error ? error.message : String(error) }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [snapshot, open, revision]);
  return { ...result, loading, retry: () => setRevision(value => value + 1) };
}
