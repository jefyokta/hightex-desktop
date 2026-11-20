import { parseHighTexV2, HighTexImportError } from "@hightex/importer";
import { HighTexImportError as DesktopImportError } from "@/exception/hightex-import";
import { t } from "@/utils/lang";

export { sha256Bytes as archiveSha256 } from "../sha256";

export function readImportModel(bytes: Uint8Array) {
  try {
    return parseHighTexV2(bytes);
  } catch (error) {
    if (error instanceof HighTexImportError) {
      const message =
        error.code === "unsupported_version"
          ? t("error.htx.unsupported_version")
          : `${error.message}${error.path ? ` (${error.path})` : ""}`;
      throw new DesktopImportError(message);
    }
    throw error;
  }
}
