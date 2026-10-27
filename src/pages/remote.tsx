import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  captureDraft,
  draftRevision,
  installCloudDraft,
  prepareCloudDraft,
  rollbackCloudDraft,
} from "@/cloud/draft-transfer";
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
import { exportCloudArtifact } from "@/cloud/academic-data";
import { withCloudAcademicSource } from "@/utils/cloud-academic";
import { Link } from "react-router-dom";

type Commit = CommitListResponse["commits"][number];
type Task =
  | { kind: "refresh" }
  | { kind: "push"; force: boolean }
  | { kind: "pull"; sha?: string };
type Notice = { message: string; action?: { label: string; run: () => void } };

export const RemoteDocuments = () => {
  const { user } = useUser();
  const online = useOnline();
  if (!user) return <LoginGate />;
  return (
    <RemoteDocumentsContent key={`${user.id}:${online}`} online={online} />
  );
};

const RemoteDocumentsContent = ({ online }: { online: boolean }) => {
  const alive = useRef(true);
  const operation = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [session, setSession] = useState<CloudSession>();
  const [bindings, setBindings] = useState<Record<string, CloudBinding | null>>(
    {},
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [localDocs, setLocalDocs] = useState<HighTexDocument[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [task, setTask] = useState<Task | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showTech, setShowTech] = useState(false);
  // Sidebar riwayat: terbuka di layar lebar, tertutup (jadi drawer) di layar sempit.
  const [historyOpen, setHistoryOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1280px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const resize = () => {
      if (!media.matches) setHistoryOpen(false);
    };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);

  const busy = task !== null;
  const pullingSha = task?.kind === "pull" ? (task.sha ?? "latest") : null;
  const showSkeleton = !loaded && online && task?.kind === "refresh";

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
  const linkedLocalId =
    localDocs.find(
      (doc) =>
        bindings[doc.id]?.serverDocumentId === current?.document_id &&
        doc.id === selectedId,
    )?.id ??
    localDocs.find(
      (doc) => bindings[doc.id]?.serverDocumentId === current?.document_id,
    )?.id;
  const linkedDoc = localDocs.find((doc) => doc.id === linkedLocalId);
  const isLinked = Boolean(
    selectedDoc &&
    bindings[selectedDoc.id]?.serverDocumentId === current?.document_id &&
    current,
  );
  const kp = Boolean(
    selectedDoc &&
    (selectedDoc.config.intern ||
      categories.find(
        (category) => String(category.id) === selectedDoc.category,
      )?.variant === "intern"),
  );
  const cloudAhead = Boolean(
    isLinked && bindings[selectedId]?.baseSha256 !== current?.sha256,
  );

  const assertCurrent = async (context: CloudSession) => {
    if (
      !alive.current ||
      (await window.hightex.cloud.context()).sessionId !== context.sessionId
    )
      throw new Error("cloud_error:session_changed");
  };

  const load = useCallback(async () => {
    if (!online) return;
    const context = await window.hightex.cloud.context();
    const [response, docs, available] = await Promise.all([
      window.hightex.cloud.list(context.sessionId),
      HighTexDB.getInstance().documents.toArray(),
      window.hightex.categories(),
    ]);
    const mapped = Object.fromEntries(
      await Promise.all(
        docs.map(async (doc) => [
          doc.id,
          await window.hightex.cloud.binding(context.sessionId, doc.id),
        ]),
      ),
    );
    if (
      !alive.current ||
      (await window.hightex.cloud.context()).sessionId !== context.sessionId
    )
      return;
    setSession(context);
    setCommits(response.commits);
    setLocalDocs(docs);
    setBindings(mapped);
    setCategories(available);
    setSelectedId((previous) =>
      docs.some((doc) => doc.id === previous)
        ? previous
        : (docs.find(
            (doc) =>
              mapped[doc.id]?.serverDocumentId ===
              response.commits.find((item) => item.type === "current")
                ?.document_id,
          )?.id ??
          docs[0]?.id ??
          ""),
    );
  }, [online]);

  const refresh = useCallback(async () => {
    if (!online || operation.current) return;
    operation.current = true;
    setTask({ kind: "refresh" });
    setLoaded(false);
    setNotice(null);
    try {
      await load();
      if (alive.current) setLoaded(true);
    } catch (cause) {
      if (alive.current) setNotice({ message: errorMessage(cause) });
    } finally {
      operation.current = false;
      if (alive.current) {
        setTask(null);
      }
    }
  }, [load, online]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pull = async (sha256?: string, restore = false, asCopy = false) => {
    if (!session || !current || operation.current || !online) return;
    if (restore && !selectedDoc) return;
    operation.current = true;
    setTask({ kind: "pull", sha: sha256 });
    setNotice(null);
    const db = HighTexDB.getInstance();
    let installed = false;
    let accepted = false;
    let before: Awaited<ReturnType<typeof captureDraft>> | undefined;
    let prepared: Awaited<ReturnType<typeof prepareCloudDraft>> | undefined;
    try {
      const result = await window.hightex.cloud.pull({
        sessionId: session.sessionId,
        serverDocumentId: current.document_id,
        sha256,
      });
      await assertCurrent(session);
      if (result.status !== "downloaded") {
        toast.info("Versi cloud belum tersedia atau sudah tidak tersimpan.");
        return;
      }
      const id = restore
        ? selectedDoc!.id
        : !sha256 && !asCopy && linkedDoc
          ? linkedDoc.id
          : crypto.randomUUID();
      prepared = await prepareCloudDraft(result.file, id, categories);
      before = await captureDraft(db, id);
      if (await window.editor.has(id))
        throw new Error("cloud_error:editor_open");
      if (before.document) {
        if (
          !(await confirm({
            title: `Ganti salinan lokal “${before.document.title}”?`,
            desc: restore
              ? "Isi akan diganti dengan versi riwayat. Salinan saat ini dibackup terlebih dahulu. Versi dasar sinkronisasi tetap dipertahankan."
              : "Paket cloud menggantikan isi lokal. Salinan saat ini dibackup terlebih dahulu.",
          }))
        )
          return;
        await assertCurrent(session);
        const backup = await new Exporter(id).exportForPush();
        if (
          (await draftRevision(await captureDraft(db, id))) !==
          (await draftRevision(before))
        )
          throw new Error("cloud_error:local_changed");
        await window.hightex.cloud.backup(session.sessionId, backup.file);
      }
      if (sha256 && !restore)
        prepared.state.document.title += " (Salinan riwayat)";
      if (asCopy) prepared.state.document.title += " (Salinan cloud)";
      if (!sha256 && !asCopy) {
        const academic = await window.hightex.cloud.academic.load({
          sessionId: session.sessionId,
          serverDocumentId: current.document_id,
        });
        const source = before.document?.cloudAcademic;
        if (
          source &&
          (source.accountId !== session.accountId ||
            source.serverUrl !== session.serverUrl ||
            source.serverDocumentId !== current.document_id)
        )
          throw new Error("cloud_error:academic_scope");
        prepared.state.document = withCloudAcademicSource(
          prepared.state.document,
          academic,
        );
      }
      await assertCurrent(session);
      if (await window.editor.has(id))
        throw new Error("cloud_error:editor_open");
      await installCloudDraft(db, prepared, before);
      installed = true;
      await assertCurrent(session);
      if (!sha256 && !asCopy)
        await window.hightex.cloud.accept({
          sessionId: session.sessionId,
          downloadId: result.downloadId,
          localDocumentId: id,
        });
      accepted = true;
      if (!alive.current) return;
      toast.success(
        `“${prepared.state.document.title}” berhasil disimpan sebagai dokumen lokal.`,
      );
      await load();
    } catch (cause) {
      if (installed && !accepted && prepared && before) {
        try {
          await rollbackCloudDraft(db, prepared, before);
        } catch {
          if (alive.current)
            setNotice({
              message:
                "Penerimaan cloud gagal. Ada perubahan lokal baru sehingga rollback otomatis dihentikan; backup sebelumnya tetap tersedia di folder cloud-backups aplikasi.",
            });
          return;
        }
      }
      if (alive.current) setNotice({ message: errorMessage(cause) });
    } finally {
      operation.current = false;
      if (alive.current) setTask(null);
    }
  };

  const push = async (force = false) => {
    if (!session || !selectedDoc || operation.current || !online || !loaded)
      return;
    operation.current = true;
    setTask({ kind: "push", force });
    setNotice(null);
    try {
      if (kp) throw new Error("cloud_error:kp_unsupported");
      if (await window.editor.has(selectedDoc.id))
        throw new Error("cloud_error:editor_open");
      const replace = Boolean(current && !isLinked);
      if (force && !current) return;
      if (
        (force || replace) &&
        !(await confirm({
          title: force
            ? "Timpa versi cloud dengan dokumen lokal ini?"
            : "Ganti dokumen pada slot cloud akun ini?",
          desc: force
            ? `Force push akan menggantikan seluruh isi cloud dengan “${selectedDoc.title || "Tanpa judul"}”, termasuk perubahan dari perangkat lain. Versi cloud saat ini dibackup ke perangkat ini sebelum dikirim. Riwayat server menyimpan maksimal empat versi sebelumnya.`
            : "Server menyediakan satu slot dokumen untuk akun ini. Versi cloud saat ini dibackup sebelum diganti dengan dokumen yang dipilih. Draft lokal lainnya tetap tersimpan.",
        }))
      )
        return;
      await assertCurrent(session);
      const artifact = await exportCloudArtifact(
        selectedDoc.id,
        session,
        current?.document_id ?? null,
      );
      await assertCurrent(session);
      const response = await window.hightex.cloud.push({
        sessionId: session.sessionId,
        file: artifact.file,
        document: { ...artifact.document, profile: undefined },
        message: commitMessage.trim(),
        expectedServerDocumentId: current?.document_id ?? null,
        expectedCloudSha256: current?.sha256 ?? null,
        replace,
        force,
      });
      await assertCurrent(session);
      if (response.status === "conflict") {
        setNotice({
          message:
            "Versi cloud berubah sejak versi dasar draft ini. Perubahan lokal tetap tersimpan. Unduh cloud sebagai salinan untuk dibandingkan.",
          action: {
            label: "Unduh salinan cloud",
            run: () => void pull(undefined, false, true),
          },
        });
        return;
      }
      await HighTexDB.getInstance().cacheCloudAcademic(selectedDoc.id, {
        ...artifact.academic,
        serverDocumentId: response.serverDocumentId,
      });
      toast.success(
        response.changed
          ? "Perubahan tersimpan di cloud."
          : "Dokumen cloud sudah memuat versi ini.",
      );
      setCommitMessage("");
      await load();
    } catch (cause) {
      if (alive.current) setNotice({ message: errorMessage(cause) });
    } finally {
      operation.current = false;
      if (alive.current) setTask(null);
    }
  };

  const pushHint = !online
    ? "Butuh koneksi internet untuk menyimpan."
    : busy
      ? "Tunggu proses yang sedang berjalan selesai."
      : !loaded || !session
        ? "Muat ulang status cloud sebelum menyimpan."
        : !selectedDoc
          ? "Buat atau pilih dokumen lokal terlebih dahulu."
          : kp
            ? "KP tersedia secara lokal; sinkronisasi KP menunggu dukungan server."
            : "";

  const historyList = (
    <HistoryList
      archives={archives}
      online={online}
      busy={busy}
      pullingSha={pullingSha}
      onPull={(sha) => void pull(sha)}
      onRestore={(sha) => void pull(sha, true)}
      canRestore={Boolean(selectedDoc)}
    />
  );

  return (
    <main className="flex items-stretch gap-6 pb-10">
      <div className="mx-auto w-full min-w-0 max-w-3xl flex-1 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Dokumen cloud</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kelola salinan lokal, cadangkan ke cloud, lalu ajukan untuk
              review.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="xl:hidden"
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

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [
              "1. Pilih dokumen",
              "Dokumen lokal tetap tersimpan di perangkat ini.",
            ],
            [
              "2. Simpan versi",
              "Satu dokumen cloud dan empat versi sebelumnya.",
            ],
            ["3. Ajukan review", "Kirim versi tersimpan kepada pembimbing."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-xl border bg-background p-4">
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>

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
                    {online && loaded
                      ? "Belum ada versi di cloud. Simpan dokumenmu di bawah untuk memulai."
                      : "Status cloud belum tersedia. Hubungkan internet lalu muat ulang."}
                  </p>
                )}
              </div>
            </div>

            {current?.sha256 && loaded && (
              <div className="flex flex-wrap gap-2">
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
                  {linkedDoc ? "Perbarui salinan lokal" : "Unduh dokumen"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void pull(undefined, false, true)}
                  disabled={!online || busy}
                >
                  Unduh sebagai salinan
                </Button>
              </div>
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
                  className={`size-3.5 transition-transform ${
                    showTech ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showTech && (
                <dl className="mt-3 space-y-3 rounded-xl bg-white px-4 py-3 dark:bg-neutral-950">
                  <TechRow label="Server ID" value={current.document_id} />
                  <TechRow label="Local ID" value={linkedLocalId} />
                  <TechRow label="SHA-256" value={current.sha256} />
                  <TechRow
                    label="Base SHA-256 draft terpilih"
                    value={bindings[selectedId]?.baseSha256}
                  />
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
              {selectedDoc && loaded && (
                <div
                  role="status"
                  className={`rounded-xl border p-3 text-sm ${cloudAhead ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" : "bg-background"}`}
                >
                  <p className="font-medium">
                    {kp
                      ? "Dokumen KP — tersedia secara lokal"
                      : cloudAhead
                        ? "Versi cloud sudah berubah"
                        : isLinked
                          ? "Dokumen tertaut ke cloud"
                          : current
                            ? "Dokumen ini akan menggantikan slot cloud"
                            : "Siap untuk pencadangan pertama"}
                  </p>
                  <p className="mt-1 text-xs leading-5">
                    {cloudAhead
                      ? "Unduh sebagai salinan untuk membandingkan perubahan, atau gunakan Force push jika isi lokal yang ingin dipertahankan."
                      : isLinked
                        ? "Simpan versi untuk mengirim perubahan lokal terbaru sebelum mengajukan review."
                        : "Periksa dokumen yang dipilih sebelum menyimpan. Server menyediakan satu slot per akun."}
                  </p>
                </div>
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
                  {[...commitMessage].length}/255
                </span>
              </label>
              <Textarea
                id="cloud-commit-message"
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                maxLength={255}
                rows={2}
                placeholder="Contoh: Merapikan bab metodologi"
                disabled={busy}
                className="min-h-16 resize-y bg-white dark:bg-neutral-950"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p
                id="cloud-push-readiness"
                role="status"
                className="text-xs text-muted-foreground"
              >
                {pushHint}
              </p>
              <Button
                onClick={() => void push()}
                disabled={
                  !online || busy || !selectedDoc || kp || !loaded || !session
                }
                className="ml-auto w-full sm:w-auto"
                aria-describedby="cloud-push-readiness"
                title={pushHint || "Simpan perubahan lokal ke cloud"}
              >
                {task?.kind === "push" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <UploadCloud className="size-4" />
                )}
                {task?.kind === "push" ? "Menyimpan…" : "Simpan versi"}
              </Button>
            </div>
            {current && (
              <details className="rounded-xl border border-amber-200 p-4 dark:border-amber-900">
                <summary className="cursor-pointer text-sm font-medium">
                  Timpa versi cloud (Force push)
                </summary>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Gunakan jika versi lokal harus menggantikan cloud meskipun
                  terjadi konflik. Seluruh isi cloud diganti; versi cloud
                  diunduh dan dibackup terlebih dahulu.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-3"
                  disabled={Boolean(pushHint)}
                  aria-describedby="cloud-push-readiness"
                  onClick={() => void push(true)}
                >
                  {task?.kind === "push" && task.force ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <UploadCloud className="size-4" />
                  )}
                  Force push dokumen lokal
                </Button>
              </details>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
              <p className="text-muted-foreground">
                Sudah siap menerima masukan pembimbing?
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/submissions">Buka pengajuan review</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>

      <aside
        aria-label="Riwayat versi"
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
        <div className="xl:hidden">
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
  onRestore,
  canRestore,
}: {
  archives: Commit[];
  online: boolean;
  busy: boolean;
  pullingSha: string | null;
  onPull: (sha?: string) => void;
  onRestore: (sha: string) => void;
  canRestore: boolean;
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
            Salinan
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!online || busy || !canRestore || !commit.sha256}
            onClick={() => commit.sha256 && onRestore(commit.sha256)}
          >
            Pulihkan
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
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
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
  const message = error instanceof Error ? error.message : String(error);
  const code = /cloud_error:(\w+)/.exec(message)?.[1];
  const messages: Record<string, string> = {
    not_authenticated:
      "Sesi login sudah tidak tersedia. Silakan login kembali.",
    session_changed:
      "Akun, server, atau sesi berubah. Muat ulang sebelum melanjutkan.",
    invalid_request:
      "Data pengiriman tidak valid. Catatan maksimal 255 karakter dan ukuran paket maksimal 64 MiB.",
    invalid_response:
      "Respons cloud tidak lengkap atau tidak sesuai kontrak. Draft dan versi dasarnya tetap dipertahankan.",
    invalid_download:
      "Unduhan sudah kedaluwarsa. Unduh kembali sebelum menerapkan ke draft.",
    integrity_failed:
      "Hash paket cloud tidak cocok dengan byte file. Paket belum diterapkan. File dari client lama mungkin memakai kontrak hash lama; periksa atau pulihkan paket melalui web terlebih dahulu.",
    cloud_changed:
      "Dokumen cloud berubah saat operasi berjalan. Muat ulang untuk memeriksa hasil server sebelum mencoba lagi.",
    replacement_required:
      "Dokumen belum tertaut atau slot cloud berubah. Muat ulang dan tinjau penggantian dokumen cloud.",
    editor_open:
      "Tutup jendela editor dokumen ini terlebih dahulu agar tidak ada penulisan bersamaan saat transfer cloud.",
    local_changed:
      "Dokumen lokal berubah selama proses. Operasi dihentikan; tinjau perubahan lalu coba lagi.",
    kp_unsupported:
      "Sinkronisasi KP belum didukung server. Dokumen KP tetap dapat dipakai secara lokal.",
    unknown_category:
      "Kategori dokumen tidak dikenali. Perbarui kategori atau periksa paket sebelum melanjutkan.",
    external_asset:
      "Paket mengandalkan gambar eksternal. Lengkapi aset dalam paket sebelum mengimpor.",
    invalid_archive: "Isi paket cloud tidak valid. Draft belum diganti.",
    unsupported_content:
      "Paket memuat format konten yang belum didukung editor. Buka melalui viewer hanya baca untuk memeriksanya.",
    busy: "Transfer cloud lain masih berjalan. Tunggu sampai selesai.",
    academic_changed:
      "Data akademik server berubah atau belum diterapkan ke paket. Muat ulang data, lalu coba simpan kembali.",
    academic_invalid:
      "Data akademik dari server tidak sesuai kontrak. Periksa pembimbing, data sidang, serta data universitas.",
    academic_scope:
      "Dokumen terikat ke akun, server, atau dokumen cloud lain. Gunakan salinan lokal terpisah untuk akun ini.",
    http_401: "Sesi server sudah tidak berlaku. Silakan login kembali.",
    http_403: "Akun ini tidak memiliki akses untuk operasi tersebut.",
    http_422:
      "Server menolak paket atau metadata dokumen. Periksa kategori dan catatan pengiriman.",
  };
  return code
    ? (messages[code] ??
        "Transfer cloud gagal. Periksa koneksi dan status server, lalu muat ulang.")
    : message;
}
