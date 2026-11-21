import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { HighTexDB } from "@/editor/storage/hightex-db";

export function useDocumentRecoveries(sourceDocumentId?: string, enabled = true) {
  const [documents, setDocuments] = useState<HighTexDocument[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const subscription = liveQuery(() => HighTexDB.getInstance().documents.filter(document =>
      !!document.recovery && (!sourceDocumentId || document.recovery.sourceDocumentId === sourceDocumentId),
    ).toArray()).subscribe({
      next: documents => {
        setDocuments(documents.sort((a, b) => b.recovery!.createdAt - a.recovery!.createdAt));
        setError("");
      },
      error: error => setError(error instanceof Error ? error.message : String(error)),
    });
    return () => subscription.unsubscribe();
  }, [sourceDocumentId, enabled]);
  return { documents, error };
}
