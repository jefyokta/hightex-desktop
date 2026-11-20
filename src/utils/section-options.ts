import type {
  SectionOptions,
  SectionGroup,
} from "@/types/pagination/section-options";

/** Merge partial section policies without changing either caller's objects. */
export function mergeSectionOptions(
  previous: SectionOptions = {},
  patch: SectionOptions = {},
): SectionOptions {
  return {
    ...previous,
    ...patch,
    margins: { ...previous.margins, ...patch.margins },
    pageNumber: { ...previous.pageNumber, ...patch.pageNumber },
  };
}

/** Logical document groups are independent of authored chapter/storage IDs. */
export function sectionGroup(section: {
  id: string;
  numbering: "none" | "roman" | "arabic" | "appendix";
  group?: SectionGroup;
}): SectionGroup {
  return (
    section.group ??
    (section.numbering === "roman" || section.id === "cover"
      ? "introduction"
      : section.numbering === "appendix"
        ? "appendix"
        : "content")
  );
}

export function mergeSectionGroups(
  previous: Partial<Record<SectionGroup, SectionOptions>> = {},
  patch: Partial<Record<SectionGroup, SectionOptions>> = {},
): Partial<Record<SectionGroup, SectionOptions>> {
  const result = structuredClone(previous);
  for (const group of ["introduction", "content", "appendix"] as const)
    if (patch[group])
      result[group] = mergeSectionOptions(result[group], patch[group]);
  return result;
}
