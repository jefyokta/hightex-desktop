const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");
const { measureContent, compareContent } = require("./editor-pdf-geometry.cjs");
const { containsPDFSourceText } = require("./page-plan-pdf.cjs");

function indexRows(targetLabels) {
  return Array.from(
    document.querySelectorAll(
      '[data-document-section="toc"],[data-document-section="tot"],[data-document-section="tof"]',
    ),
  ).flatMap((paper) => {
    const origin = paper.getBoundingClientRect();
    return Array.from(paper.querySelectorAll(".toc-row")).flatMap((row) => {
      const box = row.getBoundingClientRect();
      // Template column copies contain off-page rows. Only the visible column
      // belongs to this physical sheet; do not count clipped copies as entries.
      const visible = Array.from(
        row.querySelector(".toc-text").getClientRects(),
      ).some(
        (line) =>
          line.left >= origin.left &&
          line.right <= origin.right &&
          line.top >= origin.top &&
          line.bottom <= origin.bottom,
      );
      if (!visible) return [];
      const dots = row.querySelector(".toc-dots"),
        title = row.querySelector(".toc-text"),
        number = row.querySelector(".toc-page");
      const lines = title.getClientRects(),
        tail = lines[lines.length - 1],
        dot = dots.getBoundingClientRect(),
        page = number.getBoundingClientRect();
      const target = document
        .getElementById(row.dataset.headingId ?? row.dataset.captionId)
        ?.closest("[data-document-page]");
      return [
        {
          section: paper.dataset.documentSection,
          page: Number(paper.dataset.documentPage),
          level: row.classList.contains("subsub")
            ? 3
            : row.classList.contains("sub")
              ? 2
              : 1,
          title: title.innerText,
          label: number.textContent,
          targetLabel: targetLabels?.[row.dataset.headingId ?? row.dataset.captionId] ?? target?.dataset.pageLabel,
          dots: dots.textContent.length,
          wrapped: lines.length > 1,
          gap: page.left - dot.right,
          afterTitle: dot.left - tail.right,
          inside: box.top >= origin.top && box.bottom <= origin.bottom,
          bottomDifference: Math.abs(dot.bottom - page.bottom),
        },
      ];
    });
  });
}

async function setup({ execute, until }) {
  await execute(`
    const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
    window.equivalence={capture:captureDocumentPDF};
    const h=(id,text,level=1)=>({type:'heading',attrs:{id,level},content:[{type:'text',text}]});
    const para=(marker,count)=>p(marker+' '+sentence.repeat(count));
    const table=makeTable(14);table.attrs={id:'equivalence-table',figureId:'equivalence-table-figure'};
    table.content[0].content=[{type:'text',text:'Tabel pembuktian kesetaraan dengan judul panjang untuk daftar tabel '+sentence.repeat(2)}];
    table.content[1].content.forEach((row,index)=>row.content.forEach((cell,column)=>cell.content=[para('EQT'+String(index*2+column).padStart(3,'0'),index?2:1)]));
    const figure={type:'imageFigure',attrs:{id:'equivalence-image',figureId:'equivalence-image-figure'},content:[{type:'image',attrs:{src:'fixture-image',width:240}},{type:'figcaption',content:[{type:'text',text:'Gambar pembuktian kesetaraan '+sentence}]}]};
    await db.cite.put({key:'equivalence-cite',bib:'@book{equivalence-cite,title={Equivalence proof},author={Aria Writer},year={2025}}'});
    const input={type:'doc',content:[h('equivalence-h1','Pembuktian editor dan PDF '+sentence),para('EQA001',20),
      h('equivalence-h2','Subbab panjang '+sentence.repeat(2),2),
      {type:'paragraph',content:[{type:'text',text:'EQB001 Teks tebal dan miring. ',marks:[{type:'bold'},{type:'italic'}]},
        {type:'text',text:'Bergaris bawah. ',marks:[{type:'underline'}]},
        {type:'cite',attrs:{cite:'equivalence-cite'}},{type:'text',text:' '},{type:'mathInline',attrs:{latex:'x^2+1'}},
        {type:'hardBreak'},{type:'text',text:'EQB002 Baris berikutnya.'}]},
      h('equivalence-h3','Subsubbab pengujian',3),
      {type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[para('EQL001',4),{type:'bulletList',content:[{type:'listItem',content:[para('EQL002',3)]}]}]},{type:'listItem',content:[para('EQL003',3)]}]},
      table,figure,{type:'blockMath',attrs:{id:'equivalence-equation',latex:'E=mc^2'}},
      {type:'paragraph',content:[{type:'text',text:'EQR001 '},{type:'refComponent',attrs:{ref:'figureTable',link:'equivalence-table'}},{type:'text',text:'; '},{type:'refComponent',attrs:{ref:'equation',link:'equivalence-equation',label:'Persamaan pembuktian'}}]},
      {type:'codeBlock',attrs:{language:'javascript'},content:[{type:'text',text:['const EQC001 = true;','const EQC002 = 42;'].join(String.fromCharCode(10))}]},para('EQZ001',4)]};
    setPages(false);await prepareComparison(input);editor.commands.setContent(input);await waitSaved();await prepareComparison(editor.getJSON());
    // More than one index sheet, with all heading levels and wrapped titles.
    await db.chapters.put({id:'fixture.2',content:[h('index-extra','Bab tambahan untuk daftar'),...Array.from({length:32},(_,i)=>[h('index-extra-'+i,'Subbab indeks '+i+' '+(i%5===0?sentence:''),2),p('Isi singkat '+i)]).flat()]});
    const {getEditorChapter}=await import('/src/editor/event/index.ts');
    const context=getEditorChapter(editor).document;
    context.category={...context.category,chapters:[...context.category.chapters,{chapter:'2',title:'Bab tambahan untuk daftar'}]};
    setPages(true);await document.fonts.ready;
  `);
  await until(
    "layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')&&Array.from(editor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)')).every(image=>image.complete&&image.naturalWidth>0)",
  );
}

