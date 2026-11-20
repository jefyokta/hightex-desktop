import { readDocumentSnapshot } from "./document-snapshot";
import { abortable } from "@/utils/abortable";
import { getWorkspaceAuthorProfile, resolveAuthorProfile } from "@/utils/document-profile";

/** Freeze stored content with the same workspace author shown by the editing application. */
export async function readDocumentRenderSnapshot(
  documentId: string,
  signal: AbortSignal,
) {
  const snapshot = await abortable(readDocumentSnapshot(documentId), signal);
  const profile = await abortable(getWorkspaceAuthorProfile(), signal);
  snapshot.document = {
    ...snapshot.document,
    profile: resolveAuthorProfile(snapshot.document, profile),
    authorProfileMode: "workspace",
  };
  return snapshot;
}
