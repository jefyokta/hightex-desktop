const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");
const { containsPDFSourceText } = require("./page-plan-pdf.cjs");

const stable = async ({ until }) =>
  until(
    "!editor.view.composing&&layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')",
  );
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setup(context) {
  await context.execute(`
    window.ime={events:[],outcomes:[]};
    ime.source={type:'doc',content:[editor.getJSON().content[0],p(sentence.repeat(38)),p('IME-END')]};
    ime.install=async()=>{
      setPages(false);editor.commands.setContent(ime.source);await waitSaved();
      await prepareComparison(editor.getJSON());setPages(true);
    };
    ime.saved=async()=>JSON.stringify((await db.chapters.get('fixture.1')).content)===JSON.stringify(editor.getJSON().content);
    ime.select=()=>{
      const point=layout().breaks.find(item=>item.kind==='line');if(!point)throw Error('No inline page break');
      closeHistory();editor.commands.setTextSelection(point.from);editor.view.focus();
      ime.original=editor.state.doc;ime.from=point.from;ime.history=historyDepth();
    };
    ime.dom=editor.view.dom;
    ime.listen=event=>ime.events.push({type:event.type,data:event.data,inputType:event.inputType,composing:event.isComposing,trusted:event.isTrusted});
    for(const type of ['compositionstart','compositionupdate','compositionend','beforeinput'])editor.view.dom.addEventListener(type,ime.listen);
    ime.start=async kind=>{
      const task=new AbortController();ime.task=task;ime.result={status:'pending'};
      const timer=setTimeout(()=>task.abort(new Error('IME fixture capture deadline')),25000);
      const {waitForEditorExport}=await import('/src/document-export/source/editor-readiness.ts');
      const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
      ime.work=(kind==='capture'?captureDocumentPDF(editor,task.signal):waitForEditorExport(editor,task.signal))
        .then(result=>{ime.result={status:'resolved',sourceText:result.source?.textContent};if(kind==='capture')ime.snapshot=result},error=>{ime.result={status:'rejected',message:error.message}})
        .finally(()=>clearTimeout(timer));
    };
    await ime.install();await document.fonts.ready;
  `);
  await stable(context);
}

async function composition(context, text) {
  await context.win.webContents.debugger.sendCommand(
    "Input.imeSetComposition",
    { text, selectionStart: text.length, selectionEnd: text.length },
  );
}
async function begin(context) {
  await context.execute("ime.select()");
  await composition(context, "nihon");
  await context.until(
    'editor.view.composing&&editor.state.doc.textContent.includes("nihon")',
  );
}
async function commit(context, text) {
  await context.win.webContents.debugger.sendCommand("Input.insertText", {
    text,
  });
  await stable(context);
  await context.execute("await waitSaved()");
}

