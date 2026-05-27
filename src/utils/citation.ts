import { bibToObject, objectToBib, CiteUtils } from "bibtex.js";

export const formatManual = (text: string, year: string, citeA?: boolean) => {
  return citeA ? `${text} (${year})` : `(${text}, ${year})`;
};

const normalizeBibKey = (key: string) => {
  const normalized = key
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._:-]/g, "")
    .replace(/^[_\.:-]+|[_\.:-]+$/g, "");

  return normalized || `cite_${Date.now()}`;
};

const normalizeBibtexKeys = (content: string) => {
  return content.replace(
    /@([A-Za-z]+)\s*{\s*([^,]+?)\s*,/g,
    (_, type, rawKey) => {
      const key = normalizeBibKey(rawKey);
      return `@${type}{${key},`;
    },
  );
};

const sanitizeCslItem = (item: any) => {
  const ignoredFields = new Set([
    "abstractNote",
    "file",
    "attachments",
    "itemType",
    "itemID",
    "libraryCatalog",
    "dateAdded",
    "dateModified",
    "uri",
    "extra",
    "notes",
    "tags",
    "collections",
    "rights",
  ]);

  return Object.keys(item).reduce((acc: any, key) => {
    if (ignoredFields.has(key)) return acc;
    acc[key] = item[key];
    return acc;
  }, {} as any);
};

const getCitationYear = (cite: CiteUtils) => {
  const data = cite.getCite() as any;
  if (typeof data.year === "string" && data.year.trim()) {
    return data.year.trim();
  }

  const issued = data.issued as any;
  const dateParts = issued?.["date-parts"] || issued?.["date-parts"]?.[0];
  if (Array.isArray(dateParts) && dateParts.length > 0) {
    const year = dateParts[0];
    return typeof year === "number" ? String(year) : year;
  }

  return undefined;
};

const hasAuthorOrEditor = (cite: CiteUtils) => {
  const data = cite.getCite() as any;
  const author = data.author;
  const editor = data.editor;

  const hasAuthor = Array.isArray(author)
    ? author.length > 0
    : typeof author === "string" && author.trim().length > 0;
  const hasEditor = Array.isArray(editor)
    ? editor.length > 0
    : typeof editor === "string" && editor.trim().length > 0;

  return hasAuthor || hasEditor;
};

export const isCitationValid = (cite: CiteUtils) => {
  const title = cite.getTitle()?.trim();
  const year = getCitationYear(cite);

  return Boolean(title && year && hasAuthorOrEditor(cite));
};

export type ParsedCitation = {
  key: string;
  bib: string;
  cite: CiteUtils;
  originalKey: string;
};

export const parseBibtexInput = (content: string) => {
  const value = content.trim();
  if (!value) {
    return {
      entries: [] as ParsedCitation[],
      errors: ["No BibTeX content provided."],
    };
  }

  try {
    const parsed = bibToObject(normalizeBibtexKeys(value)) as any[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return {
        entries: [] as ParsedCitation[],
        errors: ["No valid BibTeX entries were found."],
      };
    }

    const entries = parsed.map((item) => {
      const originalKey = String(item.id || item["citation-key"]);
      const key = normalizeBibKey(originalKey);
      const sanitized = sanitizeCslItem(item);
      const normalized = {
        ...sanitized,
        id: key,
        "citation-key": key,
      };
      const bib = objectToBib(normalized as any);
      const cite = new CiteUtils(normalized).setId(key);

      return {
        key,
        bib,
        cite,
        originalKey,
      };
    });

    return {
      entries,
      errors: [] as string[],
    };
  } catch (error) {
    return {
      entries: [] as ParsedCitation[],
      errors: [
        "Unable to parse the provided BibTeX input. Please use valid BibTeX formatting.",
      ],
    };
  }
};
