import { preserveCloudAcademic } from "@/utils/cloud-academic";

interface DocumentDraft {
  document: HighTexDocument;
  commit(): Promise<void>;
}

/** Settings remain a draft until the user explicitly saves the panel or archive. */
export const documentDrafts = new Map<string, DocumentDraft>();

export function previewDocumentDraft(
  current: HighTexDocument,
  draft?: HighTexDocument,
): HighTexDocument {
  if (!draft || draft.id !== current.id) return current;
  return preserveCloudAcademic(current, {
    ...current,
    ...draft,
    profile: current.profile,
    authorProfileMode: "workspace",
  });
}
