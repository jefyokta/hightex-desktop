import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  ChevronDown,
  ChevronsRight,
  Cloud,
  CloudOff,
  Copy,
  History,
  Link2,
  LoaderCircle,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Exporter } from "@/utils/htx/exporter";
import {
  HighTexImporter as LegacyPackageReader,
  importHighTexPackage,
} from "@/utils/import-hightex";
import { importHighTexV2Package } from "@/utils/import-v2";
import { confirm } from "@/utils/confirm";
import { useUser } from "@/hooks/use-user";
import { useOnline } from "@/hooks/use-online";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ParsedItalic } from "@/utils/parse-italic";
import { LoginGate } from "@/components/login-gate";

type Commit = CommitListResponse["commits"][number];
type Task =
  | { kind: "refresh" }
  | { kind: "push" }
  | { kind: "pull"; sha?: string };
type Notice = { message: string; action?: { label: string; run: () => void } };

export const RemoteDocuments = () => {
  const { user } = useUser();
  const online = useOnline();

  const [commits, setCommits] = useState<Commit[]>([]);
  const [localDocs, setLocalDocs] = useState<HighTexDocument[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [linkedLocalId, setLinkedLocalId] = useState<string>();
  const [commitMessage, setCommitMessage] = useState("");
  const [task, setTask] = useState<Task | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showTech, setShowTech] = useState(false);
  // Sidebar riwayat: terbuka di layar lebar, tertutup (jadi drawer) di layar sempit.
  const [historyOpen, setHistoryOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches,
  );

  const busy = task !== null;
  const pullingSha = task?.kind === "pull" ? (task.sha ?? "latest") : null;
  const showSkeleton = !loaded && online;

  const current = useMemo(
    () => commits.find((commit) => commit.type === "current"),
    [commits],
  );
  const archives = useMemo(
    () =>
      commits.filter((commit) => commit.type !== "current" && commit.sha256),
    [commits],
  );
  const selectedDoc = localDocs.find((doc) => doc.id === selectedId);
  const linkedDoc = localDocs.find((doc) => doc.id === linkedLocalId);
  const isLinked = Boolean(selectedDoc && linkedLocalId === selectedDoc.id);

  // Ambil data tanpa mengubah `task` supaya bisa dipakai ulang oleh push/pull.
  const load = useCallback(async () => {
    if (!user || !online) return;
    const [response, docs] = await Promise.all([
      window.hightex.cloud.list(),
      HighTexDB.getInstance().documents.toArray(),
    ]);
    const nextCommits = response.commits || [];
    const nextCurrent = nextCommits.find((commit) => commit.type === "current");
    const mappedId = nextCurrent?.document_id
      ? await window.hightex.cloud.resolve(nextCurrent.document_id)
      : undefined;
    const validMappedId =
      mappedId && docs.some((doc) => doc.id === mappedId)
        ? mappedId
        : undefined;

    setCommits(nextCommits);
    setLocalDocs(docs);
    setLinkedLocalId(validMappedId);
    setSelectedId((previous) => {
      if (validMappedId) return validMappedId;
      if (docs.some((doc) => doc.id === previous)) return previous;
      return docs[0]?.id || "";
    });
  }, [online, user]);

  const refresh = useCallback(async () => {
    if (!user || !online) return;
    setTask({ kind: "refresh" });
    setNotice(null);
    try {
      await load();
    } catch (cause) {
      setNotice({ message: errorMessage(cause) });
    } finally {
      setTask(null);
      setLoaded(true);
    }
  }, [load, online, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pull = async (sha256?: string) => {
    setTask({ kind: "pull", sha: sha256 });
    setNotice(null);
    try {
      const result = await window.hightex.cloud.pull(undefined, sha256);
      if (result.status === "empty") {
        toast.info("Belum ada versi dokumen di cloud.");
        return;
      }
      if (result.status === "not_found") {
        toast.info("Belum ada dokumen tersimpan untuk akun ini.");
        return;
      }

      const file = new File([new Uint8Array(result.file)], "remote.hightex");
      const reader = await LegacyPackageReader.create(file);
      const documentId = reader.manifest.document.id;
      const existing = await HighTexDB.getInstance().documents.get(documentId);
      if (
        existing &&
        !(await confirm({
          title: `Ganti salinan lokal “${existing.title}”?`,
          desc: "Paket cloud akan menggantikan isi dokumen lokal dengan ID yang sama.",
        }))
      ) {
        return;
      }

      // Buang slash di akhir path (sebelumnya `slice(-1)` justru menyisakan "/").
      const userData = await window.file.getUserDataPath();
      const base = userData.replace(/[\\/]+$/, "");
      const filePath = `${base}/documents/${documentId}.hightex`;

      const imported =
        reader.manifest.schema_version === 2
          ? await importHighTexV2Package(file, filePath)
          : await importHighTexPackage(file);

      const latest = await window.hightex.cloud.list();
      const serverId = latest.commits.find(
        (item) => item.type === "current",
      )?.document_id;
      if (serverId) {
        await window.hightex.cloud.link(serverId, imported.id);
        setLinkedLocalId(imported.id);
      }
      toast.success(
        `“${imported.title}” berhasil disimpan sebagai dokumen lokal.`,
      );
      await load();
    } catch (cause) {
      setNotice({ message: errorMessage(cause) });
    } finally {
      setTask(null);
    }
  };

  const push = async () => {
    if (!selectedDoc) return;
    setTask({ kind: "push" });
    setNotice(null);
    try {
      const { file, hash } = await new Exporter(selectedDoc.id).exportForPush();
      const response = await window.hightex.cloud.push(
        file,
        hash,
        selectedDoc,
        commitMessage.trim(),
      );
      if ("error" in response) {
        setNotice({
          message:
            "Cloud sudah memiliki versi yang lebih baru. Unduh versi terbaru dulu sebelum menyimpan lagi.",
          action: { label: "Unduh versi terbaru", run: () => void pull() },
        });
        return;
      }

      const latest = await window.hightex.cloud.list();
      const serverId = latest.commits.find(
        (item) => item.type === "current",
      )?.document_id;
      if (serverId) {
        await window.hightex.cloud.link(serverId, selectedDoc.id);
        setLinkedLocalId(selectedDoc.id);
      }
      toast.success(
        response.changed
          ? "Perubahan tersimpan di cloud."
          : "Dokumen cloud sudah memuat versi ini.",
      );
      setCommitMessage("");
      await load();
    } catch (cause) {
      setNotice({ message: errorMessage(cause) });
    } finally {
      setTask(null);
    }
  };

  if (!user) {
    return (
      <LoginGate />
    );
  }

  const pushHint = !online
    ? "Butuh koneksi internet untuk menyimpan."
    : loaded && !localDocs.length
      ? "Belum ada dokumen lokal untuk disimpan."
      : "";

  const historyList = (
    <HistoryList
      archives={archives}
      online={online}
      busy={busy}
      pullingSha={pullingSha}
      onPull={(sha) => void pull(sha)}
    />
  );

  return (
    <main className="flex items-stretch gap-6 pb-10">
      <div className="mx-auto w-full min-w-0 max-w-2xl flex-1 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Dokumen cloud</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Simpan versi terbaru, atau ambil lagi versi yang pernah disimpan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="size-4" />
              Riwayat
              {archives.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-[11px] leading-5">
                  {archives.length}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={!online || busy}
            >
              {task?.kind === "refresh" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Muat ulang
            </Button>
          </div>
        </header>

        {!online && (
          <div className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4 text-sm text-muted-foreground dark:bg-neutral-900">
            <CloudOff className="mt-0.5 size-4 shrink-0" />
            <p>
              Kamu sedang offline. Dokumen di perangkat ini tetap aman.
              Menyimpan dan mengunduh bisa dilakukan setelah terhubung lagi.
            </p>
          </div>
        )}

        {notice && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="wrap-break-word">{notice.message}</p>
              {notice.action && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={notice.action.run}
                  disabled={busy || !online}
                  className="bg-white/60 dark:bg-transparent"
                >
                  {notice.action.label}
                </Button>
              )}
            </div>
            <button
              type="button"
              aria-label="Tutup pesan"
              onClick={() => setNotice(null)}
              className="-m-1 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <section className="rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Cloud className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold">Versi di cloud</h2>
                {showSkeleton ? (
                  <div
                    className="mt-2 h-4 w-44 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"
                    aria-hidden
                  />
                ) : current?.sha256 ? (
                  <div className="mt-0.5 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {current.created_at
                        ? `Disimpan ${timeAgo(current.created_at)}`
                        : "Tersimpan di cloud"}
                    </p>
                    <p className="wrap-break-word text-sm">
                      {current.message || (
                        <span className="text-muted-foreground">
                          Tanpa catatan
                        </span>
                      )}
                    </p>
                    {linkedDoc && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Link2 className="size-3.5 shrink-0" />
                        <span className="truncate">
                          Tertaut dengan{" "}
                          <ParsedItalic
                            text={linkedDoc.title || "Tanpa judul"}
                          />
                        </span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {online
                      ? "Belum ada versi di cloud. Simpan dokumenmu di bawah untuk memulai."
                      : "Status cloud tidak bisa dimuat saat offline."}
                  </p>
                )}
              </div>
            </div>

            {current?.sha256 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void pull()}
                disabled={!online || busy}
              >
                {pullingSha === "latest" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="size-4" />
                )}
                Unduh
              </Button>
            )}
          </div>

          {current?.sha256 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowTech((value) => !value)}
                aria-expanded={showTech}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Detail teknis
                <ChevronDown
                  className={`size-3.5 transition-transform ${showTech ? "rotate-180" : ""
                    }`}
                />
              </button>
              {showTech && (
                <dl className="mt-3 space-y-3 rounded-xl bg-white px-4 py-3 dark:bg-neutral-950">
                  <TechRow label="Server ID" value={current.document_id} />
                  <TechRow label="Local ID" value={linkedLocalId} />
                  <TechRow label="SHA-256" value={current.sha256} />
                </dl>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UploadCloud className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">Simpan ke cloud</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Pilih dokumen, lalu simpan sebagai versi baru.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="cloud-doc-select" className="text-sm font-medium">
                Dokumen
              </label>
              <Select
                value={selectedId}
                onValueChange={setSelectedId}
                disabled={!localDocs.length || busy}
              >
                <SelectTrigger
                  id="cloud-doc-select"
                  className="w-full bg-white dark:bg-neutral-950"
                >
                  <SelectValue
                    placeholder={
                      !loaded
                        ? "Memuat dokumen…"
                        : localDocs.length
                          ? "Pilih dokumen lokal"
                          : "Belum ada dokumen lokal"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {localDocs.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      <ParsedItalic text={doc.title || "Tanpa judul"} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedDoc && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {isLinked ? (
                    <>
                      <Link2 className="size-3.5 shrink-0" />
                      Dokumen ini sudah tertaut dengan versi di cloud.
                    </>
                  ) : current?.sha256 ? (
                    <>
                      <AlertCircle className="size-3.5 shrink-0" />
                      Dokumen ini belum tertaut dengan dokumen di cloud saat
                      ini.
                    </>
                  ) : (
                    "Akan menjadi versi pertama di cloud."
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="cloud-commit-message"
                className="flex items-baseline justify-between text-sm font-medium"
              >
                <span>
                  Catatan{" "}
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {commitMessage.length}/500
                </span>
              </label>
              <Textarea
                id="cloud-commit-message"
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Contoh: Merapikan bab metodologi"
                disabled={busy}
                className="min-h-16 resize-y bg-white dark:bg-neutral-950"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{pushHint}</p>
              <Button
                onClick={() => void push()}
                disabled={!online || busy || !selectedDoc}
                className="ml-auto w-full sm:w-auto"
              >
                {task?.kind === "push" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <UploadCloud className="size-4" />
                )}
                {task?.kind === "push" ? "Menyimpan…" : "Simpan versi"}
              </Button>
            </div>
          </div>
        </section>
      </div>

      <aside
        aria-label="Riwayat versi"
        className={`relative hidden shrink-0 self-stretch overflow-x-clip border-l transition-[width] duration-200 lg:block ${historyOpen ? "w-80" : "w-14"
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
              aria-label="Buka riwayat versi"
              title="Riwayat versi"
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
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-30 bg-black/30"
            onClick={() => setHistoryOpen(false)}
            aria-hidden
          />
          <aside
            aria-label="Riwayat versi"
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
    </main>
  );
};

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
          Riwayat versi
          {count > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-[11px] font-normal leading-5 text-muted-foreground">
              {count}
            </span>
          )}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Unduh versi lama sebagai dokumen lokal.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup riwayat"
        title="Tutup"
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
}: {
  archives: Commit[];
  online: boolean;
  busy: boolean;
  pullingSha: string | null;
  onPull: (sha?: string) => void;
}) {
  if (!archives.length) {
    return (
      <div className="mt-8 px-2 text-center">
        <p className="text-sm font-medium">Belum ada versi sebelumnya</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Versi lama akan muncul di sini setelah kamu menyimpan perubahan
          berikutnya.
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
                  Tanpa catatan
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
            onClick={() => onPull(commit.sha256 || undefined)}
            disabled={!online || busy || !commit.sha256}
            aria-label={`Unduh versi ${formatDate(commit.created_at)}`}
          >
            {pullingSha === commit.sha256 ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowDownToLine className="size-4" />
            )}
            Unduh
          </Button>
        </li>
      ))}
    </ol>
  );
}

function TechRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-start gap-1">
        <span className="min-w-0 flex-1 break-all font-mono text-xs">
          {value || "Belum ditautkan"}
        </span>
        {value && <CopyButton value={value} label={label} />}
      </dd>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Gagal menyalin.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Salin ${label}`}
      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? (
        <Check className="size-3.5" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function timeAgo(value?: string | null) {
  if (!value) return "";
  const diff = new Date(value).getTime() - Date.now();
  if (Number.isNaN(diff)) return "";
  const rtf = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "baru saja";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}