import type { PaginationDiagnostic } from "@/types/pagination/diagnostic";
import { DocumentEngineError } from "@/exception/document-engine-error";
import { PaginationImageError } from "@/exception/pagination-image-error";
import { PaginationLayoutError } from "@/exception/pagination-layout-error";

export function paginationDiagnostic(error: unknown): PaginationDiagnostic {
  if (error instanceof DocumentEngineError)
    return {
      ...error.diagnostic,
      message: error.message,
      code: error.code,
      level: error.level,
    };
  const source =
    error instanceof PaginationImageError ||
    error instanceof PaginationLayoutError
      ? error.source
      : undefined;
  return {
    message: error instanceof Error ? error.message : String(error),
    level: "fatal",
    code: error instanceof PaginationImageError ? error.code : "unexpected",
    ...(source ? { source } : {}),
  };
}
