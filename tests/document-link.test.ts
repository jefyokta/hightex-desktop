import { expect, test } from "bun:test";
import { documentLinkHref, documentLinkTarget } from "../shared/document-link";
import { referenceFallback } from "../src/document-engine/link-presentation";

test("malformed links use # while supported URLs and encoded local targets survive", () => {
  for (const href of [undefined, "", "broken URL", "#%zz", "javascript:alert(1)", "file:///tmp/report", "mailto:"])
    expect(documentLinkHref(href)).toBe("#");
  for (const href of ["#", "#bab%204", "https://example.com", "http://example.com/a", "mailto:user@example.com"])
    expect(documentLinkHref(href)).toBe(href);
  expect(documentLinkTarget("#bab%204")).toBe("bab 4");
  expect(documentLinkTarget("#%zz")).toBeUndefined();
});

test("missing references discard stale labels and retain an explicit kind fallback", () => {
  for (const [kind, text] of [["imageFigure", "Gambar ?"], ["figureTable", "Tabel ?"], ["equation", "Persamaan ?"], ["head", "Lampiran ?"]]) {
    const attributes = new Map([["data-ref", kind], ["data-label", "999"]]);
    const link = { textContent: "999", getAttribute: (key: string) => attributes.get(key) ?? null,
      setAttribute: (key: string, value: string) => { attributes.set(key, value); },
      removeAttribute: (key: string) => { attributes.delete(key); } };
    referenceFallback(link);
    expect(link.textContent).toBe(text);
    expect(attributes.get("href")).toBe("#");
    expect(attributes.has("data-label")).toBe(false);
  }
});
