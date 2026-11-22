import { useCallback, useMemo, useState } from "react";
import type { CiteUtils } from "bibtex.js";
import { toast } from "sonner";
import type { ReferenceUsage } from "@/editor/storage/reference-repository";
import { useReferenceCatalog } from "./use-reference-catalog";
import { t } from "@/utils/lang";
import { confirm } from "@/utils/confirm";
import type { CitationAuthor } from "@/utils/citation-authors";

const feedbackToastId = "citation-feed-back";

export function useCitationLibrary() {
  const { repository, citations, search, status, retry } = useReferenceCatalog();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => search(query), [search, query]);

  const deleteCitation = useCallback(
    async (id: string) => {
      const used = (usage: ReferenceUsage[]) => {
        toast.warning(t("citation.in_use"), {
          description: usage.map(item => `${item.title} (${item.chapters.join(", ")})`).join("; "),
        });
      };
      try {
        const usage = await repository.usage(id);
        if (usage.length) { used(usage); return; }
        if (!await confirm({
          title: t("citation.delete_title"),
          desc: t("citation.delete_description", { key: id }),
          confirmText: t("citation.delete"),
          cancelText: t("common.cancel"),
        })) return;
        if (!await repository.deleteUnused([id])) {
          const usage = await repository.usage(id);
          if (usage.length) { used(usage); return; }
        }
      } catch {
        toast.error(t("citation.delete_failed"));
      }
    },
    [repository],
  );

  const importBibtex = useCallback(
    async (content: string): Promise<number> => {
      const { records, skipped, errors } = await repository.importBibtex(content);
      if (errors.length) {
        toast.error(errors.join(" "), { id: feedbackToastId });
        return 0;
      }
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
    [repository],
  );

  const updateAuthors = useCallback(async (citation: CiteUtils, authors: CitationAuthor[]) => {
    await repository.updateAuthors(citation, authors);
  }, [repository]);

  return {
    citations,
    loading: status === "loading",
    error: status === "error",
    retry,
    query,
    setQuery,
    filtered,
    deleteCitation,
    importBibtex,
    updateAuthors,
  };
}