async function liveAndCapture({ execute }, options = {}) {
  return execute(`
    const {waitForEditorExport}=await import('/src/document-export/source/editor-readiness.ts');
    await waitForEditorExport(editor,new AbortController().signal);
    const paper=editor.view.dom.closest('.page');
    const surfaces=[{root:editor.view.dom,paper},...Array.from(paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper}))];
    equivalence.live=(${measureContent.toString()})(surfaces,paginationGeometry());
    equivalence.baseline={source:JSON.stringify(editor.getJSON()),plan:JSON.stringify(layout()),stored:JSON.stringify(await db.chapters.get('fixture.1')),selection:JSON.stringify(editor.state.selection.toJSON()),history:JSON.stringify(historyDepth()),updates};
    const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Equivalence capture deadline')),25000);
    const captureStart=performance.now();
    try{equivalence.snapshot=await equivalence.capture(editor,task.signal,undefined,${JSON.stringify(options)})}
    finally{equivalence.captureMs=performance.now()-captureStart;clearTimeout(timer)}
    return {live:equivalence.live,snapshot:equivalence.snapshot};
  `);
}

function verifyPDFMarkers(file, markers) {
  const bbox = execFileSync("pdftotext", ["-bbox", file, "-"], {
    encoding: "utf8",
  });
  const pages = Array.from(
    bbox.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g),
    (match) => match[1],
  );
  let maxX = 0,
    maxY = 0;
  for (const marker of markers) {
    const words = Array.from(
      pages[marker.page - 1].matchAll(
        /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g,
      ),
    );
    const expectedX = marker.x * 0.75,
      expectedY = marker.y * 0.75;
    const found = words.find(
      (word) =>
        word[5].includes(marker.text) &&
        Math.abs(Number(word[1]) - expectedX) < 1.5 &&
        Math.abs(Number(word[2]) - expectedY) < 2,
    );
    assert.ok(
      found,
      "Native PDF word moved from editor page/position: " +
        JSON.stringify(marker),
    );
    maxX = Math.max(maxX, Math.abs(Number(found[1]) - expectedX));
    maxY = Math.max(maxY, Math.abs(Number(found[2]) - expectedY));
  }
  return {
    markers: markers.length,
    maxXPoints: maxX,
    maxYPoints: maxY,
    toleranceXPoints: 1.5,
    toleranceYPoints: 2,
  };
}

exports.indexRows = indexRows;
exports.prepareEquivalence = setup;
exports.liveAndCapture = liveAndCapture;
exports.verifyPDFMarkers = verifyPDFMarkers;

