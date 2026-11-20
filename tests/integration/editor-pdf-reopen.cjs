const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");

async function prepare({ execute, until }) {
  await execute(`
    const table=makeTable(45);table.attrs={id:'reopen-table',figureId:'reopen-table-figure'};
    const text=value=>({type:'text',text:value});
    await db.cite.put({key:'reopen-citation',documentId:'fixture',bib:'@book{reopen-citation,title={Reopen citation proof},author={Aria Writer},year={2026}}'});
    await db.chapters.put({id:'fixture.attachment',content:[{type:'heading',attrs:{id:'reopen-appendix',level:1},content:[text('Appendix source')]},p('REOPEN-APPENDIX-PROOF')]});
    const source={type:'doc',content:[
      {type:'heading',attrs:{id:'reopen-heading',level:1},content:[text('Introduction')]},
      ...Array.from({length:18},(_,index)=>({type:'paragraph',attrs:{id:'reopen-body-'+index},content:[text('REOPEN-BODY-'+index+' '+sentence.repeat(3))]})),
      {type:'paragraph',attrs:{id:'reopen-note'},content:[{type:'text',text:'Reopen marked text',marks:[{type:'bold'},{type:'italic'},{type:'note',attrs:{id:'reopen-note-id',note:'Saved note',created:'2026-11-15T00:00:00Z'}}]}]},
      table,
      {type:'imageFigure',attrs:{id:'reopen-image',figureId:'reopen-image-figure'},content:[{type:'image',attrs:{src:'fixture-image',width:180}},{type:'figcaption',content:[text('Reopen image caption')]}]},
      {type:'blockMath',attrs:{id:'reopen-equation',latex:'x^2+1'}},
      {type:'paragraph',attrs:{id:'reopen-references'},content:[
        {type:'refComponent',attrs:{ref:'figureTable',link:'reopen-table'}},text(' / '),
        {type:'refComponent',attrs:{ref:'imageFigure',link:'reopen-image'}},text(' / '),
        {type:'refComponent',attrs:{ref:'equation',link:'reopen-equation'}},text(' / '),
        {type:'refComponent',attrs:{ref:'head',link:'reopen-appendix'}},text(' / '),{type:'cite',attrs:{cite:'reopen-citation'}},
      ]},
      {type:'paragraph',attrs:{id:'reopen-last'},content:[text('REOPEN-END-PROOF')]},
    ]};
    await (await import('/src/editor/document/index.ts')).Document.instance.chapters.find(chapter=>chapter.getChapter()==='attachment').graph.sync();
    await prepareComparison(source);editor.commands.setContent(source);
    await waitSaved();await document.fonts.ready;
    editor.commands.insertContentAt(editor.state.doc.content.size-1,' REOPEN-SAVED-EDIT');await waitSaved();
    await prepareComparison(editor.getJSON());
    setPages(true);
  `);
  await ready({ execute, until });
}

async function ready({ execute, until }) {
  await until(
    "layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')",
  );
  await until(
    "Array.from(editor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)')).every(image=>image.complete&&image.naturalWidth>0)&&Array.from(editor.view.dom.querySelectorAll('cite')).every(node=>node.textContent&&!node.textContent.includes('Loading'))",
  );
  await until(
    "Array.from(editor.view.dom.querySelectorAll('#reopen-references [data-type=ref-component]'),node=>node.textContent).join('|')==='Tabel 1.1|Gambar 1.1|Persamaan 1|Lampiran A'",
  );
  await execute(
    "await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)",
  );
}

async function capture({ execute }) {
  return execute(`
    const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
    const {Storage}=await import('/src/editor/storage/index.ts');
    const {Document}=await import('/src/editor/document/index.ts');
    const {readDocumentSnapshot}=await import('/src/editor/storage/document-snapshot.ts');
    await Storage.instance.waitForDocument('fixture');
    const saved=JSON.stringify((await db.chapters.where('id').startsWith('fixture.').sortBy('id')).map(chapter=>({id:chapter.id,content:chapter.content})));
    const active=editor.getJSON(),selection=editor.state.selection.toJSON(),history=historyDepth(),count=updates;
    let identity;
    const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Reopen capture deadline')),25000);
    try{
      window.reopenSnapshot=await captureDocumentPDF(editor,task.signal,engine=>engine.events.once('rendered',()=>{identity=engine.identity}));
      const parsed=new DOMParser().parseFromString(reopenSnapshot.html,'text/html');
      const ids=Array.from(parsed.querySelectorAll('.editor-pdf-pages [id]'),node=>node.id);
      const links=Array.from(parsed.querySelectorAll('.editor-pdf-pages a[href^="#"]'),node=>decodeURIComponent(node.getAttribute('href').slice(1)));
      const snapshot=await readDocumentSnapshot('fixture');
      return {sourceHash:reopenSnapshot.sourceHash,planHash:reopenSnapshot.planHash,sections:reopenSnapshot.sections,pages:reopenSnapshot.pages,
        source:active,saved,ids,links,identity,livePlan:layout(),
        references:Array.from(editor.view.dom.querySelectorAll('#reopen-references [data-type=ref-component]'),node=>node.textContent),
        captions:Array.from(editor.view.dom.querySelectorAll('figure[id] figcaption[data-label]'),node=>node.dataset.label),
        sourceUnchanged:JSON.stringify(active)===JSON.stringify(editor.getJSON()),selectionUnchanged:JSON.stringify(selection)===JSON.stringify(editor.state.selection.toJSON()),
        historyUnchanged:JSON.stringify(history)===JSON.stringify(historyDepth()),noUpdates:count===updates,
        savedUnchanged:saved===JSON.stringify((await db.chapters.where('id').startsWith('fixture.').sortBy('id')).map(chapter=>({id:chapter.id,content:chapter.content}))),
        snapshotChapterCount:snapshot.chapters.length,editable:editor.isEditable,activeChapter:Document.current?.getId(),
        clean:document.querySelectorAll('.editor-pdf-pages,[data-pagination-measure]').length===0};
    }finally{clearTimeout(timer)}
  `);
}

