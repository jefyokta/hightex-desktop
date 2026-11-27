import type { ZoteroCreator, ZoteroItem } from "../../shared/zotero-contract";

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

export const buildZoteroSearchUrl = (host: string, port: number, query: string, limit = 40) =>
  buildZoteroUrl(host, port, "api/users/0/items/top", {
    format: "json", limit, q: query.trim(), qmode: "everything",
  });

export const buildZoteroItemBibtexUrl = (
  host: string,
  port: number,
  itemKey: string,
) => {
  return buildZoteroUrl(host, port, `api/users/0/items/${itemKey}`, {
    format: "bibtex",
  });
};

export const buildZoteroTestUrl = (host: string, port: number) => {
  return buildZoteroUrl(host, port, "api/users/0/items", {
    format: "json",
    limit: 1,
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) => typeof value === "string" ? value : undefined;
const childTypes = new Set(["attachment", "note", "annotation"]);

/** HTTP data is optional metadata, not a guarantee that every Zotero item is a publication. */
export const parseZoteroItems = (payload: unknown): ZoteroItem[] => {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((entry): ZoteroItem[] => {
    if (!isRecord(entry) || !isRecord(entry.data)) return [];
    const data = entry.data;
    if (typeof data.itemType === "string" && childTypes.has(data.itemType)) return [];
    const key = text(data.key)?.trim() || text(entry.key)?.trim();
    // Selecting/exporting an item requires an actual Zotero key.
    if (!key) return [];
    const item: ZoteroItem = { key, title: text(data.title) ?? "" };
    for (const [field, source] of [["itemType", "itemType"], ["date", "date"], ["url", "url"], ["doi", "DOI"]] as const) {
      const value = text(data[source]);
      if (value !== undefined) item[field] = value;
    }
    if (Array.isArray(data.creators)) {
      item.creators = data.creators.flatMap((value): ZoteroCreator[] => {
        if (!isRecord(value)) return [];
        const creator: ZoteroCreator = { creatorType: text(value.creatorType) ?? "" };
        for (const field of ["firstName", "lastName", "name"] as const) {
          const name = text(value[field]);
          if (name !== undefined) creator[field] = name;
        }
        return creator.firstName || creator.lastName || creator.name ? [creator] : [];
      });
    }
    return [item];
  });
};
