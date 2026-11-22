import type { SnapshotReadModel } from "@/review/snapshot-reader";
import { useSubmissionComparison } from "@/hooks/use-submission-comparison";
import { DocumentComparisonDialog } from "@/components/editor/document-comparison-dialog";
import { t } from "@/utils/lang";

export function SubmissionComparisonDialog({ snapshot, open, onOpenChange }: {
  snapshot: SnapshotReadModel;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const result = useSubmissionComparison(snapshot, open);
  return <DocumentComparisonDialog open={open} onOpenChange={onOpenChange}
    comparison={result.comparison} loading={result.loading} failed={Boolean(result.error)}
    onRetry={result.retry} title={t("mentoring.compare")} error={result.error} description={t("mentoring.compare_description")}
    beforeLabel={`${t("mentoring.previous")} ${result.previous ? `#${result.previous.id}` : ""}`}
    afterLabel={t("mentoring.current")} />;
}
