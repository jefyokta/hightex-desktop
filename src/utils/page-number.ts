import { Counter } from "tjsn-parser";
import type { PageNumberFormat } from "@/types/pagination/section-options";

/** Shared academic front-matter numbering. */
export function toLowerRoman(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 3999)
    return String(value);
  const symbols = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ] as const;
  let result = "";
  for (const [number, text] of symbols)
    while (value >= number) {
      result += text;
      value -= number;
    }
  return result;
}

export const PAGE_NUMBER_FORMATS = [
  "decimal",
  "roman-upper",
  "roman-lower",
  "alpha-upper",
  "alpha-lower",
] as const;

export function pageNumberFormat(value: unknown): PageNumberFormat {
  for (const format of PAGE_NUMBER_FORMATS) if (value === format) return format;
  throw RangeError(`Invalid page number format: ${String(value)}`);
}

/** One formatter for live labels, printed labels and index/reference targets. */
export function formatPageNumber(
  value: number,
  format: PageNumberFormat,
): string {
  switch (format) {
    case "decimal":
      return String(value);
    case "roman-lower":
      return toLowerRoman(value);
    case "roman-upper":
      return toLowerRoman(value).toUpperCase();
    case "alpha-upper":
      return Counter.getAlpha(value);
    case "alpha-lower":
      return Counter.getAlpha(value).toLowerCase();
  }
}
