import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  Archive,
  ArrowDownToLine,
  Cloud,
  CloudOff,
  History,
  LoaderCircle,
  RefreshCw,
  UploadCloud,
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
import { useAuthModal } from "@/context/auth-modal-context";
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

export const RemoteDocuments = () => {
  const { user } = useUser();
  const { openLogin } = useAuthModal();
  const online = useOnline();
  const [commits, setCommits] = useState<CommitListResponse["commits"]>([]);
  const [localDocs, setLocalDocs] = useState<HighTexDocument[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [linkedLocalId, setLinkedLocalId] = useState<string>();
  const [commitMessage, setCommitMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const current = useMemo(
    () => commits.find((commit) => commit.type === "current"),
    [commits],
  );
  const archives = useMemo(
    () => commits.filter((commit) => commit.type !== "current" && commit.sha256),
    [commits],
  );
  const selectedDoc = localDocs.find((doc) => doc.id === selectedId);

  const refresh = useCallback(async () => {
    if (!user || !online) return;
    setBusy(true);
    setError("");
    try {
      const [response, docs] = await Promise.all([
        window.hightex.cloud.list(),
        HighTexDB.getInstance().documents.toArray(),
      ]);
      const nextCommits = response.commits || [];
      console.log(nextCommits)
      const nextCurrent = nextCommits.find((commit) => commit.type === "current");
      const mappedId = nextCurrent?.document_id
        ? await window.hightex.cloud.resolve(nextCurrent.document_id)
        : undefined;
      const validMappedId = mappedId && docs.some((doc) => doc.id === mappedId)
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
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }, [online, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pull = async (sha256?: string) => {
    setBusy(true);
    setError("");
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

      const imported = reader.manifest.schema_version === 2
        ? await importHighTexV2Package(file)
        : await importHighTexPackage(file);
      const latest = await window.hightex.cloud.list();
      const serverId = latest.commits.find((item) => item.type === "current")?.document_id;
      if (serverId) {
        await window.hightex.cloud.link(serverId, imported.id);
        setLinkedLocalId(imported.id);
      }
      toast.success(
        `“${imported.title}” berhasil disimpan sebagai dokumen lokal.`,
      );
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const push = async () => {
    if (!selectedDoc) return;
    setBusy(true);
    setError("");
    try {
      const { file, hash } = await new Exporter(selectedDoc.id).exportForPush();
      const response = await window.hightex.cloud.push(
        file,
        hash,
        selectedDoc,
        commitMessage.trim(),
      );
      if ("error" in response) {
        setError(
          `Cloud sudah memiliki perubahan yang lebih baru. Unduh versi terbaru sebelum menyimpan lagi. SHA saat ini: ${response.sha256}`,
        );
        return;
      }

      const latest = await window.hightex.cloud.list();
      const serverId = latest.commits.find((item) => item.type === "current")?.document_id;
      if (serverId) {
        await window.hightex.cloud.link(serverId, selectedDoc.id);
        setLinkedLocalId(selectedDoc.id);
      }
      toast.success(
        response.changed ? "Perubahan tersimpan di cloud." : "Dokumen cloud sudah memuat versi ini.",
      );
      setCommitMessage("");
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl bg-neutral-50 p-8 text-center dark:bg-neutral-900">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
          <Cloud className="size-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Dokumenmu, kapan saja</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Masuk untuk menyimpan dokumen ke cloud dan mengambilnya lagi nanti.
        </p>
        <Button
          className="mt-5"
          onClick={openLogin}
          disabled={!online}
        >
          Masuk
        </Button>
      </section>
    );
  }

  return (
    <main className="space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl p-6">
        <div>
          <h1 className="text-2xl font-semibold">Dokumen cloud</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Simpan versi terbaru, atau ambil lagi versi yang pernah disimpan.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={!online || busy}
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Muat ulang
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={online ? <Cloud className="size-4" /> : <CloudOff className="size-4" />}
          label="Koneksi"
          value={online ? "Terhubung" : "Offline"}
        />
        <SummaryCard
          icon={<Archive className="size-4" />}
          label="Versi cloud"
          value={current?.sha256 ? `${current.sha256.slice(0, 12)}…` : "Belum ada snapshot"}
        />
        <SummaryCard
          icon={<History className="size-4" />}
          label="Versi sebelumnya"
          value={archives.length ? `${archives.length} tersedia` : "Belum ada"}
        />
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900">
        <div className="flex items-start gap-4 border-b pb-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UploadCloud className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Simpan ke cloud</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Pilih dokumen lokal. Tambahkan catatan singkat supaya perubahan ini mudah dikenali nanti.
            </p>
          </div>
        </div>
        <div className="grid gap-5 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pilih dokumen</span>
              <Select value={selectedId} onValueChange={setSelectedId} disabled={!localDocs.length || busy}>
                <SelectTrigger className="w-full bg-white dark:bg-neutral-950">
                  <SelectValue placeholder="Pilih dokumen lokal" />
                </SelectTrigger>
                <SelectContent>
                  {localDocs.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>{<ParsedItalic text={doc.title || "Tanpa judul"} />}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {selectedDoc && (
              <div className="rounded-xl bg-white p-4 dark:bg-neutral-950">
                <div className="text-xs text-muted-foreground">Yang akan disimpan</div>
                <div className="mt-1 truncate text-sm font-semibold"><ParsedItalic text={selectedDoc.title || "Tanpa judul"} /></div>
                <div className="mt-2 break-all font-mono text-[11px] text-muted-foreground">Local ID: {selectedDoc.id}</div>
                {linkedLocalId === selectedDoc.id && current?.document_id && (
                  <div className="mt-2 break-all text-[11px] text-muted-foreground">Tertaut ke Server ID: <span className="font-mono">{current.document_id}</span></div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <label className="block flex-1 space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Catatan perubahan <span className="normal-case tracking-normal">(opsional)</span></span>
              <Textarea
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Contoh: Merapikan bab metodologi"
                disabled={busy}
                className="min-h-24 resize-y bg-white dark:bg-neutral-950"
              />
              <span className="block text-right text-[11px] text-muted-foreground">{commitMessage.length}/500</span>
            </label>
            <Button
              onClick={() => void push()}
              disabled={!online || busy || !selectedDoc}
              className="w-full sm:w-auto"
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
              {busy ? "Menyimpan…" : "Simpan versi"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Archive className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">Versi terbaru</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Salinan terakhir yang tersimpan di cloud.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void pull()}
            disabled={!online || busy || !current?.sha256}
          >
            <ArrowDownToLine className="size-4" /> Unduh ke perangkat ini
          </Button>
        </div>
        {current?.sha256 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Detail label="Server ID" value={current.document_id} />
            <Detail label="Local ID alias" value={linkedLocalId || "Belum ditautkan"} />
            <Detail label="SHA-256" value={current.sha256} />
            <Detail label="Catatan terakhir" value={current.message || "Tidak ada catatan"} />
          </div>
        ) : (
          <div className="mt-5 rounded-xl bg-white p-4 text-sm text-muted-foreground dark:bg-neutral-950">
            Belum ada versi yang disimpan. Pilih dokumen lokal di atas untuk memulai.
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><History className="size-4" /></div>
          <div>
            <h2 className="font-semibold">Versi sebelumnya</h2>
            <p className="mt-1 text-sm text-muted-foreground">Unduh versi lama sebagai dokumen lokal.</p>
          </div>
        </div>
        <div className="mt-4 divide-y">
          {archives.map((commit, index) => (
            <div key={index} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-2 last:pb-1">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-muted-foreground dark:bg-neutral-800">{index + 1}</span>
                <div className="min-w-0 space-y-1">
                  <div className="wrap-break-word text-sm font-medium">{commit.message || "Tanpa catatan perubahan"}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(commit.created_at)}{commit.author ? ` · Pengguna ${commit.author}` : ""}</div>
                  <div className="break-all font-mono text-[11px] text-muted-foreground">SHA-256: {commit.sha256}</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void pull(commit.sha256 || undefined)}
                disabled={!online || busy || !commit.sha256}
              >
                <ArrowDownToLine className="size-4" /> Unduh versi ini
              </Button>
            </div>
          ))}
          {!archives.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">Versi sebelumnya akan muncul di sini setelah ada perubahan yang disimpan.</p>
          )}
        </div>
      </section>
    </main>
  );
};

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 truncate text-sm font-semibold" title={value}>{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white p-3 dark:bg-neutral-950">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-mono text-xs">{value}</div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
