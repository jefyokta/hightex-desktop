import { parseHighTexV2, HighTexImportError } from "@hightex/importer";
import { prepareDraftImport } from "@/utils/htx/draft-transfer";
import { supportedNodes, supportedMarks } from "@/utils/htx/content-policy";
import { archiveSha256 } from "@/utils/htx/import-model";
export {
  captureDraft,
  draftRevision,
  installDraft as installCloudDraft,
  rollbackDraft as rollbackCloudDraft,
} from "@/utils/htx/draft-transfer";
export type { DraftState, PreparedDraft } from "@/utils/htx/draft-transfer";

/** Parse through the shared v2 library; cloud state/persistence remains in the app. */
export async function prepareCloudDraft(
  file: Uint8Array,
  id: string,
  categories: Category[],
) {
  let model;
  try {
    model = parseHighTexV2(file, {
      allowedNodes: [...supportedNodes],
      allowedMarks: [...supportedMarks],
    });
  } catch (error) {
    if (error instanceof HighTexImportError) {
      const code =
        error.code === "unsupported_version" ||
        error.code === "unsupported_format"
          ? "unsupported_content"
          : "invalid_archive";
      throw new Error(`cloud_error:${code}`, { cause: error });
    }
    throw error;
  }
  if (!model.chapters.length) throw new Error("cloud_error:invalid_archive");
  const hash = await archiveSha256(file);
  return prepareDraftImport(
    model,
    id,
    categories,
    `cloud_${id}_${hash.slice(0, 16)}_`,
  );
}
