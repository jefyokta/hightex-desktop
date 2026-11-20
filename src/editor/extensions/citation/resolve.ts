import { formatInTextCitation, formatManual } from "@/utils/citation";

export interface CitationAttributes {
  cite?: string;
  citeA?: boolean;
  manual?: boolean;
  text?: string;
  year?: string;
}

export const citationFallback = (keys: string = "") =>
  `[${keys.split("|").filter(Boolean).join("; ") || "?"}]`;

/** One citation rule for live node views and resolved archive rendering. */
export function resolveCitation(
  attrs: CitationAttributes,
  records: readonly CiteRecord[],
): string {
  if (attrs.manual)
    return formatManual(attrs.text ?? "", attrs.year ?? "", attrs.citeA);
  const keys = (attrs.cite ?? "").split("|").filter(Boolean);
  const byKey = new Map(records.map((record) => [record.key, record]));
  if (!keys.length || keys.some((key) => !byKey.has(key)))
    throw Error("Unresolved citation");
  return formatInTextCitation(
    keys.map((key) => byKey.get(key)!),
    attrs.citeA,
  ).inText;
}
