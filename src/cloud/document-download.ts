import { HighTexDB } from "@/editor/storage/hightex-db";
import { CloudError } from "@/exception/cloud-error";
import { Exporter } from "@/utils/htx/exporter";
import { withCloudAcademicSource } from "@/utils/cloud-academic";
import {
  captureDraft,
  draftRevision,
  installCloudDraft,
  prepareCloudDraft,
  rollbackCloudDraft,
  type DraftState,
} from "./draft-transfer";

export type CloudDownloadTarget =
  | { kind: "latest" }
  | { kind: "copy" }
  | { kind: "history"; sha256: string }
  | { kind: "restore"; sha256: string };

export interface CloudDownloadRequest {
  session: CloudSession;
  serverDocumentId: string;
  localDocumentId: string;
  categories: Category[];
  target: CloudDownloadTarget;
}

export interface CloudDownloadInteraction {
  ensureCurrent(): Promise<void>;
  confirmReplacement(document: HighTexDocument): Promise<boolean>;
}

export type CloudDownloadResult =
  | { status: "saved"; document: HighTexDocument }
  | { status: "unavailable" | "cancelled" }
  | { status: "rollback-failed"; cause: unknown; rollbackCause: unknown };

async function backupLocalDraft(
  request: CloudDownloadRequest,
  before: DraftState,
  interaction: CloudDownloadInteraction,
) {
  const { session, localDocumentId } = request;
  await interaction.ensureCurrent();
  const backup = await new Exporter(localDocumentId).exportForPush();
  const current = await captureDraft(HighTexDB.getInstance(), localDocumentId);
  if (await draftRevision(current) !== await draftRevision(before)) {
    throw new CloudError("local_changed");
  }
  await window.hightex.cloud.backup(session.sessionId, backup.file);
}

async function attachAcademicSource(
  request: CloudDownloadRequest,
  document: HighTexDocument,
  before: DraftState,
) {
  const { session, serverDocumentId } = request;
  const academic = await window.hightex.cloud.academic.load({
    sessionId: session.sessionId,
    serverDocumentId,
  });
  const source = before.document?.cloudAcademic;
  if (source && (
    source.accountId !== session.accountId ||
    source.serverUrl !== session.serverUrl ||
    source.serverDocumentId !== serverDocumentId
  )) {
    throw new CloudError("academic_scope");
  }
  return withCloudAcademicSource(document, academic);
}

/** Install first, accept the sync base second; a failed acceptance restores the prior draft. */
export async function downloadCloudDocument(
  request: CloudDownloadRequest,
  interaction: CloudDownloadInteraction,
): Promise<CloudDownloadResult> {
  const { session, serverDocumentId, localDocumentId, categories, target } = request;
  const db = HighTexDB.getInstance();
  const result = await window.hightex.cloud.pull({
    sessionId: session.sessionId,
    serverDocumentId,
    sha256: "sha256" in target ? target.sha256 : undefined,
  });
  await interaction.ensureCurrent();
  if (result.status !== "downloaded") return { status: "unavailable" };

  const prepared = await prepareCloudDraft(result.file, localDocumentId, categories);
  const before = await captureDraft(db, localDocumentId);
  if (await window.editor.has(localDocumentId)) throw new CloudError("editor_open");
  if (before.document) {
    if (!await interaction.confirmReplacement(before.document)) return { status: "cancelled" };
    await backupLocalDraft(request, before, interaction);
  }

  if (target.kind === "history") prepared.state.document.title += " (Salinan riwayat)";
  if (target.kind === "copy") prepared.state.document.title += " (Salinan cloud)";
  if (target.kind === "latest") {
    prepared.state.document = await attachAcademicSource(request, prepared.state.document, before);
  }

  await interaction.ensureCurrent();
  if (await window.editor.has(localDocumentId)) throw new CloudError("editor_open");
  await installCloudDraft(db, prepared, before);
  try {
    await interaction.ensureCurrent();
    if (target.kind === "latest") {
      await window.hightex.cloud.accept({
        sessionId: session.sessionId,
        downloadId: result.downloadId,
        localDocumentId,
      });
    }
  } catch (cause) {
    try {
      await rollbackCloudDraft(db, prepared, before);
    } catch (rollbackCause) {
      return { status: "rollback-failed", cause, rollbackCause };
    }
    throw cause;
  }

  return { status: "saved", document: prepared.state.document };
}
