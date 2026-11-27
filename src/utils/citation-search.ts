import type { CiteUtils } from "bibtex.js";

export interface CitationSearchFields {
  key: string;
  title: string;
  authors: string;
  year: string;
  doi: string;
}

const normalize = (value: unknown) => {
  const text = typeof value === "string" ? value
    : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
};

/** Index bibliographic fields once, then rank tokens across fields instead of raw JSON. */
export function citationSearchFields(citation: CiteUtils): CitationSearchFields {
  const data: {
    author?: { given?: string; family?: string; literal?: string }[];
    editor?: { given?: string; family?: string; literal?: string }[];
    issued?: { "date-parts"?: (string | number)[][] };
    year?: string;
    DOI?: string;
    doi?: string;
  } = citation.getCite();
  const names = [...(data.author ?? []), ...(data.editor ?? [])];
  return {
    key: citation.getId(),
    title: citation.getTitle() ?? "",
    authors: names.map(name => [name.given, name.family, name.literal].filter(Boolean).join(" ")).join(" "),
    year: String(data.year ?? data.issued?.["date-parts"]?.[0]?.[0] ?? ""),
    doi: data.DOI ?? data.doi ?? "",
  };
}

export function createCitationSearch<T>(values: readonly T[], fields: (value: T) => CitationSearchFields) {
  const indexed = values.map((value, position) => {
    const source = fields(value);
    return {
      value, position,
      key: normalize(source.key),
      title: normalize(source.title),
      authors: normalize(source.authors),
      year: normalize(source.year),
      doi: normalize(source.doi).replace(/^https?:\/\/(?:dx\.)?doi\.org\//, ""),
    };
  });
  return (query: string): T[] => {
    const text = normalize(query.trim()).replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");
    if (!text) return [...values];
    const tokens = text.split(/\s+/);
    return indexed.map(item => {
      const fields = [item.key, item.title, item.authors, item.year, item.doi];
      if (!tokens.every(token => fields.some(field => field.includes(token)))) return;
      const exact = item.key === text || item.doi === text;
      const score = (exact ? 100 : 0) + (item.title === text ? 40 : item.title.startsWith(text) ? 20 : 0)
        + tokens.reduce((score, token) => score + (item.title.includes(token) ? 4 : 0) + (item.authors.includes(token) ? 2 : 0), 0);
      return { ...item, score };
    }).filter((item): item is NonNullable<typeof item> => item !== undefined)
      .sort((left, right) => right.score - left.score || left.position - right.position)
      .map(item => item.value);
  };
}
