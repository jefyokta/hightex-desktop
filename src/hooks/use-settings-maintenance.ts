import { useRef, useState } from "react";
import { toast } from "sonner";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { cleanUnusedProgress, type CleanProgressEvent } from "@/utils/clean-unused-data";
import { t } from "@/utils/lang";
import { useConfig } from "./use-config";
import { useCitationCleanup } from "./use-citation-cleanup";

type MaintenanceTask = "cache" | "config" | "documents";
type ProgressToast = string | number;

function reportCleanup(event: CleanProgressEvent, id: ProgressToast) {
  switch (event.type) {
    case "start":
      toast.loading(t("settings.data.clear_cache.progress.start", {
        chaptersCount: event.totals.chapters, imagesCount: event.totals.images,
      }), { id });
      return;
    case "chapter":
    case "image":
      toast.loading(t("settings.data.clear_cache.progress.deleting", {
        name: event.type === "chapter" ? "chapters" : "images",
        index: event.index, total: event.total,
      }), { id });
      return;
    case "done":
      toast.success(t("settings.data.clear_cache.progress.done", {
        deletedChapters: event.deletedChapters, deletedImages: event.deletedImages,
      }), { id });
  }
}

/** Keep maintenance progress and request ownership out of the settings view. */
export function useSettingsMaintenance() {
  const { resetConfig } = useConfig();
  const citations = useCitationCleanup();
  const [task, setTask] = useState<MaintenanceTask | null>(null);
  const pending = useRef(false);

  const run = async (task: MaintenanceTask, action: (id: ProgressToast) => Promise<void>) => {
    if (pending.current || citations.cleaning) return;
    pending.current = true;
    setTask(task);
    const id = toast.loading(t("common.loading"));
    try {
      await action(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.data.clear_cache.progress.failed"), { id });
    } finally {
      pending.current = false;
      setTask(null);
    }
  };

  const clearCache = () => run("cache", async id => {
    toast.loading(t("settings.data.clear_cache.progress.clean_unused"), { id });
    for await (const event of cleanUnusedProgress()) reportCleanup(event, id);
  });

  const resetPreferences = () => run("config", async id => {
    await resetConfig();
    toast.success(t("common.done_action"), { id });
  });

  const clearDocuments = () => run("documents", async id => {
    if (!await window.confirm(t("settings.data.clear_data.confirm"))) {
      toast.dismiss(id);
      return;
    }
    toast.loading(t("settings.data.clear_data.deleting.start"), { id });
    const documents = await HighTexDB.getMainDocuments();
    const db = HighTexDB.getInstance();
    for (const [index, document] of documents.entries()) {
      toast.loading(t("settings.data.clear_data.deleting.progress", {
        deleted: index + 1, total: documents.length, identifier: document.title || document.id,
      }), { id });
      await db.deleteDocument(document.id);
    }
    toast.success(t("settings.data.clear_data.deleting.done", { total: documents.length }), { id });
  });

  return {
    task,
    busy: task !== null || citations.cleaning,
    cleaningCitations: citations.cleaning,
    clearCache, resetPreferences, clearDocuments,
    deleteUnusedCitations: citations.deleteUnusedCitations,
  };
}