async function captureDuringComposition(context, save, report) {
  const { execute } = context;
  await begin(context);
  await execute(`await ime.start('${context.print === false ? 'ready' : 'capture'}');ime.layouts=layouts`);
  await pause(250);
  report.waitBeforeUpdate = await execute(
    'return {result:ime.result,composing:editor.view.composing,layouts:layouts-ime.layouts,measuring:document.querySelectorAll("[data-pagination-measure]").length}',
  );
  save();
  assert.equal(report.waitBeforeUpdate.result.status, "pending");
  assert.equal(
    report.waitBeforeUpdate.layouts,
    0,
    "Pagination changed during composition",
  );
  assert.equal(report.waitBeforeUpdate.measuring, 0);
  await composition(context, "にほん");
  await pause(250);
  report.waitAfterUpdate = await execute(
    "return {result:ime.result,composing:editor.view.composing,layouts:layouts-ime.layouts,events:ime.events,focused:document.activeElement===editor.view.dom}",
  );
  save();
  assert.equal(
    report.waitAfterUpdate.result.status,
    "pending",
    "Export must wait through provisional IME updates",
  );
  assert.equal(report.waitAfterUpdate.layouts, 0);
  await commit(context, "日本語");
  await context.until('ime.result.status!=="pending"', 25000);
  if (context.print !== false) fs.writeFileSync(
    path.join(context.artifacts, "ime-result.html"),
    await execute('return ime.snapshot?.html??""'),
  );
  report.commit = context.print === false ? await execute(`
    const expected=nativeEditor.EditorState.create({doc:ime.original}).tr.insertText('日本語',ime.from).doc;
    return {result:ime.result,source:editor.state.doc.eq(expected),selection:editor.state.selection.from===ime.from+'日本語'.length,
      saved:await ime.saved(),hasCommitted:ime.result.sourceText?.includes('日本語'),
      noProvisional:!ime.result.sourceText?.includes('nihon')&&!ime.result.sourceText?.includes('にほん'),
      pages:layout().pages,events:ime.events};
  `) : await execute(`
    const expected=nativeEditor.EditorState.create({doc:ime.original}).tr.insertText('日本語',ime.from).doc;
    const parsed=new DOMParser().parseFromString(ime.snapshot?.html??'','text/html');
    const boundaries=[0,...layout().breaks.map(cut=>cut.from),editor.state.doc.content.size];
    const activePages=Array.from(parsed.querySelectorAll('[data-document-section="1"]'),(page,index)=>({
      page:Number(page.dataset.documentPage),text:editor.state.doc.textBetween(boundaries[index],boundaries[index+1]),rendered:page.querySelector('.tiptap').textContent,
    }));
    return {activePages,result:ime.result,source:editor.state.doc.eq(expected),selection:editor.state.selection.from===ime.from+'日本語'.length,
      saved:await ime.saved(),hasCommitted:activePages.map(page=>page.rendered).join('').includes('日本語'),noProvisional:!parsed.body.textContent.includes('nihon')&&!parsed.body.textContent.includes('にほん'),
      pages:ime.snapshot?.pages,events:ime.events};
  `);
  save();
  assert.equal(
    report.commit.result.status,
    "resolved",
    report.commit.result.message,
  );
  for (const field of [
    "source",
    "selection",
    "saved",
    "hasCommitted",
    "noProvisional",
  ])
    assert.equal(report.commit[field], true, "Commit " + field);
  assert.ok(
    report.commit.events.some(
      (event) => event.type === "compositionstart" && event.trusted,
    ),
  );
  assert.ok(
    report.commit.events.some(
      (event) =>
        event.type === "beforeinput" && event.composing && event.trusted,
    ),
  );
  if (context.print !== false) {
  await execute(
    "await window.editorPDFExperimental.export(ime.snapshot,crypto.randomUUID())",
  );
  const file = context.editorPDFTest.outputs.at(-1),
    pdf = await PDFDocument.load(fs.readFileSync(file));
  assert.equal(pdf.getPageCount(), report.commit.pages);
  const text = execFileSync("pdftotext", ["-raw", file, "-"], {
    encoding: "utf8",
  });
  const rawPages = text.split("\f");
  const layoutText = execFileSync("pdftotext", ["-layout", file, "-"], {
    encoding: "utf8",
  }).split("\f");
  for (const page of report.commit.activePages) {
    assert.equal(
      page.rendered,
      page.text,
      "Capture differs from live source page " + page.page,
    );
    assert.ok(
      containsPDFSourceText(
        page.text,
        rawPages[page.page - 1],
        layoutText[page.page - 1],
      ),
      "PDF differs from committed source page " + page.page,
    );
  }
  assert.ok(text.includes("IME-END"));
  assert.ok(!text.includes("nihon") && !text.includes("にほん"));
  fs.copyFileSync(file, path.join(context.artifacts, "ime-result.pdf"));
  report.pdf = { file, pages: pdf.getPageCount(), text: true };
  }
  report.history = await execute(`
    closeHistory();editor.commands.undo();const undo=editor.state.doc.eq(ime.original);
    editor.commands.redo();const redo=editor.state.doc.textContent.includes('日本語');await waitSaved();
    return {undo,redo,saved:await ime.saved()};
  `);
  save();
  for (const [key, value] of Object.entries(report.history))
    assert.equal(value, true, "History " + key);
  await stable(context);
}

