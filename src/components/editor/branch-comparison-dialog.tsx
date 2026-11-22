import { useEffect, useState } from "react";
import type { DocumentComparison } from "@/editor/storage/document-comparison";
import { openDocumentComparison } from "@/editor/storage/comparison-session";
import { DocumentComparisonDialog } from "./document-comparison-dialog";
import { t } from "@/utils/lang";

export function BranchComparisonDialog({
  open,
  onOpenChange,
  branchId,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  branchId?: string;
}) {
  const [comparison, setComparison] = useState<DocumentComparison>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    setComparison(undefined);
    setStale(false);
    if (!open || !branchId) return;
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    void openDocumentComparison(
      branchId,
      () => {
        if (alive) setStale(true);
      },
      controller.signal,
    )
      .then(({ comparison }) => {
        if (alive) setComparison(comparison);
      })
      .catch((error) => {
        if (alive) {
          console.error("Could not compare branch with main", error);
          setFailed(true);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [open, branchId, retry]);
  const branchName = comparison?.branch.branchName || t("editor.branches.branch");
  return <DocumentComparisonDialog key={`${branchId}:${retry}`} open={open} onOpenChange={onOpenChange}
    comparison={comparison} loading={loading} failed={failed} stale={stale}
    onRetry={() => setRetry(value => value + 1)}
    title={comparison ? t("editor.branches.compare_title", { name: branchName }) : t("editor.branches.compare")}
    beforeLabel={t("editor.branches.main")} afterLabel={branchName} />;
}
