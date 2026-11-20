import type { SectionGroup } from "@/types/pagination/section-options";

/** The mounted editable chapter root already declares its authoring class. */
export function paginationSection(root: Element | null): SectionGroup {
  return root?.classList.contains("static-chapter")
    ? "introduction"
    : root?.classList.contains("attachment-chapter")
      ? "appendix"
      : "content";
}
