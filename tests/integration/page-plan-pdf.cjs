const assert = require("node:assert/strict");

const compact = (value) =>
  value.normalize("NFKC").replace(/[\s\u2060\u00ad]/g, "");
const containsPDFSourceText = (expected, ...extractions) =>
  extractions.some((text) => compact(text).includes(compact(expected)));
exports.containsPDFSourceText = containsPDFSourceText;
exports.compactPDFSourceText = compact;

// Both the fragment proof and the application export use the editor's source
// ranges as their oracle. Table columns can interleave in PDF extraction, so
// page-spanning cells must be checked as the ranges assigned to each page.
exports.verifyPagePlanText = ({
  text,
  raw,
  contract,
  markerPages,
  ranges,
  narrativeIds,
}) => {
  const pages = text.split("\f"),
    rawPages = raw.split("\f");
  for (const marker of contract.markers)
    assert.deepEqual(
      pages.flatMap((page, index) =>
        Array.from(page.matchAll(new RegExp(marker, "g")), () => index + 1),
      ),
      markerPages[marker],
      `PDF source assignment: ${marker}`,
    );
  for (const page of ranges ?? [])
    for (const range of page.ranges)
      if (compact(range.text))
        assert.ok(
          containsPDFSourceText(
            range.text,
            pages[page.page - 1] ?? "",
            rawPages[page.page - 1] ?? "",
          ),
          `PDF lost source range ${range.from}..${range.to} on page ${page.page}`,
        );
  for (const block of contract.literalBlocks.filter((block) =>
    narrativeIds.includes(block.id),
  ))
    assert.ok(
      containsPDFSourceText(block.text, text, raw),
      `PDF lost text from ${block.id}`,
    );
};
