// Run with Electron. Uses the isolated real-editor fixture, never user documents.
// env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/editor-pagination-stress.cjs
const assert = require("node:assert/strict");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");

function random(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function buildDocument(seed, blocks, citeKey) {
  const next = random(seed);
  const integer = (min, max) => min + Math.floor(next() * (max - min + 1));
  const sentence = "Penelitian mengukur kebutuhan pengguna, ketepatan hasil, dan kestabilan sistem. ";
  const p = (text) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
  let serial = 0;
  const image = () => ({ type: "imageFigure", attrs: { id: `image-${seed}-${serial++}` }, content: [
    { type: "image", attrs: { src: "fixture-image", width: integer(180, 480) } },
    { type: "figcaption", content: [{ type: "text", text: `Gambar seed ${seed} nomor ${serial}` }] },
  ] });
  const code = () => ({ type: "codeBlock", content: [{ type: "text", text:
    Array.from({ length: integer(2, 55) }, (_, i) => `const hasil_${i} = ${i};`).join("\n") }] });
  const table = (nested = false) => {
    const id = `table-${seed}-${serial++}`;
    const cell = (text, attrs = {}) => ({ type: "tableCell", attrs, content: [p(text)] });
    const header = (text, attrs = {}) => ({ type: "tableHeader", attrs, content: [p(text)] });
    const rows = [
      { type: "tableRow", content: [header("Kelompok", { rowspan: 2 }), header("Pengukuran", { colspan: 2 })] },
      { type: "tableRow", content: [header("Awal"), header("Akhir")] },
      { type: "tableRow", content: [cell(sentence.repeat(integer(8, 25)), { rowspan: 2 }), cell("B1"), cell("C1")] },
      { type: "tableRow", content: [cell(sentence.repeat(integer(1, 8)), { colspan: 2 })] },
      ...Array.from({ length: integer(4, 18) }, (_, i) => ({ type: "tableRow", content:
        [0, 1, 2].map(j => cell(i % 4 === 0 ? "" : `Data ${i}/${j}. ${sentence.repeat(integer(0, 2))}`)) })),
    ];
    if (nested) rows.push({ type: "tableRow", content: [
      { type: "tableCell", attrs: { colspan: 3 }, content: [p(sentence.repeat(integer(3, 12))), {
        type: "table", content: Array.from({ length: integer(4, 14) }, (_, i) => ({ type: "tableRow", content: [
          { type: i === 0 ? "tableHeader" : "tableCell", content: [p(`Bagian ${i}. ${sentence.repeat(2)}`)] },
        ] })),
      }, p("Sesudah tabel bersarang")] },
    ] });
    return { type: "figureTable", attrs: { id }, content: [
      { type: "figcaption", content: [{ type: "text", text: `Tabel seed ${seed} nomor ${serial}` }] },
      { type: "table", content: rows },
    ] };
  };
  const content = [{ type: "heading", attrs: { level: 1, id: `heading-${seed}` }, content: [{ type: "text", text: `Stress ${seed}` }] }];
  for (let i = 0; i < blocks; i++) {
    // Each seed covers all categories, with seeded lengths and ordering.
    const kind = i < 10 ? i : integer(0, 9);
    if (kind === 0) content.push(p(`Paragraf ${i}. ${sentence.repeat(integer(1, 45))}`));
    if (kind === 1) content.push({ type: "orderedList", attrs: { start: integer(2, 20) }, content: [
      { type: "listItem", content: [p(sentence.repeat(integer(2, 12))), code(), p("Sesudah kode. " + sentence)] },
      { type: "listItem", content: [p("Butir kedua. " + sentence), { type: "bulletList", content: [
        { type: "listItem", content: [p(sentence.repeat(integer(2, 14)))] },
      ] }] },
    ] });
    if (kind === 2) content.push(table());
    if (kind === 3) content.push(image());
    if (kind === 4) content.push({ type: "paragraph", content: [
      { type: "text", text: "ÅÉỆgyp " + sentence.repeat(integer(1, 8)), marks: [{ type: "italic" }] },
      { type: "mathInline", attrs: { latex: "\\dfrac{\\sum_{i=1}^{100}x_i^2}{\\sqrt{1+x^2}}" } },
      { type: "cite", attrs: { cite: citeKey } }, { type: "variable", attrs: { name: "title" } },
      { type: "text", text: sentence.repeat(integer(2, 10)), marks: [{ type: "bold" }] },
    ] });
    if (kind === 5) content.push({ type: "blockquote", content: [p(sentence.repeat(integer(1, 10))), code(), p(sentence)] });
    if (kind === 6) content.push({ type: "paragraph", content: Array.from({ length: integer(2, 60) }, (_, j) => [
      { type: "text", text: `Baris ${j}. ${sentence.slice(0, integer(15, 70))}` }, { type: "hardBreak" },
    ]).flat() });
    if (kind === 7) content.push({ type: "heading", attrs: { level: integer(2, 4), id: `sub-${seed}-${i}` }, content: [{ type: "text", text: `Bagian ${i}` }] }, p(sentence.repeat(integer(1, 8))));
    if (kind === 8) content.push(p("Sebelum pemisah. " + sentence), { type: "horizontalRule" }, p("Sesudah pemisah. " + sentence));
    if (kind === 9) content.push(table(true));
    if (i % 11 === 0) content.push({ type: "blockMath", attrs: { id: `equation-${seed}-${i}`, latex: "\\sum_{i=1}^{100} x_i^2 = \\dfrac{a+b}{c+d}" } });
    if (i % 5 === 0) content.push(p(""));
  }
  content.push(p("Penutup bab. " + sentence.repeat(3)));
  return { type: "doc", content };
}

function installBrowserChecks() {
  const samples = [];
  let lastTick = performance.now();
  const heartbeat = setInterval(() => {
    const now = performance.now(); samples.push(now - lastTick); lastTick = now;
  }, 16);
  const metrics = () => {
    const values = samples.splice(0).sort((a, b) => a - b);
    return { heartbeatP95Ms: values[Math.floor(values.length * .95)] ?? 0,
      heartbeatMaxMs: values.at(-1) ?? 0, domNodes: document.querySelectorAll("*").length,
      measurementHosts: document.querySelectorAll("[data-pagination-measure]").length };
  };
  const audit = () => {
    const geometry = window.textRects();
    const page = document.querySelector(".page").getBoundingClientRect();
    const scale = page.width / window.pageMetrics.width;
    const rects = [];
    for (const element of window.editor.view.dom.querySelectorAll(".node-image img, .node-blockMath")) {
      const bounds = window.inPage(element);
      if (bounds.top < bounds.start - 1 || bounds.bottom > bounds.end + 1)
        rects.push({ type: element.tagName, ...bounds });
    }
    const originals = Array.from(window.editor.view.dom.querySelectorAll("figure[data-type=figureTable]"), figure => ({
      caption: figure.querySelector("figcaption")?.textContent,
      label: figure.querySelector("figcaption")?.getAttribute("data-label"),
    }));
    const repeats = [];
    for (const element of document.querySelectorAll(".editor-pagination-furniture")) {
      const caption = element.querySelector("figcaption");
      if (caption && !originals.some(item => item.caption === caption.textContent && item.label === caption.getAttribute("data-label")))
        repeats.push({ reason: "caption/label differs from original", caption: caption.textContent });
      if (caption && window.paginationGeometry().repeatTableHeader && !element.querySelector("th")) repeats.push({ reason: "missing repeated header" });
      const bounds = element.getBoundingClientRect();
      const top = (bounds.top - page.top) / scale;
      const bottom = (bounds.bottom - page.top) / scale;
      const geometry = window.paginationGeometry();
      const index = Math.floor(top / geometry.stride);
      const start = index * geometry.stride + geometry.margins.top;
      if (top < start - 1 || bottom > start + geometry.contentHeight + 1)
        repeats.push({ reason: "repeated furniture crosses page edge", top, bottom });
    }
    return { glyphs: geometry.bad, lines: geometry.lines, atoms: rects, repeats };
  };
  const signature = () => JSON.stringify(window.editor.getJSON());
  const mutate = (kind, salt) => {
    const editor = window.editor;
    const paragraphs = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph" && node.textContent.length > 10) paragraphs.push({ node, pos });
    });
    const chosen = paragraphs[salt % paragraphs.length];
    if (!chosen) throw Error("Stress mutation has no paragraph target");
    const start = performance.now();
    if (kind === 0) editor.commands.insertContentAt(chosen.pos + 1, " e\u0301 👩🏽‍💻 ");
    if (kind === 1) editor.commands.deleteRange({ from: chosen.pos + 1, to: chosen.pos + 7 });
    if (kind === 2) { editor.commands.setTextSelection(chosen.pos + 1 + Math.floor(chosen.node.content.size / 2)); editor.commands.splitBlock(); }
    if (kind === 3) editor.commands.insertContentAt(editor.state.doc.content.size, [{ type: "horizontalRule" }, { type: "paragraph", content: [{ type: "text", text: "Tambahan setelah pemisah." }] }]);
    if (kind === 4) editor.commands.insertContentAt(chosen.pos + 1, { type: "mathInline", attrs: { latex: "\\dfrac{a+b}{c+d}" } });
    return performance.now() - start;
  };
  window.paginationStress = { audit, signature, mutate, metrics, stop: () => clearInterval(heartbeat) };
}