exports.runEquivalence = async (context) => {
  const { execute, artifacts, editorPDFTest } = context;
  const report = {
    scope:
      "Visible live editor -> final print DOM -> native PDF; no comparison of two exported snapshots",
  };
  const save = () =>
    fs.writeFileSync(
      path.join(artifacts, "equivalence.json"),
      JSON.stringify(report, null, 2),
    );
  try {
    await setup(context);
    const { live, snapshot } = await liveAndCapture(context);
    fs.writeFileSync(path.join(artifacts, "captured.html"), snapshot.html);
    report.pages = snapshot.pages;
    report.sections = snapshot.sections;
    save();
    const section = snapshot.sections.find((section) => section.id === "1");
    const expected = {
      ...live,
      glyphs: live.glyphs.map((item) => ({
        ...item,
        page: item.page + section.firstPage - 1,
      })),
      images: live.images.map((item) => ({
        ...item,
        page: item.page + section.firstPage - 1,
      })),
    };
    let printed;
    editorPDFTest.inspectPrint(async (win) => {
      printed = await win.webContents.executeJavaScript(
        `({content:(${measureContent.toString()})(Array.from(document.querySelectorAll('[data-document-section="1"]')).map(paper=>({root:paper,paper,page:Number(paper.dataset.documentPage)}))),rows:(${indexRows.toString()})()})`,
      );
    });
    await execute(
      "await window.editorPDFExperimental.export(equivalence.snapshot,crypto.randomUUID())",
    );
    const file = editorPDFTest.outputs.at(-1),
      pdf = await PDFDocument.load(fs.readFileSync(file));
    fs.writeFileSync(
      path.join(artifacts, "content-geometry.json"),
      JSON.stringify({ expected, printed }, null, 2),
    );
    report.leaders = printed.rows;
    save();
    report.geometry = compareContent(expected, printed.content);
    save();
    assert.equal(pdf.getPageCount(), snapshot.pages);
    for (const row of printed.rows) {
      assert.ok(row.dots >= 3, "Missing leader: " + row.title);
      assert.equal(
        row.label,
        row.targetLabel,
        "Wrong page label: " + row.title,
      );
      assert.ok(
        row.gap >= 2 && row.inside,
        "Leader overlaps/wraps outside its row: " + JSON.stringify(row),
      );
    }
    for (const section of ["toc", "tot", "tof"])
      assert.ok(
        printed.rows.some((row) => row.section === section),
        "Missing index " + section,
      );
    for (const level of [1, 2, 3])
      assert.ok(
        printed.rows.some(
          (row) =>
            row.section === "toc" && row.level === level && row.dots >= 3,
        ),
        "Missing heading leader level " + level,
      );
    assert.ok(
      printed.rows.some((row) => row.wrapped),
      "Wrapped index entry not exercised",
    );
    assert.ok(
      snapshot.sections.find((section) => section.id === "toc").pages > 1,
      "TOC must span pages",
    );
    const text = execFileSync("pdftotext", ["-layout", file, "-"], {
      encoding: "utf8",
    }).split("\f");
    const raw = execFileSync("pdftotext", ["-raw", file, "-"], {
      encoding: "utf8",
    }).split("\f");
    for (const row of printed.rows) {
      assert.ok(
        containsPDFSourceText(row.title, text[row.page - 1], raw[row.page - 1]),
        "PDF lost index title " + row.title,
      );
      assert.ok(
        /\.{3}/.test(text[row.page - 1].replace(/\s/g, "")),
        "PDF missing leaders on index page " + row.page,
      );
    }
    for (const run of live.runs) {
      const page = run.page + section.firstPage - 1;
      assert.ok(
        containsPDFSourceText(run.text, text[page - 1], raw[page - 1]),
        "PDF source line differs on page " + page + ": " + run.text,
      );
    }
    report.pdf = {
      ...verifyPDFMarkers(
        file,
        live.words.map((item) => ({
          ...item,
          page: item.page + section.firstPage - 1,
        })),
      ),
      sourceTextRuns: live.runs.length,
    };
    save();
    report.integrity = await execute(`const before=equivalence.baseline;return {
      source:before.source===JSON.stringify(editor.getJSON()),plan:before.plan===JSON.stringify(layout()),stored:before.stored===JSON.stringify(await db.chapters.get('fixture.1')),
      selection:before.selection===JSON.stringify(editor.state.selection.toJSON()),history:before.history===JSON.stringify(historyDepth()),updates:before.updates===updates,errors:window.errors};`);
    for (const [key, value] of Object.entries(report.integrity))
      if (key === "errors") assert.deepEqual(value, []);
      else assert.equal(value, true, key);
    fs.copyFileSync(file, path.join(artifacts, "equivalence.pdf"));
    const toc = snapshot.sections.find((section) => section.id === "toc");
    execFileSync(
      "pdftoppm",
      [
        "-f",
        String(toc.firstPage),
        "-l",
        String(toc.firstPage),
        "-r",
        "96",
        "-singlefile",
        "-png",
        file,
        path.join(artifacts, "toc"),
      ],
      { timeout: 15000 },
    );
    report.passed = true;
    save();
    console.log(
      "PASS: live editor glyph/image/label geometry equals final print; native PDF marker pages/positions match; TOC/table/figure leaders include H1 and wrapped/multipage entries.",
    );
    console.log("Equivalence evidence:", artifacts);
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    save();
    throw error;
  } finally {
    editorPDFTest.inspectPrint(undefined);
  }
};
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE = "1";
  process.env.HIGHTEX_EDITOR_EQUIVALENCE = "1";
  require("./editor-pagination.cjs");
}
