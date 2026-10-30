import { confirmWithAlternative } from "./confirm";
import type { HighTexImporter, ImportMode } from "./import-v2";
import { t } from "./lang";

export async function resolveImportMode(
  importer: Pick<HighTexImporter, "exists" | "model">,
): Promise<ImportMode | null> {
  if (!importer.exists) return "overwrite";

  const result = await confirmWithAlternative({
    title: t("open_file.conflict_title"),
    desc: t("open_file.conflict_description", {
      title: importer.model.document.title,
    }),
    confirmText: t("open_file.overwrite"),
    alternativeText: t("open_file.create_copy"),
    cancelText: t("common.cancel"),
  });
  return result === "alternative" ? "copy" : result ? "overwrite" : null;
}
