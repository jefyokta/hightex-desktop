import { formatDistanceToNow } from "date-fns";
import { CalendarClock, FileArchive, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";


const loadSnapshots = async () => {
  return (await window.ipcRenderer.invoke("snapshots")) as SnapshotEntity[];
};

const formatRelativeDate = (value: Date | string | null | undefined) => {
  if (!value) return "Unknown time";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return formatDistanceToNow(date, { addSuffix: true });
};

export const Snapshot = () => {
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<SnapshotEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const items = await loadSnapshots();
      console.log(items)
      setSnapshots(items);
    } catch (err) {
      console.error(err);
      setError("Failed to load snapshots.");
    } finally {
      setLoading(false);
    }
  }, []);

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
            {snapshots.map((snapshot) => (
              <button
                key={snapshot.id}
                onClick={() => navigate(`/dashboard/snapshots/${snapshot.id}`)}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-white/80 dark:hover:bg-neutral-950/60"
              >
                <FileArchive
                  size={17}
                  className="shrink-0 text-neutral-500 dark:text-neutral-400"
                />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {snapshot.type == 'finalDefense' && "Final Defense"}
                    {snapshot.type == 'proposal' && "Proposal"}
                    {snapshot.type == snapshot.id && `Advising ${new Date(snapshot.createdAt).toLocaleString()}`}

                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                    {snapshot.filePath}
                  </div>
                </div>

                <div className="hidden shrink-0 items-center gap-1.5 text-[11px] text-neutral-500 sm:flex">
                  <CalendarClock size={13} />
                  {formatRelativeDate(snapshot.updatedAt ?? snapshot.createdAt)}
                </div>
              </button>
            ))}
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
