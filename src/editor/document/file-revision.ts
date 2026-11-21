import type { DocumentRenderModel } from "@/types/document-snapshot";
import { archiveSha256, readImportModel } from "@/utils/htx/import-model";
import { contentFingerprint } from "@/utils/htx/content-fingerprint";

/** Compare authored file content independently of ZIP metadata and workspace identity. */
export async function documentFileRevision(input: Uint8Array | DocumentRenderModel) {
  const model = input instanceof Uint8Array ? readImportModel(input) : input;
  const { title, altTitle, category, keywords } = model.document;
  const content = [title, altTitle, category, keywords, await contentFingerprint(model)];
  return archiveSha256(new TextEncoder().encode(JSON.stringify(content)));
}