async function cancelExport(context) {
  await context.execute("await ime.install()");
  await stable(context);
  await begin(context);
  await context.execute(
    "await ime.start('ready');ime.task.abort(new Error('Cancelled IME export'));await ime.work",
  );
  const waiting = await context.execute(
    'return {result:ime.result,composing:editor.view.composing,provisional:editor.state.doc.textContent.includes("nihon")}',
  );
  assert.equal(waiting.result.status, "rejected");
  assert.equal(waiting.result.message, "Cancelled IME export");
  assert.equal(waiting.composing, true);
  assert.equal(waiting.provisional, true);
  await commit(context, "中文");
  return {
    ...waiting,
    recovered: await context.execute(
      'return layoutReady()&&await ime.saved()&&editor.state.doc.textContent.includes("中文")',
    ),
  };
}

async function cancelComposition(context) {
  await context.execute("await ime.install()");
  await stable(context);
  await begin(context);
  await context.execute("await ime.start('ready')");
  await composition(context, "");
  await stable(context);
  await context.until('ime.result.status!=="pending"');
  const result = await context.execute(
    "await waitSaved();return {result:ime.result,restored:editor.state.doc.eq(ime.original),saved:await ime.saved()}",
  );
  assert.equal(result.result.status, "resolved", result.result.message);
  assert.equal(result.restored, true);
  assert.equal(result.saved, true);
  return result;
}

async function sourceAfterBinding(context) {
  const result = await context.execute(`
    await ime.start('ready');editor.commands.insertContent(' EDIT-AFTER-BINDING');await ime.work;await waitSaved();
    return {result:ime.result,saved:await ime.saved()};
  `);
  assert.equal(
    result.result.status,
    "rejected",
    "Readiness adopted a later source revision",
  );
  assert.equal(result.saved, true);
  await stable(context);
  return result;
}

async function destroyDuringComposition(context) {
  await context.execute("await ime.install()");
  await stable(context);
  await begin(context);
  return context.execute(`
    await ime.start('ready');editor.destroy();await ime.work;
    return {result:ime.result,destroyed:editor.isDestroyed};
  `);
}

exports.runIME = async (context) => {
  const { win, execute, artifacts } = context;
  const report = {
    protocol:
      "Chromium CDP Input.imeSetComposition/Input.insertText; trusted browser composition/input events; does not certify physical OS IME candidate UI",
  };
  const save = () =>
    fs.writeFileSync(
      path.join(artifacts, "ime-regression.json"),
      JSON.stringify(report, null, 2),
    );
  if(process.env.HIGHTEX_INPUT_CDP)win.showInactive();
  else {win.show();win.focus();win.webContents.focus();}
  win.webContents.debugger.attach("1.3");
  try {
    // The fixture intentionally cannot take OS keyboard focus. Chromium IME
    // still needs a focused page, unlike ordinary targeted key events.
    if(process.env.HIGHTEX_INPUT_CDP)
      await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:true});
    await setup(context);
    await captureDuringComposition(context, save, report);
    report.cancelExport = await cancelExport(context);
    assert.equal(report.cancelExport.recovered, true);
    save();
    report.cancelComposition = await cancelComposition(context);
    save();
    report.sourceAfterBinding = await sourceAfterBinding(context);
    save();
    report.destroy = await destroyDuringComposition(context);
    assert.equal(report.destroy.result.status, "rejected");
    assert.equal(report.destroy.destroyed, true);
    save();
    report.cleanup = await execute(
      'return {owned:document.querySelectorAll("[data-pagination-measure],.editor-pdf-pages,[data-pagination-fragment]").length,errors:window.errors}',
    );
    assert.equal(report.cleanup.owned, 0);
    assert.deepEqual(report.cleanup.errors, []);
    report.passed = true;
    save();
    console.log(
      "PASS: IME composition at a page break waits for committed text; cancel, undo/redo and autosave remain usable.",
    );
    console.log("IME evidence:", artifacts);
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    save();
    throw error;
  } finally {
    await execute(
      "if(window.ime)for(const type of ['compositionstart','compositionupdate','compositionend','beforeinput'])ime.dom?.removeEventListener(type,ime.listen)",
    ).catch(() => {});
    if(process.env.HIGHTEX_INPUT_CDP)
      await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:false});
    win.webContents.debugger.detach();
  }
};
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE = "1";
  process.env.HIGHTEX_EDITOR_IME = "1";
  require("./editor-pagination.cjs");
}
