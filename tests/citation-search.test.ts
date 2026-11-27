import { expect, test } from "bun:test";
import { CiteUtils } from "bibtex.js";
import { citationSearchFields, createCitationSearch, type CitationSearchFields } from "../src/utils/citation-search";
import { buildZoteroSearchUrl } from "../electron/utilities/zotero";

test("reference search combines bibliographic fields and ignores accents", () => {
  const citation = new CiteUtils("@book{source,author={García, José},title={Editor Research},year={2026},doi={10.1234/example}}").setId("stored-key");
  const search = createCitationSearch([citation], citationSearchFields);
  for (const query of ["garcia editor 2026", "JOSE research", "stored-key", "https://doi.org/10.1234/example"]) {
    expect(search(query)).toEqual([citation]);
  }
  expect(search("garcia 2025")).toEqual([]);
  expect(search("  ")).toEqual([citation]);
});

test("exact keys rank ahead of title matches without reordering equal results", () => {
  const citations = [
    new CiteUtils("@book{a,title={Target research},author={Writer},year={2026}}"),
    new CiteUtils("@book{b,title={Target methods},author={Writer},year={2026}}"),
    new CiteUtils("@book{target,title={Other topic},author={Writer},year={2026}}"),
  ];
  expect(createCitationSearch(citations, citationSearchFields)("target").map(item => item.getId())).toEqual(["target", "a", "b"]);
});

test("Zotero search sends encoded multi-field queries independently of the initial item list", () => {
  const url = new URL(buildZoteroSearchUrl("127.0.0.1", 23119, "  García & 2026  "));
  expect(url.pathname).toBe("/api/users/0/items/top");
  expect(url.searchParams.get("q")).toBe("García & 2026");
  expect(url.searchParams.get("qmode")).toBe("everything");
  expect(url.searchParams.get("limit")).toBe("40");
});

test("reference search tolerates absent metadata and numeric years without changing records", () => {
  const item = { key: "missing-title", title: undefined, authors: null, year: 2026, doi: undefined };
  const search = createCitationSearch([item], value => value as unknown as CitationSearchFields);
  expect(search("missing-title 2026")).toEqual([item]);
  expect(search("")).toEqual([item]);
  expect(search("unrelated")).toEqual([]);
  expect(item.title).toBeUndefined();
});
