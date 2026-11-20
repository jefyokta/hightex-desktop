import type {
  EngineDiagnostic,
  EngineIssueLevel,
  EngineIssueCode,
} from "@/types/document-engine";
import { PaginationImageError } from "./pagination-image-error";
import { ChapterContentError } from "./chapter-content-error";
import { PaginationLayoutError } from "./pagination-layout-error";

export class DocumentEngineError extends Error {
  readonly diagnostic: Readonly<EngineDiagnostic>;
  readonly level: EngineIssueLevel;
  readonly code: EngineIssueCode;
  readonly target?: string;
  constructor(
    diagnostic: EngineDiagnostic,
    cause: unknown,
    issue: {
      level: EngineIssueLevel;
      code: EngineIssueCode;
      target?: string;
    } = cause instanceof PaginationImageError ||
    cause instanceof ChapterContentError
      ? cause
      : { level: "fatal", code: "unexpected" },
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(
      `${diagnostic.sectionId ? `Document section ${diagnostic.sectionId}${diagnostic.sectionTitle ? ` (${diagnostic.sectionTitle})` : ""}` : "Document layout"} [${diagnostic.stage}]: ${detail}`,
      { cause },
    );
    this.name = "DocumentEngineError";
    this.diagnostic = Object.freeze({
      ...diagnostic,
      ...((cause instanceof PaginationImageError ||
        cause instanceof ChapterContentError ||
        cause instanceof PaginationLayoutError) &&
      cause.source
        ? { source: cause.source }
        : {}),
    });
    this.level = issue.level;
    this.code = issue.code;
    this.target = issue.target;
  }
}
