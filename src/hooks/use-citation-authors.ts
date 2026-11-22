import { useCallback, useRef, useState } from "react";
import type { CiteUtils } from "bibtex.js";
import { toast } from "sonner";
import { citationAuthors, type CitationAuthor } from "@/utils/citation-authors";
import { t } from "@/utils/lang";

export function useCitationAuthors(saveAuthors: (citation: CiteUtils, authors: CitationAuthor[]) => Promise<void>) {
  const [citation, setCitation] = useState<CiteUtils | null>(null);
  const [authors, setAuthors] = useState<CitationAuthor[]>([]);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  const edit = useCallback((citation: CiteUtils) => {
    setCitation(citation);
    setAuthors(citationAuthors(citation));
  }, []);

  const close = () => {
    if (!pending.current) setCitation(null);
  };

  const update = (index: number, author: CitationAuthor) => {
    setAuthors(current => current.map((value, position) => position === index ? author : value));
  };

  const add = (kind: "person" | "name") => {
    setAuthors(current => [...current, kind === "person" ? { firstName: "", lastName: "" } : ""]);
  };

  const remove = (index: number) => {
    setAuthors(current => current.filter((_, position) => position !== index));
  };

  const save = async () => {
    if (!citation || pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      await saveAuthors(citation, authors);
      setCitation(null);
      toast.success(t("editor.expandable.citation.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return { open: citation !== null, authors, saving, edit, close, update, add, remove, save };
}
