import type { ChapterRenderIssue } from "@/types/chapter-content";

/** A recoverable content/presentation warning with its original source. */
export class ChapterContentError extends Error {
  readonly level = "warning" as const;
  readonly code: "content.unresolved" | "pagination.table.repeat.compact";
  readonly details: readonly Readonly<ChapterRenderIssue>[];
  readonly source?: ChapterRenderIssue["source"];

  constructor(issues: readonly ChapterRenderIssue[]) {
    super(
      issues
        .map(
          (issue) =>
            issue.message ??
            `Unresolved document content (fallback applied): ${issue.kind} ${JSON.stringify(issue.key)}`,
        )
        .join("; "),
    );
    this.name = "ChapterContentError";
    this.code =
      issues.length && issues.every((issue) => issue.kind === "table")
        ? "pagination.table.repeat.compact"
        : "content.unresolved";
    this.source = issues[0]?.source;
    this.details = Object.freeze(
      issues.map((issue) => Object.freeze({ ...issue })),
    );
  }
}
