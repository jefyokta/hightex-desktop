import { formatDistanceToNow } from "date-fns";
import { CalendarClock, FileArchive, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirm } from "@/utils/confirm";
import { ShouldNotified } from "@/exception/interfaces/should-notified";

const loadSnapshots = async () => {
  return (await window.ipcRenderer.invoke("snapshots")) as SnapshotEntity[];
};

const formatRelativeDate = (value: Date | string | null | undefined) => {
  if (!value) return "Unknown time";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return formatDistanceToNow(date, { addSuffix: true });
};

const formatSnapshotType = (type: string) => {
  return type
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getSnapshotTitle = (snapshot: SnapshotEntity) => {
  if (snapshot.type === "advising") {
    return `Advising ${new Date(snapshot.createdAt).toLocaleString()}`;
  }

  return formatSnapshotType(snapshot.type);
};

export const Snapshot = () => {
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
      setError("Failed to load snapshots.");
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSnapshot = async (snapshot: SnapshotEntity) => {
    const label = getSnapshotTitle(snapshot);
    const confirmed = await confirm({
      title: `Delete ${label}?`,
      desc: "This will remove the snapshot record, related comments, and snapshot file.",
      confirmText: "Delete",
    });

    if (!confirmed) {
      return;
    }

    const toastId = toast.loading("Deleting snapshot...");
    setDeletingId(snapshot.id);

    try {
      const deleted = await window.ipcRenderer.invoke(
        "snapshot:delete",
        snapshot.id,
      );

      if (!deleted) {
        throw new Error("Snapshot not found");
      }

      setSnapshots((items) => items.filter((item) => item.id !== snapshot.id));
      toast.success("Snapshot deleted", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
      throw new ShouldNotified({
        message: "Failed to delete snapshot",
        description:
          err instanceof Error
            ? err.message
            : "The snapshot could not be deleted.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pb-4">
      <div className="flex shrink-0 items-start justify-between py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Snapshots</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved sharing sessions. Open one to inspect the rendered document
            and comments.
          </p>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="min-h-0 flex-1 rounded-2xl border border-transparent bg-neutral-50 p-2 dark:border-neutral-800 dark:bg-neutral-900/50">
        {loading ? (
          <EmptyState label="Loading snapshots..." />
        ) : snapshots.length === 0 ? (
          <EmptyState label="No snapshots saved yet." />
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
                    className="text-neutral-400 opacity-100 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    title="Delete snapshot"
                  >
                    {deletingId === snapshot.id ? (
                      <RefreshCw className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                    <span className="sr-only">Delete snapshot</span>
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
