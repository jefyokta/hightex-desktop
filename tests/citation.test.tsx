import { expect, test, vi } from "bun:test";
import { renderToString } from "react-dom/server";
import { parseBibtexInput, isCitationValid } from "../src/utils/citation";

vi.mock("../src/editor/storage/hightex-db.ts", () => ({
  HighTexDB: {
    getInstance: () => ({
      cite: { toArray: async () => [] },
    }),
  },
}));

vi.mock("../src/editor/storage/index.ts", () => ({
  Storage: class {
    static instance = null;
  },
}));

import { Citation } from "../src/pages/citation";

test("citation page renders initial loading state", () => {
  const html = renderToString(<Citation />);

  expect(html).toContain("Loading citations...");
});

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
