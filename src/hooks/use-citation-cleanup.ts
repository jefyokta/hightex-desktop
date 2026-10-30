import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { confirm } from "@/utils/confirm";
import {
  deleteUnusedCitation,
  getUnusedCitations,
} from "@/utils/delete-unused-citation";
import { t } from "@/utils/lang";

export function useCitationCleanup() {
  const [cleaning, setCleaning] = useState(false);
  const cleaningRef = useRef(false);

  const deleteUnusedCitations = useCallback(async () => {
    if (cleaningRef.current) return;
    cleaningRef.current = true;
    setCleaning(true);
    try {
      const unused = await getUnusedCitations();
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
      const count = await deleteUnusedCitation(
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
  }, []);

  return { cleaning, deleteUnusedCitations };
}
