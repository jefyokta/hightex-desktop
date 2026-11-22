import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Manager } from "@/editor/manager";

export type KeywordLanguage = keyof Keywords;

/** Patch only one language against the latest metadata, leaving other edits intact. */
export function useDocumentKeywords(documentId: string, language: KeywordLanguage) {
  const [keywords, setKeywords] = useState<string[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    setKeywords(undefined);
    setError("");
    const subscription = liveQuery(() => HighTexDB.getInstance().documents.get(documentId)).subscribe({
      next: document => setKeywords(document?.keywords[language]),
      error: cause => setError(String(cause)),
    });
    return () => subscription.unsubscribe();
  }, [documentId, language]);

  const save = async (values: string[]) => {
    const db = HighTexDB.getInstance();
    const updated = await db.transaction("rw", db.documents, async () => {
      const current = await db.documents.get(documentId);
      if (!current) throw Error("Document is unavailable");
      const next = { ...current, keywords: { ...current.keywords, [language]: values }, updatedAt: new Date() };
      await db.documents.put(next);
      return next;
    });
    Manager.app.dispatch("document:updated", { document: updated });
  };
  return { keywords, error, save };
}
