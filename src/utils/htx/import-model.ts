import { parseHighTexV2, HighTexImportError } from "@hightex/importer";
import { HighTexImportError as DesktopImportError } from "@/exception/hightex-import";
import { t } from "@/utils/lang";

export async function archiveSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

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
