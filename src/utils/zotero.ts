import { objectToBib, CiteUtils } from "bibtex.js";

export type ZoteroCreator = {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  name?: string;
};

export type ZoteroItem = {
  key: string;
  title: string;
  itemType?: string;
  creators?: ZoteroCreator[];
  date?: string;
  url?: string;
};

export type ZoteroConnectionResult = {
  connected: boolean;
  message: string;
  host: string;
  port: number;
};

export const DEFAULT_ZOTERO_CONFIG = {
  enabled: false,
  host: "127.0.0.1",
  port: 23119,
};

const buildZoteroUrl = (
  host: string,
  port: number,
  path: string,
  params?: Record<string, string | number | boolean>,
) => {
  const url = new URL(`http://${host}:${port}/${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
};

const getItemYear = (date?: string) => {
  if (!date) return undefined;

  const match = date.match(/(\d{4})/);
  if (!match) return undefined;

  return Number(match[1]);
};

const normalizeCreators = (creators: ZoteroCreator[] = []) => {
  const author = creators
    .filter((creator) => creator.creatorType === "author")
    .map((creator) => {
      if (creator.name) {
        return { literal: creator.name };
      }

      return {
        given: creator.firstName?.trim() || "",
        family: creator.lastName?.trim() || "",
      };
    })
    .filter((item) => Boolean(item.given || item.family || item.literal));

  const editor = creators
    .filter((creator) => creator.creatorType === "editor")
    .map((creator) => {
      if (creator.name) {
        return { literal: creator.name };
      }

      return {
        given: creator.firstName?.trim() || "",
        family: creator.lastName?.trim() || "",
      };
    })
    .filter((item) => Boolean(item.given || item.family || item.literal));

  return { author, editor };
};

const toCslType = (itemType?: string) => {
  if (!itemType) return "article-journal";

  switch (itemType.toLowerCase()) {
    case "book":
      return "book";
    case "booksection":
    case "book section":
      return "chapter";
    case "thesis":
    case "phdthesis":
    case "mastersthesis":
      return "thesis";
    case "conferencepaper":
    case "conference paper":
      return "paper-conference";
    case "journalarticle":
    case "journal article":
      return "article-journal";
    default:
      return "article-journal";
  }
};

export const buildZoteroItemCitation = (item: ZoteroItem) => {
  const year = getItemYear(item.date);
  const creators = normalizeCreators(item.creators ?? []);
  const citeItem: any = {
    id: item.key,
    "citation-key": item.key,
    type: toCslType(item.itemType),
    title: item.title || "Untitled",
    URL: item.url,
  };

  if (year) {
    citeItem.issued = {
      "date-parts": [[year]],
    };
    citeItem.year = String(year);
  }

  if (creators.author.length > 0) {
    citeItem.author = creators.author;
  }

  if (creators.editor.length > 0) {
    citeItem.editor = creators.editor;
  }

  const bib = objectToBib(citeItem);
  const cite = new CiteUtils(citeItem).setId(item.key);

  return {
    key: item.key,
    bib,
    cite,
  };
};

export const buildZoteroBaseUrl = (host: string, port: number) => {
  return `http://${host}:${port}`;
};

export const buildZoteroItemListUrl = (
  host: string,
  port: number,
  limit = 100,
) => {
  return buildZoteroUrl(host, port, "api/users/0/items", {
    format: "json",
    limit,
  });
};

export const buildZoteroTestUrl = (host: string, port: number) => {
  return buildZoteroUrl(host, port, "api/users/0/items", {
    format: "json",
    limit: 1,
  });
};
