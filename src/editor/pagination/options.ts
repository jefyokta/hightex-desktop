import { mmToPx, pxToMm } from "@/utils/units";
import { pageNumberFormat } from "@/utils/page-number";
import {
  pageNumberOptions,
  pageNumberPosition,
  type PageNumberOptions,
} from "./presentation/page-number";
import type {
  PageMargins,
  SectionOptions,
  SectionGroup,
} from "@/types/pagination/section-options";
import {
  mergeSectionGroups,
  mergeSectionOptions,
} from "@/utils/section-options";

export interface PaginationOptions {
  margins?: Partial<PageMargins>;
  repeatTableHeader?: boolean;
  repeatTableCaption?: boolean;
  pageNumbers?: PageNumberOptions;
  section?: SectionOptions;
  sections?: Partial<Record<SectionGroup, SectionOptions>>;
  documentNumbering?: boolean;
}

export interface PaginationGeometry {
  width: number;
  height: number;
  gap: number;
  margins: { top: number; right: number; bottom: number; left: number };
  contentHeight: number;
  contentWidth: number;
  stride: number;
  repeatTableHeader: boolean;
  repeatTableCaption: boolean;
  pageNumbers: ReturnType<typeof pageNumberOptions>;
  pageNumber?: NonNullable<SectionOptions["pageNumber"]>["position"];
  pageNumberFormat?: NonNullable<SectionOptions["pageNumber"]>["format"];
}
export function paginationGeometry(
  options: PaginationOptions = {},
  group: SectionGroup = "content",
): PaginationGeometry {
  const section = mergeSectionOptions(
    options.sections?.[group],
    options.section,
  );
  const margins = {
    top: 30,
    right: 30,
    bottom: 30,
    left: 30,
    ...options.margins,
    ...section.margins,
  };
  for (const value of Object.values(margins))
    if (!Number.isFinite(value) || value < 0)
      throw RangeError(
        "Pagination margins must be finite, nonnegative millimetres",
      );
  if (
    210 - margins.left - margins.right < 20 ||
    297 - margins.top - margins.bottom < 20
  )
    throw RangeError(
      "Pagination margins must leave at least 20 mm of content width and height",
    );
  for (const value of [options.repeatTableHeader, options.repeatTableCaption])
    if (value !== undefined && typeof value !== "boolean")
      throw TypeError("Table repetition options must be booleans");
  const pixels = {
    top: mmToPx(margins.top),
    right: mmToPx(margins.right),
    bottom: mmToPx(margins.bottom),
    left: mmToPx(margins.left),
  };
  return {
    width: mmToPx(210),
    height: mmToPx(297),
    gap: 24,
    margins: pixels,
    contentHeight: mmToPx(297) - pixels.top - pixels.bottom,
    contentWidth: mmToPx(210) - pixels.left - pixels.right,
    stride: mmToPx(297) + 24,
    repeatTableHeader: options.repeatTableHeader ?? true,
    repeatTableCaption: options.repeatTableCaption ?? true,
    pageNumbers: pageNumberOptions(options.pageNumbers),
    pageNumber:
      section.pageNumber?.position === undefined
        ? undefined
        : pageNumberPosition(section.pageNumber.position),
    pageNumberFormat:
      section.pageNumber?.format === undefined
        ? undefined
        : pageNumberFormat(section.pageNumber.format),
  };
}

export const DEFAULT_PAGINATION = paginationGeometry();

/** Preserve separately configured sides when updating a subset of options. */
export function mergePaginationOptions(
  previous: PaginationOptions,
  patch: PaginationOptions,
): PaginationOptions {
  const next = {
    ...previous,
    ...patch,
    margins: { ...previous.margins, ...patch.margins },
    pageNumbers: { ...previous.pageNumbers, ...patch.pageNumbers },
    // This selects one section's policy. Replacing it must not retain the
    // previous chapter's overrides; omitting the key keeps the current policy.
    section:
      "section" in patch ? structuredClone(patch.section) : previous.section,
    sections: patch.sections
      ? mergeSectionGroups(previous.sections, patch.sections)
      : "sections" in patch
        ? undefined
        : previous.sections,
  };
  for (const group of ["introduction", "content", "appendix"] as const)
    paginationGeometry(next, group);
  return next;
}

/** Resolve a section from the shared base; overrides never leak into another section. */
export function sectionGeometry(
  base: PaginationGeometry,
  options?: SectionOptions,
): PaginationGeometry {
  if (!options) return base;
  return paginationGeometry({
    margins: {
      top: pxToMm(base.margins.top),
      right: pxToMm(base.margins.right),
      bottom: pxToMm(base.margins.bottom),
      left: pxToMm(base.margins.left),
    },
    repeatTableHeader: base.repeatTableHeader,
    repeatTableCaption: base.repeatTableCaption,
    pageNumbers: base.pageNumbers,
    section: {
      ...options,
      pageNumber: {
        position: options.pageNumber?.position ?? base.pageNumber,
        format: options.pageNumber?.format ?? base.pageNumberFormat,
      },
    },
  });
}

export function applyPageGeometry(
  element: HTMLElement,
  page: PaginationGeometry,
) {
  for (const [side, value] of Object.entries(page.margins))
    element.style.setProperty(`--editor-margin-${side}`, `${value}px`);
  element.style.setProperty("--editor-content-width", `${page.contentWidth}px`);
}
