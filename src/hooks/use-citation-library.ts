import { useCallback, useEffect, useMemo, useState } from "react";
import { CiteUtils } from "bibtex.js";
import { toast } from "sonner";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { isCitationValid, parseBibtexInput } from "@/utils/citation";
import { t } from "@/utils/lang";

const feedbackToastId = "citation-feed-back";

function uniqueKey(key: string, existing: Set<string>) {
  let candidate = key;
  let suffix = 1;
  while (existing.has(candidate)) {
    candidate = `${key}_${suffix++}`;
  }
  existing.add(candidate);
  return candidate;
}

export function useCitationLibrary() {
  const db = HighTexDB.getInstance();
  const [citations, setCitations] = useState<CiteUtils[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const loadCitations = useCallback(async () => {
    const rows = await db.cite.toArray();
    return rows.map((citation) =>
      new CiteUtils(citation.bib).setId(citation.key),
    );
  }, [db]);

  useEffect(() => {
    let alive = true;
    void loadCitations().then((mapped) => {
      if (!alive) return;
      setCitations(mapped);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [loadCitations]);

  const filtered = useMemo(() => {
    if (!query.trim()) return citations;
    const lower = query.toLowerCase();
    return citations.filter(
      (cite) =>
        cite.getId().toLowerCase().includes(lower) ||
        cite.getTitle().toLowerCase().includes(lower) ||
        JSON.stringify(cite.getCite()).toLowerCase().includes(lower),
    );
  }, [citations, query]);

  const deleteCitation = useCallback(
    async (id: string) => {
      setCitations((previous) =>
        previous.filter((citation) => citation.getId() !== id),
      );
      await db.cite.delete(id);
    },
    [db],
  );

  const importBibtex = useCallback(
    async (content: string): Promise<number> => {
      if (!content.trim()) {
        toast.error(t("citation.error.no_bibtex_content"), {
          id: feedbackToastId,
        });
        return 0;
      }
      const { entries, errors } = parseBibtexInput(content);
      if (errors.length > 0) {
        toast.error(errors.join(" "), { id: feedbackToastId });
        return 0;
      }
      const valid = entries.filter((entry) => isCitationValid(entry.cite));
      const skipped = entries.length - valid.length;
      if (valid.length === 0) {
        toast.error(
          t(
            skipped > 0
              ? "citation.error.no_valid_citations"
              : "citation.error.no_citations_parsed",
          ),
          { id: feedbackToastId },
        );
        return 0;
      }
      const existing = new Set(
        (await db.cite.toArray()).map((item) => item.key),
      );
      const records = valid.map((entry) => ({
        key: uniqueKey(entry.key, existing),
        bib: entry.bib,
      }));
      await db.cite.bulkPut(records);
      setCitations(await loadCitations());
      toast.success(
        t("citation.imported", {
          count: records.length,
          skipped:
            skipped > 0
              ? t("citation.skipped_invalid", { count: skipped })
              : "",
        }),
        { id: feedbackToastId },
      );
      return records.length;
    },
    [db, loadCitations],
  );

  return {
    citations,
    loading,
    query,
    setQuery,
    filtered,
    deleteCitation,
    importBibtex,
  };
}
