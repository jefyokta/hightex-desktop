const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  prepareEquivalence,
  liveAndCapture,
  verifyPDFMarkers,
  indexRows,
} = require("./editor-pdf-equivalence.cjs");
const { measureContent, compareContent, measureProjectedSection } = require("./editor-pdf-geometry.cjs");
const { containsPDFSourceText } = require("./page-plan-pdf.cjs");
const { verifyNativePDF } = require("./editor-page-numbers.cjs");

function indexTitleAudit(snapshot) {
  const title=id=>document.querySelector(`a[data-heading-id="${id}"],a[data-caption-id="${id}"]`)?.querySelector('.toc-text');
  const styled=title('equivalence-h2'),main=title('equivalence-h1'),abstract=title('toc-review-abstract'),caption=title('equivalence-table');
  const appendix=title('toc-review-appendix');
  const section=snapshot.sections.find(section=>section.id==='attachment'),view=snapshot.projection.views[section.firstPage-1];
  const appendixHeading=document.querySelector(`[data-print-context="${view.context}"] #toc-review-appendix`);
  return {
    main:main.innerText,mainTransform:getComputedStyle(main).textTransform,
    abstract:abstract.innerText,abstractTransform:getComputedStyle(abstract).textTransform,
    appendix:appendix.innerText,appendixTransform:getComputedStyle(appendix).textTransform,
    appendixHeading:appendixHeading.innerText,appendixHeadingTransform:getComputedStyle(appendixHeading).textTransform,
    appendixPrefix:getComputedStyle(appendixHeading,'::before').content,
    sourceCase:styled.textContent,
    italic:getComputedStyle(styled.querySelector('em')).fontStyle,
    bold:getComputedStyle(styled.querySelector('strong')).fontWeight,
    underline:getComputedStyle(styled.querySelector('u')).textDecorationLine,
    code:styled.querySelector('code')?.textContent,
    captionItalic:getComputedStyle(caption.querySelector('em')).fontStyle,
    nestedLinks:styled.querySelectorAll('a').length,
    copiedIds:styled.querySelectorAll('[id]').length,
    controls:styled.querySelectorAll('[data-editor-ui],[data-editor-page-break],[contenteditable]').length,
  };
}

function sectionAudit(pages) {
  return Array.from(
    pages,
    ({element:paper,projection}) => {
      const doc = paper.ownerDocument,
        style = doc.defaultView.getComputedStyle(projection?.context??paper),
        origin = paper.getBoundingClientRect();
      const number = paper.querySelector(".editor-pagination-number"),
        box = number?.getBoundingClientRect();
      return {
        id: paper.dataset.documentSection,
        group: paper.dataset.documentGroup,
        label: paper.dataset.pageLabel,
        page: Number(paper.dataset.documentPage),
        margins: Object.fromEntries(
          ["top", "right", "bottom", "left"].map((side) => [
            side,
            parseFloat(style.getPropertyValue("padding-" + side)),
          ]),
        ),
        position: number?.dataset.position,
        footer: box && {
          x: box.left - origin.left,
          y: box.top - origin.top,
          width: box.width,
        },
        width: origin.width,
        height: origin.height,
      };
    },
  );
}
const mm = (value) => (value * 96) / 25.4;
function verifySections(pages, sections) {
  for (const page of pages) {
    const expected = {
      top: 30,
      right: 30,
      bottom: 30,
      left: 30,
      ...sections[page.group]?.margins,
    };
    for (const side of ["top", "right", "bottom", "left"])
      assert.ok(
        Math.abs(page.margins[side] - mm(expected[side])) < 0.1,
        "Margin leaked/ignored on " + page.id + " " + side,
      );
    if (!page.footer) continue;
    if (sections[page.group]?.pageNumber?.position)
      assert.equal(page.position, sections[page.group].pageNumber.position);
    const actual = page.position.endsWith("center")
      ? page.footer.x + page.footer.width / 2
      : page.position.endsWith("left")
        ? page.footer.x
        : page.footer.x + page.footer.width;
    const target = page.position.endsWith("center")
      ? page.width / 2
      : page.position.endsWith("left")
        ? mm(expected.left)
        : page.width - mm(expected.right);
    assert.ok(
      Math.abs(actual - target) < 0.1,
      "Footer uses another section geometry: " + page.id,
    );
    const y = page.position.startsWith("top")
      ? mm(expected.top) / 2
      : page.height - mm(expected.bottom) / 2;
    assert.ok(
      Math.abs(page.footer.y - y) < 0.1,
      "Footer vertical margin changed: " + page.id,
    );
  }
}

