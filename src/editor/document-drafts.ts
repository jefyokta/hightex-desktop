import { preserveCloudAcademic } from "@/utils/cloud-academic";
import { emptyAuthorProfile, getAuthorDetails } from "@/utils/document-profile";

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
    profile: draft.profile
      ? {
          ...emptyAuthorProfile(),
          ...current.profile,
          ...getAuthorDetails(draft.profile),
        }
      : current.profile,
  });
}
