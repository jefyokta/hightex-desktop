import { useEffect, useState } from "react";
import { Exporter } from "@/utils/htx/exporter";
import { readSnapshot } from "@/review/snapshot-reader";
import { compareDocumentModels, type DocumentComparison } from "@/editor/storage/document-comparison";
import { DocumentComparisonDialog } from "@/components/editor/document-comparison-dialog";
import { t } from "@/utils/lang";

/** Compare a closed local draft to the latest submission for the explicitly selected recipient. */
export function LocalSubmissionComparison({ open, onOpenChange, documentId, previous }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  documentId: string;
  previous: SubmissionSummary;
}) {
  const [comparison, setComparison] = useState<DocumentComparison>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setComparison(undefined);
    setError(undefined);
    const load = async () => {
      if (previous.snapshotPurgedAt) throw Error(t("mentoring.previous_purged"));
      if (await window.editor.has(documentId)) throw Error(t("submission_student.errors.editor_open"));
      const context = await window.hightex.submission.context();
      if (!context.ok) throw Error(t(`submission_review.errors.${context.error.code}`));
      const file = await window.hightex.submission.file({ sessionId: context.data.sessionId, documentId: previous.documentId, submissionId: previous.id });
      if (!file.ok) throw Error(t(`submission_review.errors.${file.error.code}`));
      const local = await new Exporter(documentId).buildExport();
      const [before, after] = await Promise.all([
        readSnapshot(file.data.file, { kind: "submission", ...file.data }),
        readSnapshot(local.buffer, { kind: "local", filename: "comparison.hightex" }),
      ]);
      const [mainModel, branchModel] = await Promise.all([before.renderModel(), after.renderModel()]);
      const result = await compareDocumentModels(mainModel, branchModel);
      const current = await window.hightex.submission.context();
      if (!current.ok || current.data.sessionId !== context.data.sessionId) throw Error(t("submission_review.errors.session_changed"));
      if (active) setComparison(result);
    };
    void load().catch(error => { if (active) setError(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, documentId, previous, revision]);

  return <DocumentComparisonDialog open={open} onOpenChange={onOpenChange} loading={loading} failed={Boolean(error)}
    comparison={comparison} error={error} onRetry={() => setRevision(value => value + 1)} title={t("mentoring.compare")} description={t("mentoring.compare_description")}
    beforeLabel={`${t("mentoring.previous")} #${previous.id}`} afterLabel={t("workspace.documents")} />;
}