exports.runSectionOptions = async (context) => {
  const { execute, until, editorPDFTest, artifacts } = context;
  const report = {
      scope:
        "Unified options per logical introduction/content/appendix group, including number formats",
    },
    save = () =>
      fs.writeFileSync(
        path.join(artifacts, "section-options.json"),
        JSON.stringify(report, null, 2),
      );
  const sections = {
    introduction: {
      margins: { top: 25, right: 25, bottom: 35, left: 35 },
      pageNumber: { position: "bottom-center", format: "roman-upper" },
    },
    content: {
      margins: { top: 20, right: 25, bottom: 35, left: 35 },
      pageNumber: { position: "top-center", format: "roman-lower" },
    },
    appendix: {
      margins: { top: 25, right: 25, bottom: 35, left: 40 },
      pageNumber: { position: "bottom-center", format: "alpha-lower" },
    },
  };
  try {
    await prepareEquivalence(context);
    if(process.env.HIGHTEX_INDEX_CONTENT)await execute(`
      setPages(false);
      const input=editor.getJSON();
      input.content.find(node=>node.attrs?.id==='equivalence-h1').content=[{type:'text',text:'Mixed case main title'}];
      input.content.find(node=>node.attrs?.id==='equivalence-h2').content=[
        {type:'text',text:'Metode '},
        {type:'text',text:'Italic',marks:[{type:'italic'}]}, {type:'text',text:' '},
        {type:'text',text:'Bold',marks:[{type:'bold'}]}, {type:'text',text:' '},
        {type:'text',text:'Underline',marks:[{type:'underline'}]}, {type:'text',text:' '},
        {type:'text',text:'Code',marks:[{type:'code'}]}, {type:'text',text:' '},
        {type:'text',text:'Linked title',marks:[{type:'italic'},{type:'link',attrs:{href:'https://example.com/heading'}}]},
      ];
      input.content.find(node=>node.attrs?.id==='equivalence-table').content[0].content=[
        {type:'text',text:'Caption '},{type:'text',text:'Italic',marks:[{type:'italic'}]},
      ];
      editor.commands.setContent(input);await waitSaved();
      await db.chapters.put({id:'fixture.abstract-en',content:[{type:'heading',attrs:{id:'toc-review-abstract',level:1},content:[{type:'text',text:'abstract'}]},p('Short abstract body.')]});
      await db.chapters.put({id:'fixture.attachment',content:[{type:'heading',attrs:{id:'toc-review-appendix',level:1},content:[{type:'text',text:'Lampiran dengan Judul campuran'}]},p('Attachment body.')]});
      setPages(true);
    `);
    await execute(`
      const capture=equivalence.capture;
      equivalence.capture=(editor,signal,hooks,options)=>capture(editor,signal,engine=>{
        hooks?.(engine);
        engine.events.on('rendered',()=>{
          const labels=Object.fromEntries(engine.documentPages.flatMap(page=>(page.targets??[]).map(node=>[node.id,page.element.dataset.pageLabel])));
          window.sectionOptionsAudit={pages:(${sectionAudit.toString()})(engine.documentPages),rows:(${indexRows.toString()})(labels)};
        });
      },options);
    `);
    await execute(
      `editor.commands.configureEditorPagination({section:${JSON.stringify(sections.content)}})`,
    );
    await until(
      "layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')",
    );
    const { live, snapshot } = await liveAndCapture(context, { sections }),
      active = snapshot.sections.find((section) => section.id === "1");
    report.sections = sections;
    report.captureMs = await execute('return equivalence.captureMs');
    report.pages = snapshot.pages;
    report.pageSections = snapshot.sections;
    save();
    let printed;
    const audit=await execute('return sectionOptionsAudit');
    editorPDFTest.inspectPrint(async (win) => {
      const content = await win.webContents.executeJavaScript(
        `(async()=>{const snapshot=await window.editorPDFExperimental.init(new URLSearchParams(location.search).get('request'));
          return (${measureProjectedSection.toString()})(snapshot,'1',${measureContent.toString()});})()`,
      );
      printed={...audit,content};
      if(process.env.HIGHTEX_INDEX_CONTENT)
        printed.titles=await win.webContents.executeJavaScript(`(async()=>{const snapshot=await window.editorPDFExperimental.init(new URLSearchParams(location.search).get('request'));return (${indexTitleAudit.toString()})(snapshot)})()`);
    });
    await execute(
      "await window.editorPDFExperimental.export(equivalence.snapshot,crypto.randomUUID())",
    );
    const file = editorPDFTest.outputs.at(-1),
      offset = active.firstPage - 1;
    report.geometry = compareContent(
      live,
      printed.content,
    );
    if(process.env.HIGHTEX_INDEX_CONTENT){
      report.titles=printed.titles;
      assert.equal(report.titles.main,'MIXED CASE MAIN TITLE');
      assert.equal(report.titles.abstract,'ABSTRACT');
      assert.equal(report.titles.mainTransform,'uppercase');assert.equal(report.titles.abstractTransform,'uppercase');
      assert.equal(report.titles.appendix,'Lampiran dengan Judul campuran');
      assert.equal(report.titles.appendixHeading,'Lampiran dengan Judul campuran');
      assert.equal(report.titles.appendixTransform,'none');assert.equal(report.titles.appendixHeadingTransform,'none');
      assert.ok(report.titles.appendixPrefix.includes('LAMPIRAN '));
      assert.equal(report.titles.sourceCase,'Metode Italic Bold Underline Code Linked title');
      assert.equal(report.titles.italic,'italic');assert.ok(Number(report.titles.bold)>=600);
      assert.ok(report.titles.underline.includes('underline'));assert.equal(report.titles.code,'Code');
      assert.equal(report.titles.captionItalic,'italic');
      for(const key of ['nestedLinks','copiedIds','controls'])assert.equal(report.titles[key],0,key+' leaked to index');
    }
    verifySections(printed.pages, sections);
    report.printed=printed.pages;save();
    verifyNativePDF(
      file,
      printed.pages.map((page) => ({ ...page, box: page.footer })),
    );
    report.printed = printed.pages;
    assert.ok(printed.rows.length > 0);
    for (const row of printed.rows)
      {assert.ok(row.dots>=3,'Missing leader: '+row.title);assert.equal(
        row.label,
        row.targetLabel,
        "Index format differs from target",
      );}
    for(const level of [1,2,3])assert.ok(printed.rows.some(row=>row.section==='toc'&&row.level===level),'Missing heading leader '+level);
    report.indexRows = printed.rows.length;
    const layout = execFileSync("pdftotext", ["-layout", file, "-"], {
        encoding: "utf8",
      }).split("\f"),
      raw = execFileSync("pdftotext", ["-raw", file, "-"], {
        encoding: "utf8",
      }).split("\f");
    for (const run of live.runs)
      assert.ok(
        containsPDFSourceText(
          run.text,
          layout[run.page + offset - 1],
          raw[run.page + offset - 1],
        ),
        "Source line assigned to wrong PDF page",
      );
    report.pdf = {
      ...verifyPDFMarkers(
        file,
        live.words.map((word) => ({ ...word, page: word.page + offset })),
      ),
      sourceTextRuns: live.runs.length,
    };
    save();
    if(!process.env.HIGHTEX_INDEX_CONTENT){
    report.identity = await execute(`
      const initial=equivalence.snapshot;
      const changed=await equivalence.capture(editor,new AbortController().signal,undefined,{sections:${JSON.stringify({ ...sections, introduction: { ...sections.introduction, pageNumber: { position: "top-center", format: "decimal" } }, content: { ...sections.content, pageNumber: { position: "top-center", format: "alpha-upper" } }, appendix: { ...sections.appendix, pageNumber: { position: "bottom-center", format: "roman-upper" } } })}});
      equivalence.formatSnapshot=changed;
      return {sourceHash:initial.sourceHash===changed.sourceHash,planHash:initial.planHash!==changed.planHash,pages:initial.pages===changed.pages};
    `);
    assert.deepEqual(report.identity, {
      sourceHash: true,
      planHash: true,
      pages: true,
    });
    await execute(
      "await window.editorPDFExperimental.export(equivalence.formatSnapshot,crypto.randomUUID())",
    );
    const formatsFile = editorPDFTest.outputs.at(-1);
    const formatAudit=await execute('return sectionOptionsAudit');
    verifyNativePDF(
      formatsFile,
      formatAudit.pages.map((page) => ({ ...page, box: page.footer })),
    );
    report.formats = [
      "decimal",
      "roman-upper",
      "roman-lower",
      "alpha-upper",
      "alpha-lower",
    ];
    fs.copyFileSync(
      formatsFile,
      path.join(artifacts, "section-options-formats.pdf"),
    );
    report.mismatch = await execute(`
      const before=document.querySelectorAll('[data-pagination-surface],.editor-pdf-pages').length;
      const changed=await equivalence.capture(editor,new AbortController().signal,undefined,{sections:{content:{margins:{left:45}}}});
      return {recompiled:changed.planHash!==equivalence.snapshot.planHash,margin:Math.abs(sectionOptionsAudit.pages.find(page=>page.id==='1').margins.left-${mm(45)})<.1,
        clean:before===document.querySelectorAll('[data-pagination-surface],.editor-pdf-pages').length};
    `);
    assert.deepEqual(report.mismatch, {
      recompiled: true,
      margin:true,
      clean: true,
    });
    }
    report.integrity = await execute(
      `const before=equivalence.baseline;return {source:before.source===JSON.stringify(editor.getJSON()),stored:before.stored===JSON.stringify(await db.chapters.get('fixture.1')),plan:before.plan===JSON.stringify(layout()),selection:before.selection===JSON.stringify(editor.state.selection.toJSON()),history:before.history===JSON.stringify(historyDepth()),updates:before.updates===updates,errors:window.errors};`,
    );
    for (const [key, value] of Object.entries(report.integrity))
      if (key === "errors") assert.deepEqual(value, []);
      else assert.equal(value, true, key);
    fs.copyFileSync(file, path.join(artifacts, "section-options.pdf"));
    report.passed = true;
    save();
    console.log(
      "PASS: per-section margins/page numbers affect actual editor/template/index/appendix layout and PDF while preserving active-editor glyph parity; source edits are not adopted.",
    );
    console.log("Section options evidence:", artifacts);
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
  process.env.HIGHTEX_EDITOR_SECTION_OPTIONS = "1";
  require("./editor-pagination.cjs");
}
