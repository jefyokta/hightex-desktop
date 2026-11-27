import { useIPC } from "@/hooks/use-ipc";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { t, type LocaleKey } from "@/utils/lang";
import { useAppLanguage } from "./use-app-language";
import { useReferenceCatalog } from "./use-reference-catalog";
import { useZoteroSearch } from "./use-zotero-search";

export interface ReferenceSearchResult {
  source: "local" | "zotero";
  key: string;
  title: string;
  description: string;
}

interface ReferencePickerOptions {
  query: string;
  zotero?: ConfigShape["zotero"];
  onChoose(key: string): void;
}

/** Search and selection lifecycle shared by the caret popup, dialog and popover. */
export function useReferencePicker({ query, zotero, onChoose }: ReferencePickerOptions) {
  const language = useAppLanguage();
  const { repository, search, status, retry } = useReferenceCatalog();
  const remote = useZoteroSearch(query, zotero);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const request = useRef<object>();

  useEffect(() => {
    const token = {};
    request.current = token;
    return () => {
      if (request.current === token) request.current = undefined;
    };
  }, [query, zotero?.enabled, zotero?.host, zotero?.port]);

  const results = useMemo<ReferenceSearchResult[]>(() => [
    ...search(query).slice(0, 30).map(citation => ({
      source: "local" as const,
      key: citation.getId(),
      title: citation.getTitle() ?? "",
      description: `${t("citation.local_source")} · ${citation.toCite()}`,
    })),
    ...remote.items.map(item => ({
      source: "zotero" as const,
      key: item.key,
      title: item.title,
      description: `Zotero · ${item.date ?? ""}`,
    })),
  ], [search, query, remote.items, language]);

  useEffect(() => setSelected(0), [query]);
  const active = Math.min(selected, Math.max(0, results.length - 1));

  const choose = async (result: ReferenceSearchResult) => {
    if (pending.current) return;
    if (result.source === "local") {
      onChoose(result.key);
      return;
    }
    if (!zotero) return;

    pending.current = true;
    setBusy(true);
    const token = request.current;
    try {
      const bib = await useIPC("zotero").zotero.exportBibtex(zotero.host, zotero.port, result.key);
      if (request.current !== token) return;

      const imported = await repository.importBibtex(bib, { reuseEquivalent: true });
      if (request.current !== token) return;
      if (imported.errors.length) {
        toast.error(imported.errors.join(" "));
        return;
      }
      if (imported.records[0]) onChoose(imported.records[0].key);
    } catch (error) {
      if (request.current !== token) return;
      toast.error(t("citation.zotero.connection_failed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending.current = false;
      if (request.current) setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const direction = event.key === "ArrowDown" ? 1 : results.length - 1;
      setSelected((active + direction) % Math.max(1, results.length));
      return true;
    }
    if (event.key === "Enter" && results[active]) {
      void choose(results[active]);
      return true;
    }
    return false;
  };

  const loading = status === "loading" || remote.loading;
  let statusMessage: LocaleKey | undefined;
  if (status === "error") statusMessage = "citation.load_failed";
  else if (remote.unavailable) statusMessage = "citation.zotero.search_unavailable";
  else if (loading) statusMessage = "citation.zotero.loading";

  return {
    results,
    active,
    busy,
    loading,
    statusMessage,
    canRetry: status === "error",
    retry,
    choose,
    onKeyDown,
  };
}
