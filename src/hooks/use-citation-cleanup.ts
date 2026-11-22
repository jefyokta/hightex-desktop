import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { confirm } from "@/utils/confirm";
import { ReferenceRepository } from "@/editor/storage/reference-repository";
import { t } from "@/utils/lang";

export function useCitationCleanup() {
  const repository = useMemo(() => new ReferenceRepository(), []);
  const [cleaning, setCleaning] = useState(false);
  const cleaningRef = useRef(false);

  const deleteUnusedCitations = useCallback(async () => {
    if (cleaningRef.current) return;
    cleaningRef.current = true;
    setCleaning(true);
    try {
      const unused = await repository.unused();
      if (unused.length === 0) {
        toast.info(t("settings.data.unused_citations.none"));
        return;
      }
      const confirmed = await confirm({
        title: t("settings.data.unused_citations.confirm_title", {
          count: unused.length,
        }),
        desc: t("settings.data.unused_citations.confirm_description"),
        confirmText: t("settings.data.unused_citations.confirm_delete", {
          count: unused.length,
        }),
        cancelText: t("common.cancel"),
      });
      if (!confirmed) return;
      const count = await repository.deleteUnused(
        unused.map((citation) => citation.key),
      );
      if (count > 0)
        toast.success(t("settings.data.unused_citations.deleted", { count }));
      else toast.info(t("settings.data.unused_citations.none"));
    } catch {
      toast.error(t("settings.data.unused_citations.failed"));
    } finally {
      cleaningRef.current = false;
      setCleaning(false);
    }
  }, [repository]);

  return { cleaning, deleteUnusedCitations };
}
