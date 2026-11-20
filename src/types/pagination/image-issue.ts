export interface PaginationImageRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type PaginationImageIssue =
  | {
      code: "pagination.image.unavailable" | "pagination.image.changed";
      image: number;
    }
  | {
      code: "pagination.image.outside-page";
      image: number;
      page: number;
      reason: "unmeasurable" | "size" | "position";
      bounds: PaginationImageRect;
      content: PaginationImageRect;
      overflow: { left: number; right: number; top: number; bottom: number };
    };
