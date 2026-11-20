import type { SectionSourceLocator } from "../../shared/section-layout";

/** Preserve the existing failure and the source range being laid out. */
export class PaginationLayoutError extends Error {
  constructor(
    cause: unknown,
    readonly range: { from: number; to: number },
    readonly source?: SectionSourceLocator,
  ) {
    super(
      `${cause instanceof Error ? cause.message : String(cause)}${
        source
          ? `; chapter ${source.chapterId}, node ${source.nodeId ?? "anonymous"}, PM ${source.from}..${source.to}`
          : ""
      }`,
      { cause },
    );
    this.name = "PaginationLayoutError";
  }
}
