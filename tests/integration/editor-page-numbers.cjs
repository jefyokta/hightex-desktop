const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function footerAudit() {
  return Array.from(
    document.querySelectorAll(".editor-pdf-pages > .editor-page-fragment"),
    (paper) => {
      const number = paper.querySelector(".editor-pagination-number"),
        origin = paper.getBoundingClientRect(),
        box = number?.getBoundingClientRect();
      return {
        page: Number(paper.dataset.documentPage),
        section: paper.dataset.documentSection,
        label: paper.dataset.pageLabel,
        position: number?.dataset.position,
        width: origin.width,
        height: origin.height,
        box: box && {
          x: box.left - origin.left,
          y: box.top - origin.top,
          width: box.width,
          height: box.height,
        },
        count: paper.querySelectorAll(".editor-pagination-number").length,
      };
    },
  );
}
function verifyFooters(pages, geometry, positions) {
  for (const page of pages) {
    if (!page.label) {
      assert.equal(page.count, 0);
      continue;
    }
    assert.equal(page.count, 1, "One number per paper");
    const group =
      page.section === "attachment"
        ? "appendix"
        : /^[ivxlcdm]+$/.test(page.label)
          ? "introduction"
          : "chapters";
    const position = positions[group],
      box = page.box;
    assert.equal(page.position, position);
    const expectedY = position.startsWith("top")
      ? geometry.margins.top / 2
      : geometry.height - geometry.margins.bottom / 2;
    assert.ok(
      Math.abs(box.y - expectedY) < 0.1,
      "Wrong vertical placement: " + JSON.stringify(page),
    );
    const actual = position.endsWith("left")
      ? box.x
      : position.endsWith("right")
        ? box.x + box.width
        : box.x + box.width / 2;
    const expected = position.endsWith("left")
      ? geometry.margins.left
      : position.endsWith("right")
        ? geometry.width - geometry.margins.right
        : geometry.width / 2;
    assert.ok(
      Math.abs(actual - expected) < 0.1,
      "Wrong horizontal placement: " + JSON.stringify(page),
    );
  }
}
function verifyNativePDF(file, pages) {
  const bbox = execFileSync("pdftotext", ["-bbox", file, "-"], {
    encoding: "utf8",
  });
  const extracted = Array.from(
    bbox.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g),
    (match) => match[1],
  );
  assert.equal(extracted.length, pages.length);
  for (const page of pages) {
    if (!page.label) continue;
    const words = Array.from(
      extracted[page.page - 1].matchAll(
        /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g,
      ),
    ).filter((word) => Math.abs(Number(word[2]) - page.box.y * 0.75) < 2);
    assert.equal(
      words
        .map((word) => word[5])
        .join("")
        .replace(/\s/g, ""),
      page.label.replace(/\s/g, ""),
      "Native footer differs on page " + page.page,
    );
    assert.ok(
      Math.abs(Number(words[0][1]) - page.box.x * 0.75) < 1,
      "Native footer horizontal placement changed: "+JSON.stringify({page:page.page,label:page.label,expectedX:page.box.x*.75,actualX:Number(words[0][1])}),
    );
  }
}

exports.verifyNativePDF = verifyNativePDF;

