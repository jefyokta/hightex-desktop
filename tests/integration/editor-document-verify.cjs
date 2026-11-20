// Bounded native proof after event-contract changes: one document and one saved PDF.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");

exports.run = async ({
  execute,
  until,
  folder,
  metrics,
  outputs,
  snapshot,
}) => {
  const report = { stage: "snapshot", pages: snapshot.pages };
  const save = () =>
    fs.writeFileSync(
      path.join(folder, "bounded-verification.json"),
      JSON.stringify(report, null, 2),
    );
  save();
  const audit = await execute(`
    const parsed=new DOMParser().parseFromString(documentSnapshot.html,'text/html');
    const pages=Array.from(parsed.querySelector('.editor-pdf-pages').children);
    return {
      trace:engineTrace,
      language:parsed.documentElement.lang,
      labels:pages.map(page=>({label:page.dataset.pageLabel,topMarginPixels:parseFloat(page.style.getPropertyValue('--editor-margin-top'))||0,painted:Array.from(page.querySelectorAll('.editor-pagination-number'),node=>node.textContent)})),
      missing:Array.from(parsed.querySelectorAll('a[data-type="ref-component"][data-status="missing"]'),link=>({text:link.textContent,href:link.getAttribute('href')})),
      integrity:{source:JSON.stringify(editor.getJSON())===fullBefore.source,stored:JSON.stringify(await db.chapters.get('fixture.1'))===fullBefore.stored,selection:JSON.stringify(editor.state.selection.toJSON())===JSON.stringify(fullBefore.selection),history:JSON.stringify(historyDepth())===JSON.stringify(fullBefore.history),updates:updates===fullBefore.updates}
    };
  `);
  report.audit = audit;
  save();
  assert.equal(audit.language, "id");
  assert.ok(Object.values(audit.integrity).every(Boolean));
  assert.equal(
    audit.trace.filter((event) => event.type === "contentRendered").length,
    1,
  );
  assert.deepEqual(
    audit.trace.map((event) => event.sequence),
    audit.trace.map((_, index) => index + 1),
  );
  assert.deepEqual(
    audit.trace
      .filter((event) => ["rendered", "error", "cancel"].includes(event.type))
      .map((event) => event.type),
    ["rendered"],
  );
  assert.equal(audit.trace.at(-1).type, "dispose");
  const content = audit.trace.findIndex(
    (event) => event.type === "contentRendered",
  );
  assert.ok(
    audit.trace
      .slice(content + 1)
      .every(
        (event) =>
          event.type !== "chapter" &&
          !(event.type === "section.before" && event.phase === "content"),
      ),
  );
  assert.ok(
    audit.trace.filter((event) => event.type === "index.pass").at(-1).stable,
  );
  const chapters = audit.trace
    .filter((event) => event.type === "chapter")
    .map((event) => event.chapterId);
  assert.equal(new Set(chapters).size, chapters.length);
  for (const page of audit.labels)
    assert.deepEqual(page.painted, page.label ? [page.label] : []);
  assert.deepEqual(audit.missing, [{ text: "Tabel ?", href: "#" }]);

  if (process.env.HIGHTEX_EDITOR_PDF_APPENDIX_PROBE) {
    fs.writeFileSync(
      path.join(folder, "appendix-probe-snapshot.html"),
      snapshot.html,
    );
    await execute(
      `await window.editorPDFExperimental.export(documentSnapshot,crypto.randomUUID())`,
    );
    report.native = metrics.at(-1);
    report.output = outputs.at(-1);
    report.stage = "appendix-probe";
    save();
    console.log(
      "Appendix probe saved:",
      path.join(folder, "bounded-verification.json"),
    );
    return;
  }

  report.stage = "fallback-native";
  save();
  const before = outputs.length;
  await execute(`document.querySelector('[data-editor-pdf-export]').click()`);
  await until(`!document.querySelector('[data-editor-pdf-export]').disabled`);
  assert.equal(
    await execute(
      `return document.querySelector('[data-editor-pdf-error]')?.textContent`,
    ),
    undefined,
  );
  assert.ok(
    await execute(
      `return Boolean(document.querySelector('[data-editor-pdf-warning]')?.textContent)`,
    ),
  );
  assert.equal(outputs.length, before + 1);
  const output = outputs.at(-1),
    metric = metrics.at(-1);
  const pdf = await PDFDocument.load(fs.readFileSync(output));
  report.native = {
    ...metric,
    text: undefined,
    file: output,
    actualPages: pdf.getPageCount(),
  };
  save();
  assert.equal(pdf.getPageCount(), snapshot.pages);
  assert.equal(metric.pages, metric.pdfPages);
  assert.equal(metric.paged, 0);
  assert.equal(metric.images, true);
  assert.equal(metric.references.length, 1);
  assert.equal(metric.references[0].text, "Tabel ?");
  assert.equal(metric.references[0].color, "rgb(220, 38, 38)");
  assert.equal(metric.references[0].href, "#");
  const text = execFileSync("pdftotext", ["-layout", output, "-"], {
    encoding: "utf8",
  }).split("\f");
  assert.ok(text[metric.references[0].page - 1].includes("Tabel ?"));
  for (const section of snapshot.sections)
    for (const [index, label] of section.labels.entries())
      // PDF extraction may discard spaces around the appendix hyphen.
      if (label)
        assert.ok(
          text[section.firstPage + index - 1]
            .replace(/\s/g, "")
            .includes(label.replace(/\s/g, "")),
          `Missing page number ${label}`,
        );
  // Check actual PDF coordinates; image presentation alone can mislead about whitespace.
  const bbox = execFileSync("pdftotext", ["-bbox", output, "-"], {
    encoding: "utf8",
  });
  const pdfPages = Array.from(
    bbox.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g),
    (match) => match[1],
  );
  report.appendixPositions = [];
  for (const section of snapshot.sections.filter(
    (section) => section.id === "attachment",
  )) {
    for (let index = 0; index < section.pages; index++) {
      const page = section.firstPage + index;
      const firstWord = pdfPages[page - 1]?.match(
        /<word\b[^>]*yMin="([\d.]+)"[^>]*>([^<]*)<\/word>/,
      );
      assert.ok(firstWord, `Missing appendix text on PDF page ${page}`);
      const yPoints = Number(firstWord[1]),
        minimumPoints = (audit.labels[page - 1].topMarginPixels * 72) / 96;
      report.appendixPositions.push({
        page,
        firstWord: firstWord[2],
        yPoints,
        minimumPoints,
      });
      assert.ok(
        yPoints >= minimumPoints - 1,
        `Appendix text above its top margin on PDF page ${page}`,
      );
    }
  }
  fs.copyFileSync(output, path.join(folder, "verified-document.pdf"));
  const reference = metric.references[0];
  execFileSync(
    "pdftoppm",
    [
      "-f",
      String(reference.page),
      "-l",
      String(reference.page),
      "-r",
      "96",
      "-singlefile",
      "-png",
      output,
      path.join(folder, "reference-page"),
    ],
    { timeout: 15000 },
  );
  report.stage = "passed";
  save();
  console.log(
    "PASS: bounded native PDF verification; event lifecycle, page numbers, recoverable Indonesian red reference, native page count and unchanged editor.",
  );
};
