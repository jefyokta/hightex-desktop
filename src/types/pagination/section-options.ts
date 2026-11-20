export type PageNumberPosition =
  `${"top" | "bottom"}-${"left" | "center" | "right"}`;
export type PageNumberFormat =
  | "decimal"
  | "roman-upper"
  | "roman-lower"
  | "alpha-upper"
  | "alpha-lower";
export type SectionGroup = "introduction" | "content" | "appendix";
export type PageMargins = Record<"top" | "right" | "bottom" | "left", number>;

export interface SectionOptions {
  margins?: Partial<PageMargins>;
  pageNumber?: {
    position?: PageNumberPosition;
    format?: PageNumberFormat;
  };
}
