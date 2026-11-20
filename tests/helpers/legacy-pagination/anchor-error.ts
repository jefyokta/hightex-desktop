/** Historical projector rejection; current export retains the first destination. */
export class PaginationAnchorError extends Error {
  readonly level = "fatal" as const;
  readonly code = "pagination.anchor.duplicate" as const;

  constructor(readonly target: string) {
    super(`Ambiguous source anchor: ${target}`);
    this.name = "PaginationAnchorError";
  }
}
