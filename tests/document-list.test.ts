import { expect, test } from "bun:test";
import { filterDocuments } from "../src/utils/document-list";

const documents = [
  {
    id: "a",
    title: "Analisis Sistem",
    altTitle: "System Analysis",
    category: "1",
    updatedAt: new Date("2026-10-01"),
    keywords: { indonesian: ["pendidikan"], english: ["learning"] },
  },
  {
    id: "b",
    title: "Bab 10",
    altTitle: "",
    category: "2",
    updatedAt: new Date("2026-10-03"),
    keywords: { indonesian: [], english: [] },
  },
  {
    id: "c",
    title: "Bab 2",
    altTitle: "",
    category: "1",
    updatedAt: new Date("2026-10-02"),
    keywords: { indonesian: [], english: [] },
  },
  {
    id: "d",
    title: "Tanpa tanggal",
    altTitle: "",
    category: "1",
    keywords: { indonesian: [], english: [] },
  },
] as HighTexDocument[];

const ids = (items: HighTexDocument[]) => items.map((item) => item.id);

test("documents sort by update time and title with natural numbers without mutating the source", () => {
  const before = ids(documents);
  expect(ids(filterDocuments(documents, "", "all", "updated"))).toEqual([
    "b",
    "c",
    "a",
    "d",
  ]);
  expect(ids(filterDocuments(documents, "", "all", "oldest"))).toEqual([
    "d",
    "a",
    "c",
    "b",
  ]);
  expect(ids(filterDocuments(documents, "", "all", "title"))).toEqual([
    "a",
    "c",
    "b",
    "d",
  ]);
  expect(ids(documents)).toEqual(before);
});

test.each(["  ANALISIS  ", "System Analysis", "pendidikan", "LEARNING"])(
  "document search includes titles and keywords: %s",
  (query) => {
    expect(ids(filterDocuments(documents, query, "all", "updated"))).toEqual([
      "a",
    ]);
  },
);

test("category and search filters combine and unmatched filters are empty", () => {
  expect(ids(filterDocuments(documents, "bab", "1", "title"))).toEqual(["c"]);
  expect(ids(filterDocuments(documents, "learning", "2", "updated"))).toEqual(
    [],
  );
  expect(filterDocuments(documents, "nonexistent", "all", "updated")).toEqual(
    [],
  );
});

test("invalid timestamps do not destabilize document ordering", () => {
  const invalid = {
    ...documents[3],
    id: "e",
    title: "Invalid date",
    updatedAt: new Date("invalid"),
  };
  expect(
    ids(filterDocuments([invalid, ...documents], "", "all", "updated")),
  ).toEqual(["b", "c", "a", "e", "d"]);
});
