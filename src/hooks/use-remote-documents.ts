import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CloudError } from "@/exception/cloud-error";
import { downloadCloudDocument, type CloudDownloadTarget } from "@/cloud/document-download";
import { uploadCloudDocument } from "@/cloud/document-upload";
import { readCloudDocuments, type CloudDocumentsSnapshot } from "@/cloud/documents";
import { confirm } from "@/utils/confirm";
import { t } from "@/utils/lang";

export type RemoteDocumentTask =
  | { kind: "refresh" }
  | { kind: "push"; force: boolean }
  | { kind: "pull"; sha?: string };

export interface RemoteDocumentNotice {
  message: string;
  action?: { label: string; run(): void };
}

/** Own the screen's request lifecycle; file installation belongs to the cloud domain. */
export function useRemoteDocuments(online: boolean) {
  const alive = useRef(true);
  const operation = useRef(false);
  const [snapshot, setSnapshot] = useState<CloudDocumentsSnapshot>();
  const [selectedId, setSelectedId] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [task, setTask] = useState<RemoteDocumentTask | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<RemoteDocumentNotice | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const isCurrent = useCallback(async (session: CloudSession) => {
    if (!alive.current) return false;
    return (await window.hightex.cloud.context()).sessionId === session.sessionId;
  }, []);

  const ensureCurrent = async (session: CloudSession) => {
    if (!await isCurrent(session)) throw new CloudError("session_changed");
  };

  const load = useCallback(async () => {
    const next = await readCloudDocuments();
    if (!await isCurrent(next.session)) return;
    setSnapshot(next);
    setSelectedId(previous => {
      if (next.documents.some(document => document.id === previous)) return previous;
      const current = next.commits.find(commit => commit.type === "current");
      const linked = next.documents.find(document =>
        next.bindings[document.id]?.serverDocumentId === current?.document_id,
      );
      return linked?.id ?? next.documents[0]?.id ?? "";
    });
  }, [isCurrent]);

  const run = useCallback(async (task: RemoteDocumentTask, action: () => Promise<void>) => {
    if (!online || operation.current) return;
    operation.current = true;
    setTask(task);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      if (alive.current) setNotice({ message: CloudError.from(cause).description });
    } finally {
      operation.current = false;
      if (alive.current) setTask(null);
    }
  }, [online]);

  const refresh = useCallback(() => run({ kind: "refresh" }, async () => {
    setLoaded(false);
    await load();
    if (alive.current) setLoaded(true);
  }), [load, run]);

  useEffect(() => { void refresh(); }, [refresh]);

  const documents = snapshot?.documents ?? [];
  const current = snapshot?.commits.find(commit => commit.type === "current");
  const archives = snapshot?.commits.filter(commit => commit.type !== "current" && commit.sha256) ?? [];
  const selectedDocument = documents.find(document => document.id === selectedId);
  const selectedBinding = snapshot?.bindings[selectedId];
  const isLinked = Boolean(current && selectedBinding?.serverDocumentId === current.document_id);
  const linkedDocument = (isLinked ? selectedDocument : undefined) ?? documents.find(document =>
    current && snapshot?.bindings[document.id]?.serverDocumentId === current.document_id,
  );
  const isIntern = Boolean(selectedDocument && (
    selectedDocument.config.intern ||
    snapshot?.categories.find(category => String(category.id) === selectedDocument.category)?.variant === "intern"
  ));
  const cloudAhead = Boolean(isLinked && selectedBinding?.baseSha256 !== current?.sha256);
  const busy = task !== null;

  const download = async (target: CloudDownloadTarget = { kind: "latest" }) => {
    if (!snapshot || !current || (target.kind === "restore" && !selectedDocument)) return;
    const localDocumentId = target.kind === "restore"
      ? selectedId
      : target.kind === "latest" && linkedDocument
        ? linkedDocument.id
        : crypto.randomUUID();

    await run({ kind: "pull", sha: "sha256" in target ? target.sha256 : undefined }, async () => {
      const result = await downloadCloudDocument({
        session: snapshot.session,
        serverDocumentId: current.document_id,
        localDocumentId,
        categories: snapshot.categories,
        target,
      }, {
        ensureCurrent: () => ensureCurrent(snapshot.session),
        confirmReplacement: document => confirm({
          title: `Ganti salinan lokal “${document.title}”?`,
          desc: target.kind === "restore"
            ? "Isi akan diganti dengan versi riwayat. Salinan saat ini dibackup terlebih dahulu. Versi dasar sinkronisasi tetap dipertahankan."
            : "Paket cloud menggantikan isi lokal. Salinan saat ini dibackup terlebih dahulu.",
        }),
      });
      if (!alive.current) return;
      switch (result.status) {
        case "cancelled":
          return;
        case "unavailable":
          toast.info(t("remote.cloud_version_unavailable"));
          return;
        case "rollback-failed":
          setNotice({
            message: "Penerimaan cloud gagal. Ada perubahan lokal baru sehingga rollback otomatis dihentikan; backup sebelumnya tetap tersedia di folder cloud-backups aplikasi.",
          });
          return;
        case "saved":
          toast.success(`“${result.document.title}” berhasil disimpan sebagai dokumen lokal.`);
          await load();
      }
    });
  };

  const push = async (force = false) => {
    if (!snapshot || !selectedDocument || !loaded) return;
    await run({ kind: "push", force }, async () => {
      if (isIntern) throw new CloudError("kp_unsupported");
      if (await window.editor.has(selectedId)) throw new CloudError("editor_open");
      const replace = Boolean(current && !isLinked);
      if (force && !current) return;
      if ((force || replace) && !await confirm({
        title: force
          ? "Timpa versi cloud dengan dokumen lokal ini?"
          : "Ganti dokumen pada slot cloud akun ini?",
        desc: force
          ? `Force push akan menggantikan seluruh isi cloud dengan “${selectedDocument.title || "Tanpa judul"}”, termasuk perubahan dari perangkat lain. Versi cloud saat ini dibackup ke perangkat ini sebelum dikirim. Riwayat server menyimpan maksimal empat versi sebelumnya.`
          : "Server menyediakan satu slot dokumen untuk akun ini. Versi cloud saat ini dibackup sebelum diganti dengan dokumen yang dipilih. Draft lokal lainnya tetap tersimpan.",
      })) return;

      const response = await uploadCloudDocument({
        session: snapshot.session, documentId: selectedId, current,
        message: commitMessage, replace, force,
      }, () => ensureCurrent(snapshot.session));
      if (response.status === "conflict") {
        setNotice({
          message: "Versi cloud berubah sejak versi dasar draft ini. Perubahan lokal tetap tersimpan. Unduh cloud sebagai salinan untuk dibandingkan.",
          action: {
            label: "Unduh salinan cloud",
            run: () => void download({ kind: "copy" }),
          },
        });
        return;
      }
      toast.success(response.changed
        ? "Perubahan tersimpan di cloud."
        : "Dokumen cloud sudah memuat versi ini.");
      setCommitMessage("");
      await load();
    });
  };

  function pushHint() {
    if (!online) return "Butuh koneksi internet untuk menyimpan.";
    if (busy) return "Tunggu proses yang sedang berjalan selesai.";
    if (!loaded || !snapshot) return "Muat ulang status cloud sebelum menyimpan.";
    if (!selectedDocument) return "Buat atau pilih dokumen lokal terlebih dahulu.";
    if (isIntern) return "KP tersedia secara lokal; sinkronisasi KP menunggu dukungan server.";
    return "";
  }

  return {
    documents, selectedId, selectedDocument, selectedBinding, linkedDocument,
    current, archives, isLinked, isIntern, cloudAhead,
    commitMessage, setCommitMessage, setSelectedId,
    task, busy, loaded, notice, dismissNotice: () => setNotice(null),
    pushHint: pushHint(),
    refresh, download, push,
  };
}