exports.runPageNumbers = async (context) => {
  const { execute, until, artifacts, editorPDFTest } = context;
  const report = { cases: [] },
    save = () =>
      fs.writeFileSync(
        path.join(artifacts, "page-numbers.json"),
        JSON.stringify(report, null, 2),
      );
  try {
    await execute(`
      window.numbers={};
      const h=(id,text)=>({type:'heading',attrs:{id,level:1},content:[{type:'text',text}]});
      setPages(false);editor.commands.setContent({type:'doc',content:[h('numbers-main','Penempatan nomor halaman'),p(sentence.repeat(6))]});await waitSaved();await prepareComparison(editor.getJSON());
      await db.chapters.put({id:'fixture.foreword',content:[h('numbers-foreword','KATA PENGANTAR'),p(sentence.repeat(6))]});
      await db.chapters.put({id:'fixture.attachment',content:[h('numbers-appendix','Lampiran pengujian'),p('Isi lampiran.')]});
      editor.commands.configureEditorPagination({margins:{left:40,right:20}});setPages(true);
    `);
    const variants = [
      {
        name: "defaults",
        positions: {
          introduction: "bottom-center",
          chapters: "bottom-right",
          appendix: "bottom-right",
        },
      },
      {
        name: "top",
        positions: {
          introduction: "top-left",
          chapters: "top-center",
          appendix: "top-right",
        },
      },
      {
        name: "bottom",
        positions: {
          introduction: "bottom-left",
          chapters: "bottom-center",
          appendix: "bottom-right",
        },
      },
    ];
    for (const variant of variants) {
      await execute(
        `editor.commands.configureEditorPagination({pageNumbers:${JSON.stringify(variant.positions)}})`,
      );
      await until(
        "layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')",
      );
      const input = await execute(`
        const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
        numbers.before=JSON.stringify(editor.getJSON());numbers.stored=JSON.stringify(await db.chapters.get('fixture.1'));
        const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Page number capture deadline')),25000);
        try{numbers.snapshot=await captureDocumentPDF(editor,task.signal)}finally{clearTimeout(timer)}
        const live=editor.view.dom.closest('.page'),number=live.querySelector('.editor-pagination-number'),box=number.getBoundingClientRect(),origin=live.getBoundingClientRect();
        return {geometry:paginationGeometry(),pages:numbers.snapshot.pages,live:{position:number.dataset.position,x:box.left-origin.left,y:box.top-origin.top,width:box.width}};
      `);
      let printed;
      editorPDFTest.inspectPrint(
        async (win) =>
          (printed = await win.webContents.executeJavaScript(
            `(${footerAudit.toString()})()`,
          )),
      );
      await execute(
        "await window.editorPDFExperimental.export(numbers.snapshot,crypto.randomUUID())",
      );
      const file = editorPDFTest.outputs.at(-1);
      verifyFooters(printed, input.geometry, variant.positions);
      verifyNativePDF(file, printed);
      assert.equal(input.live.position, variant.positions.chapters);
      const body = printed.find((page) => page.section === "1");
      assert.ok(
        Math.abs(body.box.x - input.live.x) < 0.1 &&
          Math.abs(body.box.y - input.live.y) < 0.1,
        "Live/PDF position mismatch",
      );
      const unchanged = await execute(
        'return numbers.before===JSON.stringify(editor.getJSON())&&numbers.stored===JSON.stringify(await db.chapters.get("fixture.1"))',
      );
      assert.equal(unchanged, true);
      const output = path.join(
        artifacts,
        "page-numbers-" + variant.name + ".pdf",
      );
      fs.copyFileSync(file, output);
      report.cases.push({
        ...variant,
        ...input,
        printed,
        sourceUnchanged: unchanged,
        file: output,
      });
      save();
    }
    // The live surface must use the same group defaults for editable front matter
    // and appendix roots; this does not turn native templates into editors.
    report.liveGroups = await execute(`
      const paper=editor.view.dom.closest('.page'),result=[];
      for(const [className,group]of [['static-chapter','introduction'],['attachment-chapter','appendix']]){
        paper.classList.add(className);editor.commands.configureEditorPagination({pageNumbers:{introduction:'top-left',chapters:'top-center',appendix:'top-right'}});
        result.push({group,position:paper.querySelector('.editor-pagination-number').dataset.position});paper.classList.remove(className);
      }return result;
    `);
    assert.deepEqual(report.liveGroups, [
      { group: "introduction", position: "top-left" },
      { group: "appendix", position: "top-right" },
    ]);
    report.errors = await execute("return window.errors");
    assert.deepEqual(report.errors, []);
    report.passed = true;
    save();
    console.log(
      "PASS: introduction centered by default; all six configurable page-number placements match live/print/native PDF under asymmetric margins.",
    );
    console.log("Page number evidence:", artifacts);
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
  process.env.HIGHTEX_EDITOR_PAGE_NUMBERS = "1";
  require("./editor-pagination.cjs");
}
