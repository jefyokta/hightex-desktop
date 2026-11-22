import { useConfig } from "./use-config";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { ApplicationError } from "@/exception/interfaces/application-error";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { DEFAULT_ZOTERO_CONFIG } from "@/utils/zotero";
import { t } from "@/utils/lang";
import { createCitationSearch } from "@/utils/citation-search";
import { useZoteroSearch } from "./use-zotero-search";

export function useZoteroImport(
  importBibtex: (content: string) => Promise<number>,
) {
  const { config } = useConfig();
  const zotero = config?.zotero ?? DEFAULT_ZOTERO_CONFIG;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ZoteroItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [importing, setImporting] = useState(false);
  const pending = useRef(false);
  const { selected, toggleSelect, clear, addSelected } =
    useMultiSelect<string>("zotero");
  const remote = useZoteroSearch(query, zotero, open);
  const search = useMemo(() => createCitationSearch(items, item => ({
    key: item.key, title: item.title, year: item.date ?? "", doi: item.doi ?? "",
    authors: (item.creators ?? []).map(author => [author.firstName, author.lastName, author.name].filter(Boolean).join(" ")).join(" "),
  })), [items]);
  const visibleItems = useMemo(() => [...new Map([
    ...search(query).map(item => [item.key, item] as const),
    ...remote.items.map(item => [item.key, item] as const),
  ]).values()], [search, query, remote.items]);

  const refreshConnection = async () => {
    if (pending.current) return;
    const { host, port, enabled } = zotero;
    if (!enabled) {
      setConnected(false);
      throw new ShouldNotified({
        message: t("citation.zotero.integration_disabled"),
        description: t("citation.zotero.integration_disabled"),
      });
    }
    setLoading(true);
    try {
      const result = await window.zotero.testConnection(host, port);
      if (!result?.connected) {
        setConnected(false);
        throw new ShouldNotified({
          message: t("citation.zotero.connection_failed"),
          description:
            result?.message ?? t("citation.zotero.connection_failed"),
        });
      }
      setConnected(true);
      return true;
    } catch (error) {
      setConnected(false);
      if (error instanceof ShouldNotified) throw error;
      throw new ShouldNotified({
        message: t("citation.zotero.connection_failed"),
        description: ApplicationError.normilize(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    const { host, port } = zotero;
    setLoading(true);
    try {
      const references = await window.zotero.listItems(host, port, 100);
      setItems(references || []);
      clear();
      if (!references?.length) {
        throw new ShouldNotified({
          message: "Zotero import failed",
          description: t("citation.zotero.no_references"),
        });
      }
    } catch (error) {
      if (error instanceof ShouldNotified) throw error;
      throw new ShouldNotified({
        message: "Zotero import failed",
        description: ApplicationError.normilize(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const openImport = async () => {
    setOpen(true);
    setQuery("");
    setItems([]);
    clear();
    if (await refreshConnection()) await loadItems();
  };

  const importSelected = async () => {
    if (pending.current) return;
    if (selected.length === 0) {
      throw new ShouldNotified({
        message: "Zotero import failed",
        description: t("citation.zotero.select_reference"),
      });
    }
    const selectedItems = visibleItems.filter((item) => selected.includes(item.key));
    if (!selectedItems.length) {
      throw new ShouldNotified({
        message: "Zotero import failed",
        description: t("citation.zotero.no_matching_references"),
      });
    }
    const { host, port } = zotero;
    pending.current = true;
    setImporting(true);
    try {
      const payloads = await Promise.all(
        selectedItems.map((item) =>
          window.zotero.exportBibtex(host, port, item.key),
        ),
      );
      const count = await importBibtex(payloads.filter(Boolean).join("\n\n"));
      if (count === 0) {
        throw new ShouldNotified({
          message: "Zotero import failed",
          description: t("citation.zotero.no_valid_imported"),
        });
      }
      toast.success(t("citation.zotero.imported", { count }));
      clear();
      setOpen(false);
    } catch (error) {
      if (error instanceof ShouldNotified) throw error;
      throw new ShouldNotified({
        message: "Zotero import failed",
        description: ApplicationError.normilize(error),
      });
    } finally {
      pending.current = false;
      setImporting(false);
    }
  };

  const onOpenChange = (value: boolean) => {
    if (pending.current) return;
    clear();
    setOpen(value);
  };

  const selectAll = () => {
    for (const item of visibleItems) addSelected(item.key);
  };

  return {
    open,
    onOpenChange,
    openImport,
    items: visibleItems,
    query,
    setQuery: (query: string) => { clear(); setQuery(query); },
    searching: remote.loading,
    searchUnavailable: remote.unavailable,
    loading,
    importing,
    connected,
    selected,
    toggleSelect,
    clear,
    selectAll,
    refreshConnection,
    importSelected,
  };
}
