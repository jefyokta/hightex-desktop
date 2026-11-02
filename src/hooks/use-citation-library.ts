import { useCallback, useEffect, useMemo, useState } from "react";
import { CiteUtils } from "bibtex.js";
import { toast } from "sonner";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { isCitationValid, parseBibtexInput } from "@/utils/citation";
import { t } from "@/utils/lang";
import { confirm } from "@/utils/confirm";

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
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);

  const loadCitations = useCallback(async () => {
    const rows = await db.cite.toArray();
    const mapped = await Promise.all(
      rows.map(async (citation) => {
        try {
          return new CiteUtils(citation.bib).setId(citation.key);
        } catch {
          await db.cite.delete(citation.key);
          return undefined;
        }
      }),
    );

    return mapped.filter(
      (citation): citation is CiteUtils => citation !== undefined,
    );
  }, [db]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    void loadCitations()
      .then((mapped) => {
        if (!alive) return;
        setCitations(mapped);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadCitations, revision]);

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
      if (
        !(await confirm({
          title: t("citation.delete_title"),
          desc: t("citation.delete_description", { key: id }),
          confirmText: t("citation.delete"),
          cancelText: t("common.cancel"),
        }))
      )
        return;
      try {
        await db.cite.delete(id);
        setCitations((previous) =>
          previous.filter((citation) => citation.getId() !== id),
        );
      } catch {
        toast.error(t("citation.delete_failed"));
      }
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
    error,
    retry,
    query,
    setQuery,
    filtered,
    deleteCitation,
    importBibtex,
  };
}
