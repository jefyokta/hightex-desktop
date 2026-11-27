import { expect, test } from "bun:test";
import { ZoteroService } from "../electron/service/zotero-service";
import { createCitationSearch } from "../src/utils/citation-search";

test("Zotero service keeps item, search and BibTeX requests on the configured endpoint", async () => {
  const requests: URL[] = [];
  const bib = "@book{source,title={Research},author={Writer},year={2026}}";
  const service = new ZoteroService("127.0.0.1", 23119, async address => {
    const url = new URL(address);
    requests.push(url);
    if (url.searchParams.get("format") === "bibtex") return new Response(bib);
    return Response.json([
      { data: { key: "source", title: "Research", date: "2026", DOI: "10.1234/research" } },
      { data: { key: "file", itemType: "attachment", title: "PDF" } },
    ]);
  });

  const items = await service.listItems(7);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ key: "source", title: "Research", doi: "10.1234/research" });
  expect(await service.searchItems("writer 2026")).toEqual(items);
  expect(await service.exportBibtex("source")).toBe(bib);
  expect(requests.every(url => url.origin === "http://127.0.0.1:23119")).toBe(true);
  expect(requests[0].searchParams.get("limit")).toBe("7");
  expect(requests[1].searchParams.get("q")).toBe("writer 2026");
  expect(requests[1].searchParams.get("qmode")).toBe("everything");
  expect(requests[2].pathname).toBe("/api/users/0/items/source");
});

test("Zotero data requests retain HTTP status and original network failures", async () => {
  const unavailable = new ZoteroService("127.0.0.1", 23119, async () =>
    new Response("unavailable", { status: 503, statusText: "Service Unavailable" }),
  );
  await expect(unavailable.listItems()).rejects.toThrow("Zotero returned 503 Service Unavailable");
  await expect(unavailable.searchItems("research")).rejects.toThrow("Zotero returned 503 Service Unavailable");
  await expect(unavailable.exportBibtex("source")).rejects.toThrow("Zotero returned 503 Service Unavailable");

  const cause = new TypeError("connection refused");
  const offline = new ZoteroService("127.0.0.1", 23119, async () => { throw cause; });
  await expect(offline.listItems()).rejects.toBe(cause);
});

test("connection checks return a status for HTTP, network and invalid JSON failures", async () => {
  const check = (request: () => Promise<Response>) => new ZoteroService("127.0.0.1", 23119, request).testConnection();
  expect(await check(async () => Response.json([]))).toMatchObject({
    connected: true, host: "127.0.0.1", port: 23119,
  });
  expect(await check(async () => new Response("missing", { status: 404, statusText: "Not Found" }))).toMatchObject({
    connected: false, message: "Zotero returned 404 Not Found", host: "127.0.0.1", port: 23119,
  });
  for (const request of [
    async () => { throw new Error("offline"); },
    async () => new Response("invalid JSON"),
  ]) {
    expect(await check(request)).toMatchObject({ connected: false, host: "127.0.0.1", port: 23119 });
  }
});

test("Zotero publications without a title remain searchable while child items are excluded", async () => {
  const service = new ZoteroService("127.0.0.1", 23119, async () => Response.json([
    { key: "UNTITLED", data: { itemType: "book", creators: [null, { creatorType: "author", name: "Institute" }], date: "2026" } },
    { data: { key: "NOTE", itemType: "note", note: "A child note" } },
    { data: { key: "PDF", itemType: "attachment" } },
    { data: { key: "ANNOTATION", itemType: "annotation" } },
  ]));
  const items = await service.listItems();
  const search = createCitationSearch(items, item => ({ key: item.key, title: item.title, authors: "", year: item.date ?? "", doi: item.doi ?? "" }));
  expect(search("untitled 2026").map(item => item.key)).toEqual(["UNTITLED"]);
  expect(items).toEqual([{ key: "UNTITLED", title: "", itemType: "book", creators: [{ creatorType: "author", name: "Institute" }], date: "2026" }]);
  expect(await service.searchItems("untitled")).toEqual(items);
});

test("Zotero malformed listing fields do not escape the HTTP payload boundary", async () => {
  const service = new ZoteroService("localhost", 23119, async () => Response.json([
    null, { data: null }, { data: { title: "No exportable key" } },
    { data: { key: 99, title: "Invalid key" } },
    { data: { key: "PARTIAL", title: { nested: "not a title" }, DOI: false, date: 2026, creators: "not an array" } },
  ]));
  expect(await service.listItems()).toEqual([{ key: "PARTIAL", title: "" }]);
});
