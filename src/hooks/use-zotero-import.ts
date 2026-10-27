import { useState } from "react";
import { toast } from "sonner";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { ApplicationError } from "@/exception/interfaces/application-error";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { DEFAULT_ZOTERO_CONFIG, type ZoteroItem } from "@/utils/zotero";
import { t } from "@/utils/lang";

async function getConfig() {
  await window.config.ready();
  return window.config.get()?.zotero ?? DEFAULT_ZOTERO_CONFIG;
}

export function useZoteroImport(
  importBibtex: (content: string) => Promise<number>,
) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ZoteroItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const { selected, toggleSelect, clear, addSelected } =
    useMultiSelect<string>("zotero");

  const refreshConnection = async () => {
    const { host, port, enabled } = await getConfig();
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
    const { host, port } = await getConfig();
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
    setItems([]);
    clear();
    if (await refreshConnection()) await loadItems();
  };

  const importSelected = async () => {
    if (selected.length === 0) {
      throw new ShouldNotified({
        message: "Zotero import failed",
        description: t("citation.zotero.select_reference"),
      });
    }
    const selectedItems = items.filter((item) => selected.includes(item.key));
    if (!selectedItems.length) {
      throw new ShouldNotified({
        message: "Zotero import failed",
        description: t("citation.zotero.no_matching_references"),
      });
    }
    const { host, port } = await getConfig();
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
    } catch (error) {
      if (error instanceof ShouldNotified) throw error;
      throw new ShouldNotified({
        message: "Zotero import failed",
        description: ApplicationError.normilize(error),
      });
    }
  };

  const onOpenChange = (value: boolean) => {
    clear();
    setOpen(value);
  };

  const selectAll = () => {
    for (const item of items) addSelected(item.key);
  };

  return {
    open,
    setOpen,
    onOpenChange,
    openImport,
    items,
    loading,
    connected,
    selected,
    toggleSelect,
    clear,
    selectAll,
    refreshConnection,
    importSelected,
  };
}
