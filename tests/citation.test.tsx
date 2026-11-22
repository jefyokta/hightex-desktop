import { expect, test } from "bun:test";
import { parseBibtexInput, isCitationValid } from "../src/utils/citation";
import { CiteUtils } from "bibtex.js";
import { bibliographyWithAuthors, citationAuthors } from "../src/utils/citation-authors";

test("parseBibtexInput normalizes keys and parses valid BibTeX entries", () => {
  const bib = `@article{My Key 1,
  author={Jane Doe},
  title={A Test Article},
  year={2025}
}`;
  const result = parseBibtexInput(bib);

  expect(result.errors).toHaveLength(0);
  expect(result.entries).toHaveLength(1);
  expect(result.entries[0].key).toBe("My_Key_1");
  expect(result.entries[0].bib).toContain("@article{My_Key_1");
});

test("isCitationValid rejects entries missing a required field", () => {
  const bib = `@article{missingFields,
  title={No Author or Year}
}`;
  const { entries } = parseBibtexInput(bib);

  expect(entries).toHaveLength(1);
  expect(isCitationValid(entries[0].cite)).toBe(false);
});

test("parseBibtexInput ignores Zotero-only fields and preserves valid BibTeX fields used by citation-js", () => {
  const bib = `@article{myZoteroEntry,
  author={Jane Doe},
  title={Zotero Export},
  year={2025},
  url={https://example.com},
  abstractNote={This is ignored},
  file={path/to/file.pdf}
}`;

  const result = parseBibtexInput(bib);

  expect(result.errors).toHaveLength(0);
  expect(result.entries).toHaveLength(1);
  expect(result.entries[0].bib).toContain("@article{myZoteroEntry");
  expect(result.entries[0].bib).toContain("url = {https://example.com}");
  expect(result.entries[0].bib).not.toContain("abstractNote");
  expect(result.entries[0].bib).not.toContain("file=");
});

test("author editing supports people and organization names without changing publication metadata", () => {
  const citation = new CiteUtils({
    id: "source", type: "book", title: "Original title", DOI: "10.1234/example",
    issued: { "date-parts": [[2026]] },
    author: [{ given: "Jane", family: "Doe" }, { literal: "Research Group" }],
  }).setId("stored-owner");
  expect(citationAuthors(citation)).toEqual([
    { firstName: "Jane", lastName: "Doe" }, "Research Group",
  ]);
  const before = JSON.stringify(citation.getCite());
  const bib = bibliographyWithAuthors(citation, [
    { firstName: " Updated ", lastName: " Writer " }, " New Research Group ",
  ]);
  const updated = new CiteUtils(bib);
  expect(updated.getCite()).toMatchObject({
    title: "Original title", DOI: "10.1234/example", issued: { "date-parts": [[2026]] },
  });
  expect(citationAuthors(updated)).toEqual([
    { firstName: "Updated", lastName: "Writer" }, "New Research Group",
  ]);
  expect(citation.getId()).toBe("stored-owner");
  expect(JSON.stringify(citation.getCite())).toBe(before);
});

test("empty author edits are rejected before producing a replacement bibliography", () => {
  const citation = new CiteUtils("@book{key,author={Writer},title={Book},year={2026}}");
  for (const authors of [[], [" "], [{ firstName: "", lastName: " " }]]) {
    expect(() => bibliographyWithAuthors(citation, authors)).toThrow();
  }
});
