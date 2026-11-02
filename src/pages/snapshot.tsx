import { PageHeader } from "@/components/dashboard/page-header";
import { enUS, id as indonesian } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
import { CalendarClock, FileArchive, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirm } from "@/utils/confirm";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { t, getCurrentLanguage, useAppLanguage } from "@/utils/lang";

const loadSnapshots = async () => {
  return (await window.ipcRenderer.invoke("snapshots")) as SnapshotEntity[];
};

const formatRelativeDate = (value: Date | string | null | undefined) => {
  if (!value) return t("snapshots.unknown_time");

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("snapshots.unknown_time");

  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: getCurrentLanguage() === "id" ? indonesian : enUS,
  });
};

const formatSnapshotType = (type: string) => {
  return type
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

// duplicate should use @/src/utils/snapshot.ts
const getSnapshotTitle = (snapshot: SnapshotEntity) => {
  if (snapshot.type === "advising") {
    return `${t("snapshots.advising")} ${new Date(snapshot.createdAt).toLocaleString()}`;
  }

  return formatSnapshotType(snapshot.type);
};

export const Snapshot = () => {
  useAppLanguage();
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<SnapshotEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const items = await loadSnapshots();
      setSnapshots(items);
    } catch (err) {
      console.error(err);
      setError(t("snapshots.load_error"));
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSnapshot = async (snapshot: SnapshotEntity) => {
    const label = getSnapshotTitle(snapshot);
    const confirmed = await confirm({
      title: t("snapshots.delete_title", { label }),
      desc: t("snapshots.delete_description"),
      confirmText: t("snapshots.delete"),
    });

    if (!confirmed) {
      return;
    }

    const toastId = toast.loading(t("snapshots.deleting"));
    setDeletingId(snapshot.id);

    try {
      const deleted = await window.ipcRenderer.invoke(
        "snapshot:delete",
        snapshot.id,
      );

      if (!deleted) {
        throw new Error(t("snapshots.not_found"));
      }

      setSnapshots((items) => items.filter((item) => item.id !== snapshot.id));
      toast.success(t("snapshots.deleted"), { id: toastId });
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
      throw new ShouldNotified({
        message: t("snapshots.delete_error"),
        description:
          err instanceof Error ? err.message : t("snapshots.delete_failed"),
      });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="flex min-h-[60vh] flex-col gap-7">
      <PageHeader
        title={t("snapshots.title")}
        description={t("snapshots.description")}
        actions={
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            {t("snapshots.refresh")}
          </Button>
        }
      />

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="min-h-0 flex-1 border-t pt-3">
        {loading ? (
          <EmptyState label={t("snapshots.loading")} />
        ) : snapshots.length === 0 ? (
          <EmptyState label={t("snapshots.empty")} />
        ) : (
          <div className="space-y-1">
            {snapshots.map((snapshot) => {
              const title = getSnapshotTitle(snapshot);

              return (
                <div
                  key={snapshot.id}
                  className="group flex w-full items-center gap-1 rounded-xl p-1 transition hover:bg-white/80 dark:hover:bg-neutral-950/60"
                >
                  <button
                    onClick={() =>
                      navigate(`/dashboard/snapshots/${snapshot.id}`)
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left"
                  >
                    <FileArchive
                      size={17}
                      className="shrink-0 text-neutral-500 dark:text-neutral-400"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {title}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                        {snapshot.filePath}
                      </div>
                    </div>

                    <div className="hidden shrink-0 items-center gap-1.5 text-[11px] text-neutral-500 sm:flex">
                      <CalendarClock size={13} />
                      {formatRelativeDate(
                        snapshot.updatedAt ?? snapshot.createdAt,
                      )}
                    </div>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={deletingId === snapshot.id}
                    onClick={() => deleteSnapshot(snapshot)}
                    className="text-neutral-400 opacity-100 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    title={t("snapshots.delete_snapshot")}
                  >
                    {deletingId === snapshot.id ? (
                      <RefreshCw className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                    <span className="sr-only">
                      {t("snapshots.delete_snapshot")}
                    </span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

const EmptyState = ({ label }: { label: string }) => (
  <div className="flex min-h-32 items-center justify-center rounded-xl text-xs text-neutral-400 dark:text-neutral-500">
    {label}
  </div>
);
