import { useCallback, useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import type { CiteUtils } from "bibtex.js";
import { ReferenceRepository } from "@/editor/storage/reference-repository";
import { citationSearchFields, createCitationSearch } from "@/utils/citation-search";

/** Keep every reference surface in sync with imports, author edits and deletions. */
export function useReferenceCatalog() {
  const repository = useMemo(() => new ReferenceRepository(), []);
  const [citations, setCitations] = useState<CiteUtils[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    setStatus("loading");
    const subscription = liveQuery(() => repository.all()).subscribe({
      next(citations) {
        setCitations(citations);
        setStatus("ready");
      },
      error() {
        setStatus("error");
      },
    });
    return () => subscription.unsubscribe();
  }, [repository, revision]);

  const search = useMemo(() => createCitationSearch(citations, citationSearchFields), [citations]);
  return { repository, citations, search, status, retry };
}
