import { useEffect, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import { documentRecoveries } from "@/editor/document/files/recoveries";
import type { RecoveryDocument } from "@/editor/document/files/contracts";
import { Manager } from "@/editor/manager";
import { Exporter } from "@/utils/htx/exporter";
import { t } from "@/utils/lang";

export function useDocumentRecoveries(sourceDocumentId?: string, enabled = true) {
  const [documents, setDocuments] = useState<RecoveryDocument[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  const pending = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const subscription = liveQuery(() => documentRecoveries.list(sourceDocumentId)).subscribe({
      next: documents => {
        setDocuments(documents);
        setError("");
      },
      error: error => setError(error instanceof Error ? error.message : String(error)),
    });
    return () => subscription.unsubscribe();
  }, [sourceDocumentId, enabled]);

  const run = async (id: string, action: () => Promise<unknown>): Promise<boolean> => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(id);
    try {
      await action();
      return true;
    } catch (error) {
      toast.error(t("recovery.action_failed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      pending.current = false;
      setBusy(undefined);
    }
  };

  const open = (id: string) => run(id, () => window.editor.open(id));
  const remove = (id: string) => run(id, () => Manager.deleteDocument(id));
  const saveCopy = (id: string) => run(id, async () => {
    if (await window.editor.has(id)) await window.editor.flush(id);
    const result = await new Exporter(id).export({ showDialog: true });
    if (!result.canceled) toast.success(t("recovery.exported"));
  });

  return { documents, error, busy, open, remove, saveCopy };
}
