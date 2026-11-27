import { useIPC } from "@/hooks/use-ipc";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { exportCloudArtifact } from "./academic-data";
import type { CloudCommit } from "./documents";

export interface CloudUploadRequest {
  session: CloudSession;
  documentId: string;
  current?: CloudCommit;
  message: string;
  replace: boolean;
  force: boolean;
}

/** Export the academic artifact and cache its source only after the server accepts it. */
export async function uploadCloudDocument(
  request: CloudUploadRequest,
  ensureCurrent: () => Promise<void>,
) {
  const { session, documentId, current } = request;
  await ensureCurrent();
  const artifact = await exportCloudArtifact(documentId, session, current?.document_id ?? null);
  await ensureCurrent();
  const result = await useIPC("hightex").hightex.cloud.push({
    sessionId: session.sessionId,
    file: artifact.file,
    document: { ...artifact.document, profile: undefined },
    message: request.message.trim(),
    expectedServerDocumentId: current?.document_id ?? null,
    expectedCloudSha256: current?.sha256 ?? null,
    replace: request.replace,
    force: request.force,
  });
  await ensureCurrent();
  if (result.status === "saved") {
    await HighTexDB.getInstance().cacheCloudAcademic(documentId, {
      ...artifact.academic,
      serverDocumentId: result.serverDocumentId,
    });
  }
  return result;
}