async function runStress({ execute, until, win, artifacts }) {
  const seedText = process.env.HIGHTEX_PAGINATION_SEEDS ?? "7,41,2026,24301";
  const seeds = seedText.split(",").map(Number);
  assert.ok(seeds.length > 0 && seeds.length <= 50 && seeds.every(seed => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff), "Seeds must be 1–50 unsigned 32-bit integers");
  const caseFilter = process.env.HIGHTEX_PAGINATION_CASE;
  const report = { platform: process.platform, versions: process.versions, seeds, caseFilter, cases: [], failures: [], limitations: [
    "Editor stress only; does not establish parity with Paged.js or cross-platform behavior.",
    "Timing samples are diagnostics, not an acceptance threshold for human typing latency.",
  ] };
  let active = { name: "startup" };
  let firstEvidence;
  const flushReport = () => writeFileSync(path.join(artifacts, "stress-report.json"), JSON.stringify(report, null, 2));
  const check = async (name, action) => {
    if (caseFilter && name !== caseFilter) return;
    active = { name, operations: [] };
    firstEvidence = undefined;
    const start = Date.now();
    console.log("START stress:",name);
    try {
      await action();
      if (active.findings?.length) throw Error(`${active.findings.length} geometry checks failed; first: ${JSON.stringify(active.findings[0])}`);
      report.cases.push({ ...active, passed: true, ms: Date.now() - start, ...await execute("return {pages:layout().pages,...paginationStress.metrics()}") });
      console.log("PASS stress:", name, report.cases.at(-1).pages, "pages");
    } catch (error) {
      const failure = { ...active, message: String(error), ms: Date.now() - start };
      report.failures.push(failure);
      report.cases.push({ name, passed: false, ms: failure.ms });
      const folder = path.join(artifacts, name.replace(/[^a-z0-9-]/gi, "-"));
      mkdirSync(folder, { recursive: true });
      try {
        const state = firstEvidence ?? await execute("return {doc:editor.getJSON(),layout:layout(),audit:paginationStress.audit(),errors:window.errors}");
        writeFileSync(path.join(folder, "failure.json"), JSON.stringify({ ...failure, ...state }, null, 2));
        if (state.audit.glyphs.length) await execute(`const page=document.querySelector('.page');window.scrollTo(0,scrollY+page.getBoundingClientRect().top+${state.audit.glyphs[0].top}-160)`);
        writeFileSync(path.join(folder, "failure.png"), (await win.webContents.capturePage()).toPNG());
      } catch (captureError) { failure.captureError = String(captureError); }
      console.error("FAIL stress:", name, failure.message);
      if (win.webContents.isCrashed()) throw error;
    } finally { flushReport(); }
  };
  const settle = async () => {
    await until("layoutReady()&&document.fonts.status!=='loading'&&!document.querySelector('[data-pagination-measure]')");
    assert.equal(await execute("return Boolean(layout().error)"), false, "layout reported an error");
  };
  const audit = async () => {
    const result = await execute("return paginationStress.audit()");
    assert.ok(result.lines > 0, "geometry audit examined no text");
    for (const field of ["glyphs", "atoms", "repeats"]) {
      if (!result[field].length) continue;
      (active.findings ??= []).push({ field, count: result[field].length, operation: active.operations.length, first: result[field].slice(0,3) });
      if (!firstEvidence) firstEvidence = await execute("return {doc:editor.getJSON(),layout:layout(),audit:paginationStress.audit(),errors:window.errors}");
    }
    assert.deepEqual(await execute("return window.errors"), [], "uncaught renderer errors");
    assert.equal(await execute("return document.querySelectorAll('.editor-pagination-sheet').length"), await execute("return layout().pages"));
    assert.equal(await execute("return /data-editor-page-break|editor-pagination/.test(editor.getHTML())"), false, "layout decorations leaked into serialized HTML");
  };
  const install = async doc => {
    await execute(`window.setPages(false);const fixture=${JSON.stringify(doc)};editor.schema.nodeFromJSON(fixture).check();editor.commands.setContent(fixture);await waitSaved();await document.fonts.ready`);
    await until("Array.from(editor.view.dom.querySelectorAll('img')).every(image=>image.complete)");
    await execute("window.stressBaseline=paginationStress.signature();window.stressUpdates=updates;window.setPages(true)");
    await settle();
    const pageCount=await execute("return layout().pages");
    active.maxPages=Math.max(active.maxPages??0,pageCount);
    assert.equal(await execute("return paginationStress.signature()===stressBaseline"), true, "layout changed document JSON");
    assert.equal(await execute("return updates===stressUpdates"), true, "layout triggered autosave");
  };
  await execute(`(${installBrowserChecks.toString()})()`);
  const citeKey = await execute("return window.citeKey");
  const longDoc = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Long chapter" }] },
    ...Array.from({ length: 1200 }, (_, i) => ({ type: "paragraph", content: [{ type: "text", text: `Paragraf ${i}. ` + "Pengujian ketahanan editor dan batas halaman. ".repeat(6) }] }))] };
  try {
    await check("configurable-margins-and-repetition", async () => {
      const table = {type:"figureTable",content:[
        {type:"figcaption",content:[{type:"text",text:"Tabel konfigurasi"}]},
        {type:"table",content:Array.from({length:80},(_,i)=>({type:"tableRow",content:[0,1].map(j=>({type:i===0?"tableHeader":"tableCell",content:[{type:"paragraph",content:[{type:"text",text:`Baris ${i} kolom ${j}`}]}]}))}))},
      ]};
      await install({type:"doc",content:[{type:"heading",attrs:{level:1},content:[{type:"text",text:"Konfigurasi"}]},table]});
      const before = await execute("return paginationStress.signature()");
      for (const margins of [{top:20,right:25,bottom:40,left:35},{top:45,right:35,bottom:15,left:45}]) {
        for (const [header,caption] of [[true,true],[false,true],[true,false],[false,false]]) {
          active.operations.push({margins,header,caption});
          await execute(`editor.commands.configureEditorPagination({margins:${JSON.stringify(margins)},repeatTableHeader:${header},repeatTableCaption:${caption}})`);
          await settle(); await audit();
          const counts=await execute("return {furniture:layout().furniture.length,headers:document.querySelectorAll('.editor-pagination-furniture th').length,captions:document.querySelectorAll('.editor-pagination-furniture figcaption').length, padding:getComputedStyle(document.querySelector('.page')).paddingTop,width:editor.view.dom.getBoundingClientRect().width}");
          if(header||caption) assert.ok(counts.furniture>0);
          else assert.equal(counts.furniture,0);
          assert.equal(counts.headers>0,header);
          assert.equal(counts.captions>0,caption);
          assert.ok(Math.abs(parseFloat(counts.padding)-margins.top*96/25.4)<.1);
          assert.ok(Math.abs(counts.width-(210-margins.left-margins.right)*96/25.4)<.1);
          assert.equal(await execute("return paginationStress.signature()"),before,"options changed document JSON");
        }
      }
      const options=await execute("return JSON.stringify(paginationOptions())");
      assert.equal(await execute("try{editor.commands.configureEditorPagination({margins:{left:-1}});return false}catch{return true}"),true);
      assert.equal(await execute("return JSON.stringify(paginationOptions())"),options,"invalid options changed the active configuration");
      await execute("editor.commands.configureEditorPagination({margins:{top:30,right:30,bottom:30,left:30},repeatTableHeader:true,repeatTableCaption:true})");
      await settle(); await audit();
    });
    for (const seed of seeds) {
      const doc = buildDocument(seed, 30, citeKey);
      await check(`seed-${seed}-mixed`, async () => {
        await install(doc);
        await audit();
        const baseline = await execute("return paginationStress.signature()");
        const cached = await execute("return measureCached()");
        const fresh = await execute("return JSON.stringify(await measureFresh())");
        assert.equal(cached.signature, fresh, "cached/fresh layouts differ");
        await execute("for(let i=0;i<12;i++){window.setPages(false);window.setPages(true)}");
        await settle();
        assert.equal(await execute("return paginationStress.signature()"), baseline, "toggle changed the document");
        await audit();
        const signature = await execute("return JSON.stringify(layout())");
        const layouts = await execute("return window.layouts");
        await execute("await new Promise(resolve=>setTimeout(resolve,500))");
        const final = await execute("return JSON.stringify(layout())");
        if(final!==signature){
          writeFileSync(path.join(artifacts,`layout-drift-${seed}.json`),JSON.stringify({before:JSON.parse(signature),after:JSON.parse(final)},null,2));
        }
        assert.equal(final===signature,true,"settled layout drifted");
        assert.equal(await execute("return window.layouts"), layouts, "layout keeps recalculating without edits");
      });
      await check(`seed-${seed}-edit-undo-redo`, async () => {
        await install(doc);
        const next = random(seed);
        for (let i = 0; i < 10; i++) {
          const kind = i % 5, salt = Math.floor(next() * 100000);
          active.operations.push({ kind, salt });
          const before = await execute("closeHistory();return paginationStress.signature()");
          const transactionMs = await execute(`return paginationStress.mutate(${kind},${salt})`);
          await execute("closeHistory();await waitSaved()");
          await settle();
          const after = await execute("return paginationStress.signature()");
          assert.notEqual(after, before, "mutation did not change the document");
          await audit();
          await execute("editor.commands.undo();await waitSaved()");
          await settle();
          assert.equal(await execute("return paginationStress.signature()"), before, "undo did not restore exact JSON");
          await audit();
          await execute("editor.commands.redo();await waitSaved()");
          await settle();
          assert.equal(await execute("return paginationStress.signature()"), after, "redo did not restore exact JSON");
          await execute("editor.commands.undo();await waitSaved()");
          await settle();
          active.operations.at(-1).transactionMs = transactionMs;
        }
        const json = await execute("return editor.getJSON()");
        const saved = await execute("await waitSaved();return (await db.chapters.get('fixture.1')).content");
        // Normal chapters deliberately regenerate their H1 from chapter.title.
        assert.deepEqual(saved.slice(1), json.content.slice(1), "saved chapter body differs from editor contents");
        assert.equal(saved[0].type,"heading");
      });
    }
    await check("long-chapter-burst-and-cancellation", async () => {
      await install(longDoc);
      assert.ok(await execute("return layout().pages>70"), "long-chapter case is too small");
      await audit();
      const before = await execute("closeHistory();return paginationStress.signature()");
      const samples = await execute(`const samples=[];const pos=editor.state.doc.child(0).nodeSize+1;
        for(let i=0;i<60;i++){const start=performance.now();editor.commands.insertContentAt(pos+i,'x');samples.push(performance.now()-start);await new Promise(requestAnimationFrame)}
        closeHistory();await waitSaved();return samples;`);
      active.operations.push({ burstEdits: samples.length, transactionMs: samples });
      await settle(); await audit();
      await execute("editor.commands.undo();await waitSaved()"); await settle();
      assert.equal(await execute("return paginationStress.signature()"), before, "burst undo changed unrelated contents");
      await execute("editor.commands.insertContentAt(editor.state.doc.child(0).nodeSize+1,'configuration')");
      await until("document.querySelector('[data-pagination-measure]')");
      await execute("editor.commands.configureEditorPagination({margins:{top:22,bottom:38}})");
      await settle(); await audit();
      assert.equal(await execute("return paginationOptions().margins.top"),22);
      await execute("editor.commands.configureEditorPagination({margins:{top:30,bottom:30}})");
      await settle();
      // Start a pass, replace its captured document, then disable while the next
      // pass is in flight. A stale plan must never be applied to the replacement.
      await execute("editor.commands.insertContentAt(editor.state.doc.child(0).nodeSize+1,'start')");
      await until("document.querySelector('[data-pagination-measure]')");
      await execute(`editor.commands.setContent(${JSON.stringify(buildDocument(99, 10, citeKey))});window.setPages(false);await waitSaved()`);
      await until("!document.querySelector('[data-pagination-measure]')&&!document.querySelector('.editor-pagination-sheet')");
      await execute("window.stressBaseline=paginationStress.signature();window.setPages(true)");
      await settle(); await audit();
      assert.equal(await execute("return paginationStress.signature()===stressBaseline"), true);
    });
    await check("destroy-during-layout", async () => {
      await install(longDoc);
      await execute("editor.commands.insertContentAt(editor.state.doc.child(0).nodeSize+1,'pending');await waitSaved()");
      await until("document.querySelector('[data-pagination-measure]')");
      await execute("window.mountApplication()");
      await until("window.applicationEditor?.isEditable");
      await until("!document.querySelector('[data-pagination-measure]')&&!document.querySelector('.editor-pagination-sheets')");
      assert.deepEqual(await execute("return window.errors"), []);
    });
  } finally {
    await execute("paginationStress.stop()").catch(() => {});
    flushReport();
    console.log("Stress report:", path.join(artifacts, "stress-report.json"));
  }
  assert.ok(report.cases.length > 0,"No stress cases matched the selected case name");
  assert.equal(report.failures.length, 0, `${report.failures.length} stress cases failed; see stress-report.json`);
  console.log(`PASS: ${report.cases.length} stress cases across ${seeds.length} reproducible seeds.`);
}

module.exports = { buildDocument, random, runStress };
// Electron loads its entry differently from Node's require.main convention.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_PAGINATION_STRESS = "1";
  require("./editor-pagination.cjs");
}
