import type { Slice } from "@tiptap/pm/model";

export interface PaginationSourceRange {
  page: number;
  block: number;
  from: number;
  to: number;
  slice: Slice;
}

export interface PaginationPageFragment {
  page: number;
  ranges: PaginationSourceRange[];
  element: HTMLElement;
  content: HTMLElement;
}
