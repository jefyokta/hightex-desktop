import { objectToBib, type CiteUtils } from "bibtex.js";
import { t } from "./lang";

export type CitationAuthor = string | { firstName: string; lastName: string };

interface CslName {
  literal?: string;
  given?: string;
  family?: string;
}

/** Keep the library's incomplete CSL declarations at this conversion boundary. */
interface CitationWithAuthors {
  author?: string | CslName | (string | CslName)[];
  [field: string]: unknown;
}

export function citationAuthors(citation: CiteUtils): CitationAuthor[] {
  const { author }: CitationWithAuthors = citation.getCite();
  const authors = Array.isArray(author) ? author : author ? [author] : [];
  return authors.map(author => {
    if (typeof author === "string") return author;
    if (author.literal) return author.literal;
    if (!author.given) return author.family ?? "";
    return { firstName: author.given, lastName: author.family ?? "" };
  });
}

/** Change only authors; preserve publication fields and the citation's stored owner. */
export function bibliographyWithAuthors(citation: CiteUtils, authors: CitationAuthor[]): string {
  const names = authors.map(author => typeof author === "string"
    ? { literal: author.trim() }
    : { given: author.firstName.trim(), family: author.lastName.trim() });
  if (!names.length || names.some(name => !name.literal && !name.given && !name.family)) {
    throw new Error(t("editor.expandable.citation.author_required"));
  }
  const data: CitationWithAuthors = citation.getCite();
  return objectToBib({ ...data, author: names });
}
