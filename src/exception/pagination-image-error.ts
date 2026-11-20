import type { PaginationImageIssue } from "@/types/pagination/image-issue";
import type { SectionSourceLocator } from "../../shared/section-layout";

export class PaginationImageError extends Error {
  readonly level = "fatal" as const;
  readonly code: PaginationImageIssue["code"];
  readonly details: Readonly<PaginationImageIssue>;

  readonly source?: Readonly<SectionSourceLocator>;

  constructor(issue: PaginationImageIssue, source?: SectionSourceLocator) {
    const where = source
      ? `; chapter ${source.chapterId}, node ${source.nodeId ?? "anonymous"}, PM ${source.from}..${source.to}${source.assetId ? `, asset ${source.assetId}` : ""}`
      : "";
    const overflow =
      issue.code === "pagination.image.outside-page"
        ? Object.entries(issue.overflow)
            .filter(([, value]) => value > 0)
            .map(([side, value]) => `${side} ${value.toFixed(2)}px`)
            .join(", ")
        : "";
    super(
      (issue.code === "pagination.image.outside-page"
        ? "Source image is outside its recorded page"
        : issue.code === "pagination.image.changed"
          ? "Page image changed after pagination"
          : "Page image is not ready") +
        ` (image ${issue.image}${issue.code === "pagination.image.outside-page" ? `, page ${issue.page}, reason ${issue.reason}${overflow ? `, overflow ${overflow}` : ""}` : ""}${where})`,
    );
    this.name = "PaginationImageError";
    this.code = issue.code;
    this.details = Object.freeze(structuredClone(issue));
    this.source = source && Object.freeze({ ...source });
  }
}
