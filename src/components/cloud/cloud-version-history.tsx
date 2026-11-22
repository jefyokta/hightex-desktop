import { useEffect, useState } from "react";
import { ArrowDownToLine, ChevronsRight, History, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CloudCommit } from "@/cloud/documents";
import { t } from "@/utils/lang";
import { formatDate } from "./version-time";

interface Props {
  archives: CloudCommit[];
  online: boolean;
  busy: boolean;
  pullingSha: string | null;
  canRestore: boolean;
  open: boolean;
  onOpenChange(open: boolean): void;
  onDownload(sha: string): void;
  onRestore(sha: string): void;
}

export function useCloudHistoryPanel() {
  const [open, setOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1280px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const resize = () => {
      if (!media.matches) setOpen(false);
    };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);

  return { open, setOpen };
}

export function CloudVersionHistory({
  archives, online, busy, pullingSha, canRestore, open: historyOpen, onOpenChange: setHistoryOpen,
  onDownload, onRestore,
}: Props) {
  const historyList = (
    <HistoryList
      archives={archives}
      online={online}
      busy={busy}
      pullingSha={pullingSha}
      onPull={onDownload}
      onRestore={onRestore}
      canRestore={canRestore}
    />
  );

  return (
    <>
      <aside
        aria-label={t("remote.version_history")}
        className={`relative hidden shrink-0 self-stretch overflow-x-clip border-l transition-[width] duration-200 xl:block ${
          historyOpen ? "w-80" : "w-14"
        }`}
      >
        {historyOpen ? (
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] w-80 overflow-y-auto px-5">
            <HistoryHeader
              count={archives.length}
              onClose={() => setHistoryOpen(false)}
            />
            {historyList}
          </div>
        ) : (
          <div className="sticky top-4 flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              aria-label={t("remote.open_version_history")}
              title={t("remote.version_history")}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-neutral-50 hover:text-foreground dark:hover:bg-neutral-900"
            >
              <History className="size-4" />
            </button>
            {archives.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[11px] leading-5 text-muted-foreground">
                {archives.length}
              </span>
            )}
          </div>
        )}
      </aside>

      {historyOpen && (
        <div className="xl:hidden">
          <div
            className="fixed inset-0 z-30 bg-black/30"
            onClick={() => setHistoryOpen(false)}
            aria-hidden
          />
          <aside
            aria-label={t("remote.version_history")}
            className="fixed inset-y-0 right-0 z-40 w-full max-w-sm overflow-y-auto border-l bg-background p-5 shadow-2xl"
          >
            <HistoryHeader
              count={archives.length}
              onClose={() => setHistoryOpen(false)}
            />
            {historyList}
          </aside>
        </div>
      )}
    </>
  );
}

function HistoryHeader({
  count,
  onClose,
}: {
  count: number;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-semibold">
          <History className="size-4 text-muted-foreground" />
          {t("remote.version_history")}
          {count > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-[11px] font-normal leading-5 text-muted-foreground">
              {count}
            </span>
          )}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("remote.download_old_version")}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("remote.close_history")}
        title={t("common.close")}
        className="-m-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronsRight className="size-4" />
      </button>
    </div>
  );
}

function HistoryList({
  archives,
  online,
  busy,
  pullingSha,
  onPull,
  onRestore,
  canRestore,
}: {
  archives: CloudCommit[];
  online: boolean;
  busy: boolean;
  pullingSha: string | null;
  onPull: (sha: string) => void;
  onRestore: (sha: string) => void;
  canRestore: boolean;
}) {
  if (!archives.length) {
    return (
      <div className="mt-8 px-2 text-center">
        <p className="text-sm font-medium">
          {t("remote.no_previous_versions")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("remote.previous_versions_hint")}
        </p>
      </div>
    );
  }

  return (
    <ol className="mt-4 divide-y">
      {archives.map((commit) => (
        <li key={commit.sha256} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 wrap-break-word text-sm font-medium">
              {commit.message || (
                <span className="font-normal text-muted-foreground">
                  {t("remote.no_note")}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(commit.created_at)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => commit.sha256 && onPull(commit.sha256)}
            disabled={!online || busy || !commit.sha256}
            aria-label={t("remote.download_version", {
              date: formatDate(commit.created_at),
            })}
          >
            {pullingSha === commit.sha256 ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowDownToLine className="size-4" />
            )}
            {t("remote.copy")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!online || busy || !canRestore || !commit.sha256}
            onClick={() => commit.sha256 && onRestore(commit.sha256)}
          >
            {t("remote.restore")}
          </Button>
        </li>
      ))}
    </ol>
  );
}