async function print({ execute, editorPDFTest }, stage) {
  await execute(
    "await window.editorPDFExperimental.export(reopenSnapshot,crypto.randomUUID())",
  );
  const file = editorPDFTest.outputs.at(-1),
    pdf = await PDFDocument.load(fs.readFileSync(file));
  const pages = execFileSync("pdftotext", ["-raw", file, "-"], {
    encoding: "utf8",
  }).split("\f");
  for (const marker of [
    "REOPEN-SAVED-EDIT",
    "REOPEN-BODY-0",
    "REOPEN-END-PROOF",
    "REOPEN-APPENDIX-PROOF",
  ])
    assert.ok(
      pages.some((page) => page.includes(marker)),
      stage + " lost " + marker,
    );
  return { pages: pdf.getPageCount(), text: pages, file };
}

exports.runReopen = async (context) => {
  const { execute, until, win, artifacts } = context;
  const report = { reloads: 0 };
  const save = () =>
    fs.writeFileSync(
      path.join(artifacts, "save-reopen.json"),
      JSON.stringify(report, null, 2),
    );
  try {
    await prepare(context);
    report.before = await capture(context);
    save();
    const first = await print(context, "Before reload");
    const oldEditor = await execute(
      "return {timeOrigin:performance.timeOrigin,source:JSON.stringify(editor.getJSON())}",
    );
    console.log(
      "Reopen: baseline captured",
      first.pages,
      "PDF pages; reloading renderer",
    );
    await execute("await waitSaved();db.close()");
    const loaded = new Promise((resolve) =>
      win.webContents.once("did-finish-load", resolve),
    );
    win.webContents.reload();
    await loaded;
    await until("window.ready&&window.editor");
    report.reloads++;
    assert.notEqual(
      await execute("return performance.timeOrigin"),
      oldEditor.timeOrigin,
      "Renderer was not recreated",
    );
    await execute("setPages(true)");
    await ready(context);
    report.after = await capture(context);
    save();
    for (const phase of ["before", "after"]) {
      const result = report[phase];
      for (const field of [
        "sourceUnchanged",
        "selectionUnchanged",
        "historyUnchanged",
        "noUpdates",
        "savedUnchanged",
        "editable",
        "clean",
      ])
        assert.equal(result[field], true, phase + " " + field);
      assert.equal(result.activeChapter, "fixture.1");
      assert.equal(new Set(result.ids).size, result.ids.length);
      assert.ok(
        result.links.every((link) => result.ids.includes(link)),
        phase + " dead PDF link",
      );
    }
    for (const field of [
      "source",
      "saved",
      "sourceHash",
      "planHash",
      "sections",
      "pages",
      "ids",
      "links",
      "identity",
      "livePlan",
      "references",
      "captions",
    ])
      assert.deepEqual(
        report.after[field],
        report.before[field],
        "Reopening changed " + field,
      );
    const second = await print(context, "After reload");
    assert.equal(first.pages, second.pages);
    assert.deepEqual(
      second.text,
      first.text,
      "Native PDF page text moved after reopen",
    );
    report.nativePDF = {
      beforePages: first.pages,
      afterPages: second.pages,
      pageTextIdentical: true,
    };
    report.passed = true;
    save();
    fs.copyFileSync(first.file, path.join(artifacts, "before-reopen.pdf"));
    fs.copyFileSync(second.file, path.join(artifacts, "after-reopen.pdf"));
    console.log(
      "PASS: real renderer reload retains saved source/IDs/references, logical page plan and native PDF page text; capture preserves selection/history/storage and does not autosave.",
    );
    console.log("Reopen evidence:", artifacts);
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    report.referenceDebug = await execute(`
      const {Document}=await import('/src/editor/document/index.ts');
      return {references:Array.from(editor.view.dom.querySelectorAll('#reopen-references [data-link]'),node=>({text:node.textContent,target:node.dataset.link,status:node.querySelector('[data-status]')?.dataset.status})),
        graph:await Document.instance.getGraphs(),errors:window.errors};
    `).catch(() => undefined);
    save();
    throw error;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE = "1";
  process.env.HIGHTEX_EDITOR_PDF_REOPEN = "1";
  require("./editor-pagination.cjs");
}
