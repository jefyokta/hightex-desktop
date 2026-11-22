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

export const parseZoteroItems = (payload: any) => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((item) => item?.data && item.data.itemType !== "attachment")
    .map((item) => ({
      key: item.data.key,
      title: item.data.title,
      itemType: item.data.itemType,
      creators: item.data.creators,
      date: item.data.date,
      url: item.data.url,
      doi: item.data.DOI,
    }));
};
