// A bounded shared-plan experiment, not an installed PDF export route.
const assert = require("node:assert/strict");
const { BrowserWindow } = require("electron");
const { writeFileSync, mkdirSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const mixedMode = process.env.HIGHTEX_PAGE_PLAN_MIXED === "1";
const fragmentMode = process.env.HIGHTEX_PAGE_PLAN_FRAGMENTS === "1";
const {
  auditSurface,
  contractFor,
  verdict,
} = require("./editor-pagination-compare.cjs");

exports.printHTML = `<!doctype html><html><head><style>
@page{size:210mm 297mm;margin:0}
html,body{margin:0!important;padding:0!important;background:white!important}
.proof-sheet{position:relative;width:210mm;height:297mm;overflow:hidden;break-after:page}
.proof-sheet:last-child{break-after:auto}
.proof-viewport{position:absolute;left:0;overflow:hidden;width:210mm}
</style></head><body><main id="proof"></main><script type="module">
import '/src/App.css';import '/src/css/editor.css';import 'katex/dist/katex.css';
import '/tests/helpers/legacy-pagination/editor-page-fragments.css';
import {waitForPrintImages} from '/src/compiler/print-resources.ts';
window.installProof=async(html)=>{document.getElementById('proof').innerHTML=html;await waitForPrintImages(document.getElementById('proof'));await document.fonts.ready;};
window.ready=true;
</script></body></html>`;

exports.runPagePlan = async ({
  execute,
  until,
  win,
  artifacts,
  editorPDFTest,
}) => {
  const folder = path.join(artifacts, "shared-page-plan");
  mkdirSync(folder);
  console.log("Shared-plan evidence:", folder);
  await execute(`
    let serial=0;
    window.planParagraph=length=>{const marker='M'+String(++serial).padStart(6,'0')+'X';return {type:'paragraph',attrs:{id:'plan-'+marker},content:[{type:'text',text:marker+' '+sentence.repeat(length)}]}};
    ${process.env.HIGHTEX_PAGE_PLAN_LARGE_IMAGE ? `await db.images.update('fixture-image',{blob:new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1400"><rect width="400" height="1400" fill="#cbd5e1"/><text x="40" y="100" font-size="30">Tall fixture</text></svg>'],{type:'image/svg+xml'})});` : ""}
    const {toWebPBlob}=await import('/src/utils/images-to-webp.ts');
    const url=URL.createObjectURL((await db.images.get('fixture-image')).blob);
    try{const image=new Image();image.src=url;await image.decode();await db.images.update('fixture-image',{blob:await toWebPBlob(image)})}finally{URL.revokeObjectURL(url)};
    const table=makeTable(12);table.attrs={id:'shared-table',figureId:'shared-table-figure'};
    ${
      process.env.HIGHTEX_PAGE_PLAN_MERGED
        ? `
    const cell=(type,content,attrs={})=>({type,attrs,content});
    const row=content=>({type:'tableRow',content});
    table.content[1].content=[
      row([cell('tableHeader',[planParagraph(1)],{rowspan:2,colspan:${process.env.HIGHTEX_PAGE_PLAN_MERGED_COMPLEX ? 2 : 1}}),cell('tableHeader',[planParagraph(1)],{colspan:2})]),
      row([cell('tableHeader',[planParagraph(1)]),cell('tableHeader',[planParagraph(1)])]),
      ...Array.from({length:5},(_,group)=>[
        row([cell('tableCell',[planParagraph(9+group),planParagraph(5)],{rowspan:3,colspan:${process.env.HIGHTEX_PAGE_PLAN_MERGED_COMPLEX ? 2 : 1}}),cell('tableCell',[planParagraph(2)]),cell('tableCell',[planParagraph(4)])]),
        row([cell('tableCell',[planParagraph(3)],{colspan:2})]),
        row([cell('tableCell',[planParagraph(2)]),cell('tableCell',[planParagraph(2)])]),
      ]).flat(),
    ];
    ${process.env.HIGHTEX_PAGE_PLAN_COLUMN_WIDTHS ? `table.content[1].content[0].content[0].attrs.colwidth=${process.env.HIGHTEX_PAGE_PLAN_MERGED_COMPLEX ? "[90,90]" : "[180]"};table.content[1].content[0].content[1].attrs.colwidth=[160,220];` : ""}
    `
        : ""
    }
    table.content[0].content=planParagraph(1).content;
    table.content[1].content.forEach((row,index)=>row.content.forEach((cell,column)=>{
      const paragraphs=${process.env.HIGHTEX_PAGE_PLAN_MERGED ? "cell.content" : "[planParagraph(index===0?1:3)]"};
      ${mixedMode ? "paragraphs.forEach((paragraph,block)=>{let part=0;paragraph.content[0].text=paragraph.content[0].text.replaceAll(sentence,()=>sentence.trim()+' [R'+index+'C'+column+'B'+block+'S'+(++part)+'] ')});" : ""}
      cell.content=paragraphs;
    }));
    const figure={type:'imageFigure',attrs:{id:'shared-image',figureId:'shared-image-figure'},content:[{type:'image',attrs:{src:'fixture-image',width:${process.env.HIGHTEX_PAGE_PLAN_LARGE_IMAGE ? 1200 : 300}}},{type:'figcaption',content:planParagraph(${process.env.HIGHTEX_PAGE_PLAN_LONG_CAPTION ? 6 : 1}).content}]};
    window.planSource={type:'doc',content:[editor.getJSON().content[0],
      ...Array.from({length:10},(_,index)=>planParagraph(4+index%4)),
      {type:'heading',attrs:{level:2},content:[{type:'text',text:'Section with following content'}]},
      ${fragmentMode ? "{type:'heading',attrs:{level:3},content:[{type:'text',text:'A consecutive subsection with a deliberately long title that wraps across multiple lines on the page'}]}," : ""}
      {type:'orderedList',attrs:{start:3},content:[
        {type:'listItem',content:[planParagraph(${fragmentMode && !mixedMode ? 55 : 5}),{type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[planParagraph(${fragmentMode && !mixedMode ? 30 : 5})]}]}]},
        {type:'listItem',content:[planParagraph(5)]},
      ]},
      ${fragmentMode ? "{type:'bulletList',content:[{type:'listItem',content:[planParagraph(3)]},{type:'listItem',content:[planParagraph(3)]}]}," : ""}
      ${fragmentMode && !mixedMode ? "{type:'paragraph'}," : process.env.HIGHTEX_PAGE_PLAN_NO_CAPTION ? "figure.content[0],table," : "figure,table,"}{type:'horizontalRule'},${fragmentMode ? "{type:'horizontalRule'}," : ""}...Array.from({length:6},()=>planParagraph(5)),
    ]};
    ${
      fragmentMode
        ? `
    const first=planSource.content.find(node=>node.type==='paragraph');
    first.content[0].marks=[{type:'bold'},{type:'italic'}];
    first.content[0].text+=' Café e\\u0301 👩🏽‍💻 漢字.';
    const target=planSource.content.filter(node=>node.type==='paragraph').at(-1).attrs.id;
    first.content.push({type:'text',text:' Jump to destination.',marks:[{type:'link',attrs:{href:'#'+target}}]});
    first.content.push({type:'hardBreak'},{type:'text',text:'Whitespace  stays'+String.fromCharCode(10)+'on its own line.'});
    `
        : ""
    }
    ${
      process.env.HIGHTEX_PAGE_PLAN_CITATIONS
        ? `
    await db.cite.put({key:'cite-fixture-alpha',bib:'@book{cite-fixture-alpha,title={Citation proof},author={Aria Writer},year={2024}}'});
    await db.cite.put({key:'cite-fixture-beta',bib:'@book{cite-fixture-beta,title={Second proof},author={Bima Researcher},year={2023}}'});
    const citation=(cite,attrs={})=>({type:'cite',attrs:{cite,...attrs}});
    const cited=planParagraph(32);cited.content.unshift(citation('cite-fixture-alpha',{citeA:true}));
    cited.content.push({type:'text',text:' After the long paragraph: '},citation('cite-fixture-alpha|cite-fixture-beta'),{type:'text',text:' Citation remains complete.'});
    planSource.content.splice(3,0,cited,{type:'paragraph',attrs:{id:'citation-only'},content:[citation('cite-fixture-beta')]},
      {type:'paragraph',attrs:{id:'manual-citation'},content:[citation('',{manual:true,text:'Manual Writer',year:'2025',citeA:true}),{type:'text',text:' and '},citation('',{manual:true,text:'Manual Parenthetical',year:'2022'})]});
    const tableParagraph=table.content[1].content[2].content[0].content[0];
    tableParagraph.content.unshift(citation('cite-fixture-beta',{citeA:true}),{type:'text',text:' '});
    `
        : ""
    }
    editor.commands.setContent(planSource);await waitSaved();await prepareComparison(editor.getJSON());
    const {Exporter}=await import('/src/utils/htx/exporter.ts');const {readImportModel}=await import('/src/utils/htx/import-model.ts');
    window.planModel=readImportModel((await new Exporter('fixture').buildExport()).buffer);
    ${process.env.HIGHTEX_PAGE_PLAN_ASYMMETRIC ? "editor.commands.configureEditorPagination({margins:{top:20,right:25,bottom:35,left:35},repeatTableHeader:false,repeatTableCaption:false});" : ""}
    ${process.env.HIGHTEX_PAGE_PLAN_REPEAT ? `editor.commands.configureEditorPagination({repeatTableHeader:${process.env.HIGHTEX_PAGE_PLAN_REPEAT === "header"},repeatTableCaption:${process.env.HIGHTEX_PAGE_PLAN_REPEAT === "caption"}});` : ""}
    await document.fonts.ready;
  `);
  await until(
    `editor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)').length===${fragmentMode && !mixedMode ? 0 : 1}&&Array.from(editor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)')).every(image=>image.complete&&image.naturalWidth>0)`,
  );
  await execute("await document.fonts.ready;window.setPages(true)");
  await until(
    "layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')",
  );
  if (process.env.HIGHTEX_PAGE_PLAN_LARGE_IMAGE) {
    const fitted = await execute(
      "return {json:JSON.stringify(editor.getJSON()),height:editor.view.dom.querySelector('img:not(.ProseMirror-separator)').getBoundingClientRect().height,scales:layout().scales}",
    );
    await execute("window.setPages(false)");
    const continuous = await execute(
      "return editor.view.dom.querySelector('img:not(.ProseMirror-separator)').getBoundingClientRect().height",
    );
    assert.ok(
      continuous > fitted.height + 1,
      "Disabling pagination did not restore the image size",
    );
    await execute("window.setPages(true)");
    await until(
      "layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')",
    );
    const repeated = await execute(
      "return {json:JSON.stringify(editor.getJSON()),height:editor.view.dom.querySelector('img:not(.ProseMirror-separator)').getBoundingClientRect().height,scales:layout().scales,limit:paginationGeometry().contentHeight}",
    );
    assert.equal(repeated.json, fitted.json);
    assert.ok(repeated.height <= repeated.limit + 1);
    assert.ok(
      Math.abs(repeated.height - fitted.height) < 1,
      "Image fitting depends on the previous layout",
    );
    assert.ok(
      Math.abs(repeated.scales[0].scale - fitted.scales[0].scale) < 0.0001,
    );
    writeFileSync(
      path.join(folder, "image-fit.json"),
      JSON.stringify({ fitted, continuous, repeated }, null, 2),
    );
  }
  const source = await execute("return editor.getJSON()");
  const contract = contractFor(source);
  const captured = await execute(`
    const {ReadOnlyChapter}=await import('/src/editor/chapter/read-only-chapter.ts');
    const {Document}=await import('/src/editor/document/index.ts');const {Chapter}=await import('/src/editor/chapter/chapter.ts');
    const {applyPageGeometry}=await import('/src/editor/pagination/options.ts');
    const {waitForPrintImages}=await import('/src/compiler/print-resources.ts');
    window.planDoc=editor.state.doc;window.recordedPlan=structuredClone(layout());window.planGeometry=window.paginationGeometry();
    window.planBaseline={source:JSON.stringify(editor.getJSON()),stored:JSON.stringify(await db.chapters.get('fixture.1')),updates,layout:JSON.stringify(layout())};
    window.planActive={document:Document.instance,current:Document.current,chapter:Chapter.instance};
    const host=document.createElement('div');host.className='page';host.dataset.paginationSurface='';
    host.style.cssText='position:absolute;left:1200px;top:0;margin:0';applyPageGeometry(host,planGeometry);document.body.append(host);
    window.planHost=host;window.readOnlyPlan=new ReadOnlyChapter(host,planDoc,planModel${fragmentMode ? ",undefined,undefined,(await import('/tests/helpers/captured-chapter-node-views.ts')).capturedChapterNodeViews(planDoc,editor.view,document)" : ""});
    await waitForPrintImages(readOnlyPlan.view.dom);await document.fonts.ready;
    readOnlyPlan.applyLayout(planDoc,recordedPlan);
    const imageBounds=(root,paper)=>{const origin=paper.getBoundingClientRect();return Array.from(root.querySelectorAll('img:not(.ProseMirror-separator)'),image=>{const box=image.getBoundingClientRect();return {left:box.left-origin.left,top:box.top-origin.top,width:box.width,height:box.height}})};
    const captionMetrics=root=>Array.from(root.querySelectorAll('figcaption'),node=>{const box=node.getBoundingClientRect(),style=getComputedStyle(node);return {label:node.dataset.label,width:box.width,height:box.height,font:style.font,whiteSpace:style.whiteSpace,before:getComputedStyle(node,'::before').content}});
    const cellMetrics=(root,paper)=>{const origin=paper.getBoundingClientRect();return Array.from(root.querySelectorAll('td,th'),cell=>{const box=cell.getBoundingClientRect();return {left:box.left-origin.left,top:box.top-origin.top,width:box.width,height:box.height,colspan:cell.colSpan,rowspan:cell.rowSpan}})};
    const narrativeIds=[];planDoc.descendants(node=>{if(node.type.name==='table')return false;if(['paragraph','heading'].includes(node.type.name)&&node.attrs.id)narrativeIds.push(node.attrs.id);return true});
    return {pages:recordedPlan.pages,breaks:recordedPlan.breaks.length,noUI:!readOnlyPlan.view.dom.querySelector('button,input,textarea'),sameDoc:readOnlyPlan.view.state.doc===planDoc,noPlugins:readOnlyPlan.view.state.plugins.length===0,narrativeIds,sourceImages:imageBounds(editor.view.dom,editor.view.dom.closest('.page')),readOnlyImages:imageBounds(readOnlyPlan.view.dom,planHost),sourceCaptions:captionMetrics(editor.view.dom),readOnlyCaptions:captionMetrics(readOnlyPlan.view.dom),sourceCells:cellMetrics(editor.view.dom,editor.view.dom.closest('.page')),readOnlyCells:cellMetrics(readOnlyPlan.view.dom,planHost)};
  `);
  writeFileSync(
    path.join(folder, "captured.json"),
    JSON.stringify(captured, null, 2),
  );
  assert.ok(captured.pages > 1 && captured.breaks > 0);
  assert.equal(captured.noUI, true);
  assert.equal(captured.sameDoc, true);
  assert.equal(captured.noPlugins, true);
  assert.equal(captured.sourceImages.length, captured.readOnlyImages.length);
  if (process.env.HIGHTEX_PAGE_PLAN_LARGE_IMAGE)
    for (const image of captured.sourceImages)
      assert.ok(
        Math.abs(image.width / image.height - 400 / 1400) < 0.0001,
        "Image fitting changed its aspect ratio",
      );
  if (fragmentMode) {
    assert.equal(captured.sourceCells.length, captured.readOnlyCells.length);
    captured.sourceCells.forEach((cell, index) => {
      for (const key of ["top", "left", "width", "height"])
        assert.ok(
          Math.abs(cell[key] - captured.readOnlyCells[index][key]) < 1,
          `Read-only cell geometry changed: ${index} ${key}`,
        );
    });
    assert.equal(
      captured.sourceCaptions.length,
      captured.readOnlyCaptions.length,
    );
    captured.sourceCaptions.forEach((caption, index) => {
      assert.equal(
        captured.readOnlyCaptions[index].label,
        caption.label,
        "Read-only caption label changed",
      );
      assert.ok(
        Math.abs(caption.height - captured.readOnlyCaptions[index].height) < 1,
        "Read-only caption wrapping changed",
      );
    });
  }
  if (fragmentMode)
    captured.sourceImages.forEach((image, index) => {
      for (const key of ["top", "left", "width", "height"])
        assert.ok(
          Math.abs(image[key] - captured.readOnlyImages[index][key]) < 1,
          `Read-only image geometry changed: ${key} ${JSON.stringify({ source: image, readOnly: captured.readOnlyImages[index] })}`,
        );
    });
  const audit = await execute(
    `return (${auditSurface.toString()})('editor',${JSON.stringify(contract)},{root:readOnlyPlan.view.dom,paper:planHost,furniture:Array.from(planHost.querySelectorAll('.editor-pagination-furniture')),layout:recordedPlan,geometry:planGeometry})`,
  );
  const editorAudit = await execute(
    `return (${auditSurface.toString()})('editor',${JSON.stringify(contract)},{root:editor.view.dom,paper:editor.view.dom.closest('.page'),furniture:Array.from(editor.view.dom.closest('.page').querySelectorAll('.editor-pagination-furniture')),layout:layout(),geometry:window.paginationGeometry()})`,
  );
  writeFileSync(
    path.join(folder, "audit.json"),
    JSON.stringify({ captured, audit, editorAudit }, null, 2),
  );
  if (
    process.env.HIGHTEX_PAGE_PLAN_LARGE_IMAGE &&
    !verdict(editorAudit).figureCaptions
  ) {
    const rejectsUnsafeSource = await execute(`
      const {PageFragments}=await import('/tests/helpers/legacy-pagination/fragments.ts');
      const host=document.createElement('div');document.body.append(host);let rejected=false;
      try{await new PageFragments(readOnlyPlan,planGeometry).render(host,new AbortController().signal)}catch(error){rejected=error.message.includes('image')&&!host.childNodes.length}finally{host.remove()}
      return rejected;
    `);
    writeFileSync(
      path.join(folder, "source-rejection.json"),
      JSON.stringify(
        { rejectsUnsafeSource, layout: await execute("return recordedPlan") },
        null,
        2,
      ),
    );
    assert.equal(
      rejectsUnsafeSource,
      true,
      "Unsafe source image plan reached the fragment renderer",
    );
  }
  for (const [check, passed] of Object.entries(verdict(audit)))
    assert.equal(passed, true, `Read-only quality: ${check}`);
  for (const [check, passed] of Object.entries(verdict(editorAudit)))
    assert.equal(passed, true, `Editor quality: ${check}`);
  assert.deepEqual(
    audit.markerPages,
    editorAudit.markerPages,
    "A shared plan changed source-page assignments",
  );
  const output = fragmentMode
    ? await require("./editor-page-fragments.cjs").materialize({
        execute,
        contract,
        folder,
      })
    : await execute(`
    // Test-only sheet viewports paint already positioned flow. No planner runs
    // here. Whole-flow copies are intentionally bounded to this small fixture.
    const result=document.createElement('main');
    for(let index=0;index<recordedPlan.pages;index++) {
      const sheet=document.createElement('section');sheet.className='proof-sheet';
      const viewport=document.createElement('div');viewport.className='proof-viewport';
      viewport.style.top=planGeometry.margins.top+'px';viewport.style.height=planGeometry.contentHeight+'px';
      const flow=planHost.cloneNode(true);flow.style.cssText=planHost.style.cssText;
      flow.style.position='absolute';flow.style.left='0';flow.style.margin='0';flow.style.top=(-index*planGeometry.stride-planGeometry.margins.top)+'px';
      flow.style.boxShadow='none';flow.style.borderRadius='0';
      viewport.append(flow);sheet.append(viewport);result.append(sheet);
    }
    let rejectsStale=false,rejectsFailed=false;
    try{readOnlyPlan.applyLayout(planDoc.type.schema.nodeFromJSON(editor.getJSON()),recordedPlan)}catch{rejectsStale=true}
    try{readOnlyPlan.applyLayout(planDoc,{...recordedPlan,error:true})}catch{rejectsFailed=true}
    return {html:result.innerHTML,rejectsStale,rejectsFailed,plan:recordedPlan};
  `);
  assert.equal(output.rejectsStale, true);
  assert.equal(output.rejectsFailed, true);
  if (process.env.HIGHTEX_PAGE_PLAN_LARGE_IMAGE)
    assert.ok(
      output.plan.scales.length > 0,
      "Tall image did not exercise recorded scaling",
    );
  writeFileSync(
    path.join(folder, "page-plan.json"),
    JSON.stringify(output.plan, null, 2),
  );
  let printWindow;
  try {
    printWindow = new BrowserWindow({
      show: false,
      width: 1100,
      height: 1300,
      webPreferences: { backgroundThrottling: false },
    });
    await printWindow.loadURL(
      new URL("/editor-page-plan-print.html", win.webContents.getURL()).href,
    );
    await printWindow.webContents.executeJavaScript(
      `window.installProof(${JSON.stringify(output.html)})`,
    );
    const pdf = await printWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    const pdfPath = path.join(folder, "shared-plan.pdf");
    writeFileSync(pdfPath, pdf);
    const { PDFDocument } = require("pdf-lib");
    assert.equal((await PDFDocument.load(pdf)).getPageCount(), captured.pages);
    if (fragmentMode)
      await require("./editor-page-fragments.cjs").verifyPdf({
        pdf,
        printWindow,
        output,
        contract,
        folder,
      });
    const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
      encoding: "utf8",
    });
    writeFileSync(path.join(folder, "shared-plan.txt"), text);
    // Layout extraction may move emoji above a line because of fallback-font
    // bounds. Source-order extraction checks narrative text without that sort.
    const narrativeText = fragmentMode
      ? execFileSync("pdftotext", ["-raw", pdfPath, "-"], { encoding: "utf8" })
      : text;
    if (fragmentMode)
      writeFileSync(path.join(folder, "shared-plan-raw.txt"), narrativeText);
    require("./page-plan-pdf.cjs").verifyPagePlanText({
      text,
      raw: narrativeText,
      contract,
      markerPages: editorAudit.markerPages,
      ranges: fragmentMode ? output.pages : undefined,
      narrativeIds: captured.narrativeIds,
    });
    const compact = (value) => value.replace(/[\s\u2060\u00ad]/g, "");
    if (fragmentMode) {
      assert.ok(
        text.includes("1.1 Section with following content"),
        "Fragment heading numbering changed",
      );
      assert.ok(
        compact(text).includes("1.1.1Aconsecutivesubsection"),
        "Consecutive subsection numbering changed",
      );
      assert.ok(
        narrativeText.includes(
          "destination.\nWhitespace stays\non its own line.",
        ),
        "Authored hard break or newline lost its line boundary",
      );
    }
    if (editorPDFTest)
      await editorPDFTest.run({
        execute,
        until,
        win,
        folder,
        contract,
        editorAudit,
        fragmentOutput: output,
        ranges: output.pages,
        narrativeIds: captured.narrativeIds,
      });
    const integrity = await execute(`
      const {Document}=await import('/src/editor/document/index.ts');const {Chapter}=await import('/src/editor/chapter/chapter.ts');
      const result={source:JSON.stringify(editor.getJSON())===planBaseline.source,stored:JSON.stringify(await db.chapters.get('fixture.1'))===planBaseline.stored,updates:updates===planBaseline.updates,plan:JSON.stringify(layout())===planBaseline.layout,context:Document.instance===planActive.document&&Document.current===planActive.current&&Chapter.instance===planActive.chapter};
      readOnlyPlan.destroy();readOnlyPlan.destroy();planHost.remove();return result;
    `);
    assert.deepEqual(integrity, {
      source: true,
      stored: true,
      updates: true,
      plan: true,
      context: true,
    });
    console.log(
      fragmentMode
        ? "PASS: bounded source fragments and native PDF retain exact source coverage, unique anchors, list numbering and recorded marker-page assignments without full-chapter copies or a second planner."
        : "PASS: readonly schema view and native PDF consume the recorded editor page plan with identical marker-page assignments and complete narrative paragraphs; no source/storage/plan mutation, live editor plugins or second pagination pass.",
    );
  } finally {
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
    await execute("window.readOnlyPlan?.destroy();window.planHost?.remove()");
    if (fragmentMode)
      await execute(
        "window.pageFragments?.destroy();window.fragmentHost?.remove()",
      );
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_PAGE_PLAN = "1";
  require("./editor-pagination.cjs");
}
