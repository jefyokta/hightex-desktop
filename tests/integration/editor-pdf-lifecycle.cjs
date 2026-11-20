const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");

async function prepare({ execute, until }) {
  await execute(`
    const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
    const {Storage}=await import('/src/editor/storage/index.ts');
    const {Document}=await import('/src/editor/document/index.ts');
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const {abortable}=await import('/src/utils/abortable.ts');
    window.lifecycle={capture:captureDocumentPDF,storage:Storage.instance,Document,Resources:DocumentResources,abortable};
    const category={...Document.instance.category,chapters:[{chapter:'1',title:'Introduction'},{chapter:'2',title:'Lifecycle second'}]};
    Document.instance.category=category;window.hightex.categories=async()=>[structuredClone(category)];
    await db.chapters.put({id:'fixture.2',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'Lifecycle second'}]},p('LIFECYCLE-SECOND-BASELINE '+sentence)]});
    lifecycle.createdURLs=new Set();lifecycle.createURL=URL.createObjectURL;lifecycle.revokeURL=URL.revokeObjectURL;
    URL.createObjectURL=function(value){const url=lifecycle.createURL.call(this,value);lifecycle.createdURLs.add(url);return url};
    URL.revokeObjectURL=function(url){lifecycle.createdURLs.delete(url);return lifecycle.revokeURL.call(this,url)};
    editor.commands.setContent({type:'doc',content:[editor.getJSON().content[0],p('LIFECYCLE-FROZEN-BASELINE '+sentence.repeat(8)),
      {type:'imageFigure',attrs:{id:'lifecycle-image',figureId:'lifecycle-figure'},content:[{type:'image',attrs:{src:'fixture-image',width:120}},{type:'figcaption',content:[{type:'text',text:'Lifecycle image'}]}]},p('End of lifecycle source.')]});
    await waitSaved();await window.config.set({editor:{pagination:true}});setPages(true);
  `);
  await until(
    "layoutReady()&&!layout().error&&Array.from(editor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)')).every(image=>image.complete&&image.naturalWidth>0)",
  );
}

async function frozenEditing({ execute, until }) {
  await execute(`
    const task=new AbortController();lifecycle.frozenStarted=false;
    lifecycle.frozenTimer=setTimeout(()=>task.abort(new Error('Frozen capture deadline')),20000);
    const gate=new Promise(resolve=>lifecycle.releaseFrozen=resolve);
    lifecycle.frozenPending=lifecycle.capture(editor,task.signal,engine=>engine.events.once('start',async({signal})=>{
      lifecycle.frozenStarted=true;await lifecycle.abortable(gate,signal);
    })).then(snapshot=>({snapshot}),error=>({error}));
  `);
  await until("lifecycle.frozenStarted");
  return execute(`
    const before=editor.state.doc.textContent;closeHistory();
    editor.commands.insertContentAt(editor.state.doc.content.size-1,' EDIT-AFTER-FREEZE');closeHistory();
    const edited=editor.state.doc.textContent;editor.commands.undo();const undo=editor.state.doc.textContent===before;
    editor.commands.redo();const redo=editor.state.doc.textContent===edited;await waitSaved();
    const selection=JSON.stringify(editor.state.selection.toJSON()),history=JSON.stringify(historyDepth());
    try{
      lifecycle.releaseFrozen();const result=await lifecycle.frozenPending;if(result.error)throw result.error;
      lifecycle.snapshot=result.snapshot;
      return {undo,redo,frozen:!result.snapshot.html.includes('EDIT-AFTER-FREEZE'),baseline:result.snapshot.html.includes('LIFECYCLE-FROZEN-BASELINE'),
        editable:editor.isEditable,selection:selection===JSON.stringify(editor.state.selection.toJSON()),history:history===JSON.stringify(historyDepth()),
        autosave:JSON.stringify(await db.chapters.get('fixture.1')).includes('EDIT-AFTER-FREEZE'),ownedPages:document.querySelectorAll('.editor-pdf-pages').length,pages:result.snapshot.pages};
    }finally{clearTimeout(lifecycle.frozenTimer);lifecycle.releaseFrozen()}
  `);
}

async function readiness({ execute, until }) {
  const results = [];
  for (const action of ["abort", "edit"]) {
    results.push(await execute(`
      const {waitForEditorExport}=await import('/src/document-export/source/editor-readiness.ts');
      const {EditorPDFStateError}=await import('/src/exception/editor-pdf-state-error.ts');
      const action=${JSON.stringify(action)},task=new AbortController(),load=document.fonts.load;
      let entered,release;
      const started=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
      const before=JSON.stringify(editor.getJSON());
      document.fonts.load=function(...args){return load.apply(this,args).then(value=>{entered();return gate.then(()=>value)})};
      const pending=waitForEditorExport(editor,task.signal).then(value=>({value}),error=>({error}));
      const deadline=setTimeout(()=>task.abort(Error('Readiness fixture deadline')),4000);
      try{
        await Promise.race([started,pending.then(result=>{throw result.error??Error('Readiness finished before its font gate')})]);
        document.fonts.load=load;
        if(action==='abort')task.abort();
        else editor.commands.insertContentAt(editor.state.doc.content.size-1,' READINESS-REVISION-PROBE');
        const result=await pending;
        const classified=action==='abort'?result.error?.name==='AbortError':result.error instanceof EditorPDFStateError;
        const source=JSON.stringify(editor.getJSON()),selection=JSON.stringify(editor.state.selection.toJSON()),history=JSON.stringify(historyDepth());
        release();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
        return {action,classified,noResult:!result.value,source:source===JSON.stringify(editor.getJSON()),
          selection:selection===JSON.stringify(editor.state.selection.toJSON()),history:history===JSON.stringify(historyDepth()),
          abortUnchanged:action!=='abort'||source===before};
      }finally{clearTimeout(deadline);release();document.fonts.load=load;task.abort();await pending}
    `));
    await until("layoutReady()&&!layout().error");
  }
  return results;
}

async function cancelPreparation({ execute }, phase, entry) {
  return execute(`
    const phase=${JSON.stringify(phase)},entry=${JSON.stringify(entry)},task=new AbortController();
    let entered,release,settled=false,failure;
    const started=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
    const wait=lifecycle.storage.waitForDocument,transaction=db.transaction;
    const hold=promise=>promise.then(async value=>{entered();await gate;return value});
    if(phase==='autosave')lifecycle.storage.waitForDocument=function(id){return hold(wait.call(this,id))};
    else db.transaction=function(mode,...args){const pending=transaction.call(this,mode,...args);return mode==='r'&&Array.isArray(args[0])&&args[0].includes(db.images)?hold(pending):pending};
    const originalPages=document.querySelectorAll('[data-pagination-surface],.editor-pdf-pages').length;
    const pending=lifecycle.capture(entry==='editor'?editor:lifecycle.Document.instance,task.signal)
      .then(()=>{settled=true},error=>{failure=error;settled=true});
    const timer=setTimeout(()=>task.abort(new Error('Preparation test deadline')),5000);
    try{
      await Promise.race([started,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Preparation gate was not reached')),4000))]);
      task.abort();await Promise.race([pending,new Promise(resolve=>setTimeout(resolve,150))]);
      const prompt=settled&&failure?.name==='AbortError';
      lifecycle.storage.waitForDocument=wait;db.transaction=transaction;
      const marker=' EDIT-AFTER-CANCEL-'+phase+'-'+entry;
      editor.commands.insertContentAt(editor.state.doc.content.size-1,marker);await wait.call(lifecycle.storage,'fixture');
      const selection=JSON.stringify(editor.state.selection.toJSON()),history=JSON.stringify(historyDepth()),text=editor.state.doc.textContent;
      release();await pending;await new Promise(requestAnimationFrame);
      return {phase,entry,prompt,editable:editor.isEditable,autosave:JSON.stringify(await db.chapters.get('fixture.1')).includes(marker),
        lateReadSafe:text===editor.state.doc.textContent,selection:selection===JSON.stringify(editor.state.selection.toJSON()),history:history===JSON.stringify(historyDepth()),
        cleanup:document.querySelectorAll('[data-pagination-surface],.editor-pdf-pages').length===originalPages};
    }finally{clearTimeout(timer);release();lifecycle.storage.waitForDocument=wait;db.transaction=transaction;await pending}
  `);
}

async function navigateAndCancel({ execute, until, editorPDFTest }) {
  const outputsBefore = editorPDFTest.outputs.length;
  await execute(`
    lifecycle.originalStyles=lifecycle.Resources.prototype.styles;lifecycle.requests=[];
    lifecycle.originalFingerprint=lifecycle.Resources.prototype.layoutFingerprint;
    const measuring=new WeakSet();
    lifecycle.Resources.prototype.layoutFingerprint=async function(){
      measuring.add(this);
      try{return await lifecycle.originalFingerprint.call(this)}finally{measuring.delete(this)}
    };
    lifecycle.Resources.prototype.styles=function(){
      // Hold snapshot packaging, not the canonical compiler's font/style input.
      if(measuring.has(this))return lifecycle.originalStyles.call(this);
      const request={signal:this.signal};request.gate=new Promise(resolve=>request.release=resolve);lifecycle.requests.push(request);
      return lifecycle.abortable(request.gate,this.signal).then(()=>lifecycle.originalStyles.call(this));
    };
    mountApplication();
  `);
  try {
    await until(
      "applicationEditor&&!applicationEditor.isDestroyed&&applicationChapter()==='fixture.1'&&applicationEditor.isEditable&&!applicationLayout().error&&!applicationLayout().pending",
    );
    await until(
      "document.querySelector('[data-editor-pdf-export]')&&!document.querySelector('[data-editor-pdf-export]').disabled",
    );
    await execute("document.querySelector('[data-editor-pdf-export]').click()");
    await until("lifecycle.requests.length===1");
    await execute("navigate('/document/fixture/2')");
    await until(
      "applicationEditor&&!applicationEditor.isDestroyed&&applicationChapter()==='fixture.2'&&applicationEditor.isEditable&&!applicationLayout().error&&!applicationLayout().pending&&lifecycle.requests[0].signal.aborted&&document.querySelectorAll('.editor-pdf-pages').length===0",
    );
    await execute(
      "applicationEditor.commands.insertContentAt(applicationEditor.state.doc.content.size-1,' LIVE-SECOND-EDIT');await lifecycle.storage.waitForDocument('fixture')",
    );
    await until(
      "!applicationLayout().pending&&!document.querySelector('[data-editor-pdf-export]').disabled",
    );
    await execute("document.querySelector('[data-editor-pdf-export]').click()");
    await until("lifecycle.requests.length===2");
    const result = await execute(`
      const source=JSON.stringify(applicationEditor.getJSON()),selection=JSON.stringify(applicationEditor.state.selection.toJSON());
      lifecycle.requests[0].release();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
      return {oldCancelled:lifecycle.requests[0].signal.aborted,newIndependent:!lifecycle.requests[1].signal.aborted,
        newBusy:Boolean(document.querySelector('[data-editor-pdf-progress]')),newEditable:applicationEditor.isEditable,
        sourceUnchanged:source===JSON.stringify(applicationEditor.getJSON()),selectionUnchanged:selection===JSON.stringify(applicationEditor.state.selection.toJSON()),
        noError:!document.querySelector('[data-editor-pdf-error]'),autosave:JSON.stringify(await db.chapters.get('fixture.2')).includes('LIVE-SECOND-EDIT')};
    `);
    await execute("document.querySelector('[data-editor-pdf-cancel]').click()");
    await until(
      "lifecycle.requests[1].signal.aborted&&!document.querySelector('[data-editor-pdf-progress]')&&document.querySelectorAll('.editor-pdf-pages').length===0",
    );
    await until("document.activeElement?.matches('[data-editor-pdf-export]')");
    await execute("lifecycle.requests[1].release()");
    assert.equal(
      editorPDFTest.outputs.length,
      outputsBefore,
      "Navigation/cancel opened a save operation",
    );
    return { ...result, noNativeSave: true };
  } catch (error) {
    const state = await execute(
      `return {chapter:applicationEditor&&!applicationEditor.isDestroyed?applicationChapter():null,buttons:Array.from(document.querySelectorAll('[data-editor-pdf-export]'),node=>({disabled:node.disabled})),progress:document.querySelector('[data-editor-pdf-progress]')?.textContent,error:document.querySelector('[data-editor-pdf-error]')?.textContent,requests:lifecycle.requests.length,layout:applicationEditor&&!applicationEditor.isDestroyed?applicationLayout():null}`,
    );
    console.error("Navigation state:", JSON.stringify(state));
    throw error;
  } finally {
    await execute(
      "lifecycle.Resources.prototype.styles=lifecycle.originalStyles;lifecycle.Resources.prototype.layoutFingerprint=lifecycle.originalFingerprint;for(const request of lifecycle.requests)request.release()",
    );
  }
}

async function lateImage({ execute }) {
  return execute(`
    const original=db.images.get;let entered,release;
    const started=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
    db.images.get=function(id){
      const result=original.call(this,id);
      if(id!=='fixture-image')return result;
      return result.then(record=>{setTimeout(entered,0);return gate.then(()=>record)});
    };
    const baseline=lifecycle.createdURLs.size;
    try{
      applicationEditor.commands.insertContentAt(applicationEditor.state.doc.content.size,{type:'imageFigure',attrs:{id:'late-image-figure',figureId:'late-image'},content:[{type:'image',attrs:{src:'fixture-image',width:120}},{type:'figcaption',content:[{type:'text',text:'Late result'}]}]});
      await started;
      const unallocated=lifecycle.createdURLs.size===baseline;let range;
      applicationEditor.state.doc.descendants((node,pos)=>{if(node.attrs.id==='late-image-figure')range={from:pos,to:pos+node.nodeSize}});
      applicationEditor.commands.deleteRange(range);await lifecycle.storage.waitForDocument('fixture');
      release();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
      return {unallocated,noExtraURLs:lifecycle.createdURLs.size===baseline,editable:applicationEditor.isEditable,removed:!JSON.stringify(await db.chapters.get('fixture.2')).includes('late-image-figure')};
    }finally{release();db.images.get=original}
  `);
}

async function numbering({ execute, until }) {
  await execute(`
    const {paginationKey}=await import('/src/editor/pagination/state.ts');
    lifecycle.numberingState=()=>paginationKey.getState(applicationEditor.state);
    lifecycle.numberingBaseline={source:JSON.stringify(applicationEditor.getJSON()),selection:JSON.stringify(applicationEditor.state.selection.toJSON()),history:JSON.stringify(historyDepth(applicationEditor))};
    applicationEditor.commands.configureEditorPagination({documentNumbering:true});
  `);
  const ready="!lifecycle.numberingState().pending&&!lifecycle.numberingState().layout.error&&lifecycle.numberingState().numbering&&!lifecycle.numberingState().numbering.pending";
  await until(ready,20000);
  const before = await execute(`
    const state=lifecycle.numberingState();
    if(state.numbering.error)throw Error(state.numbering.error);
    const labels=state.numbering.labels;
    const row=await db.chapters.get('fixture.1');row.content.push(p(sentence.repeat(100)));await db.chapters.put(row);
    return {first:labels[0],count:labels.length,pages:state.layout.pages};
  `);
  await until(ready+`&&Number(lifecycle.numberingState().numbering.labels?.[0])>Number(${JSON.stringify(before.first)})`,20000);
  return execute(`
    const state=lifecycle.numberingState(),baseline=lifecycle.numberingBaseline;
    const labels=state.numbering.labels,visible=Array.from(applicationEditor.view.dom.closest('.page').querySelectorAll('.editor-pagination-number'),node=>node.textContent);
    const result={initialCount:${before.count}===${before.pages},reflow:Number(labels[0])>Number(${JSON.stringify(before.first)}),
      count:labels.length===state.layout.pages,visible:JSON.stringify(labels)===JSON.stringify(visible),
      source:baseline.source===JSON.stringify(applicationEditor.getJSON()),selection:baseline.selection===JSON.stringify(applicationEditor.state.selection.toJSON()),
      history:baseline.history===JSON.stringify(historyDepth(applicationEditor))};
    applicationEditor.commands.configureEditorPagination({documentNumbering:false});
    return result;
  `);
}

exports.reviewExportUI=async({execute,until,win,artifacts})=>{
  await execute(`
    const {DocumentRenderSession}=await import('/src/document-export/document-render.ts');
    const {ShouldReport}=await import('/src/exception/should-report.ts');
    window.uiReview={render:DocumentRenderSession.prototype.render,errors:errors.length,source:JSON.stringify(applicationEditor.getJSON())};
    uiReview.listener=event=>{if(event.reason?.cause?.message==='EXPORT-UI-RECOVERY-PROBE')uiReview.report=event.reason instanceof ShouldReport};
    addEventListener('unhandledrejection',uiReview.listener);
    DocumentRenderSession.prototype.render=function(...args){
      if(args[2])throw Error('EXPORT-UI-RECOVERY-PROBE');
      return uiReview.render.apply(this,args);
    };
    document.querySelector('[data-editor-pdf-export]').click();
  `);
  try{
    await until("document.querySelector('[data-editor-pdf-error]')?.textContent.includes('EXPORT-UI-RECOVERY-PROBE')&&uiReview.report&&!document.querySelector('[data-editor-pdf-progress]')");
    const error=await execute(`return {report:uiReview.report,unexpected:errors.slice(uiReview.errors),source:uiReview.source===JSON.stringify(applicationEditor.getJSON()),retry:!document.querySelector('[data-editor-pdf-export]').disabled}`);
    assert.equal(error.report,true);assert.equal(error.source,true);assert.equal(error.retry,true);assert.equal(error.unexpected.length,1);
    fs.writeFileSync(path.join(artifacts,'export-ui-error.png'),(await win.webContents.capturePage()).toPNG());
    await execute(`
      const {DocumentRenderSession}=await import('/src/document-export/document-render.ts');
      DocumentRenderSession.prototype.render=uiReview.render;removeEventListener('unhandledrejection',uiReview.listener);
      errors.splice(uiReview.errors,1);
      applicationEditor.view.dispatch(nativeEditor.closeHistory(applicationEditor.state.tr));
      applicationEditor.commands.insertContentAt(applicationEditor.state.doc.content.size,{type:'paragraph',content:[{type:'refComponent',attrs:{ref:'imageFigure',link:'missing-ui-review',label:'999'}}]});
    `);
    await until("!appPaginationKey.getState(applicationEditor.state).pending&&appPaginationKey.getState(applicationEditor.state).result?.issues.some(issue=>issue.key==='missing-ui-review')");
    await execute("for(const panel of document.querySelectorAll('[data-pagination-diagnostics]')){const trigger=panel.querySelector('[data-slot=collapsible-trigger]');if(trigger.getAttribute('aria-expanded')!=='true')trigger.click()}await new Promise(requestAnimationFrame);const panel=Array.from(document.querySelectorAll('[data-pagination-diagnostics]')).find(panel=>panel.textContent.includes('missing-ui-review'));panel.querySelector('[data-pagination-open-source]').click()");
    await until("applicationEditor.state.selection.node?.attrs.link==='missing-ui-review'");
    const warning=await execute(`const diagnostics=Array.from(document.querySelectorAll('[data-pagination-diagnostics]')).find(panel=>panel.textContent.includes('missing-ui-review'));return {
      visible:diagnostics.querySelector('[data-slot=collapsible-trigger]').getAttribute('aria-expanded')==='true',source:applicationEditor.state.selection.node?.attrs.link==='missing-ui-review',recovered:applicationEditor.view.dom.textContent.includes('Gambar ?'),
      exportEnabled:!document.querySelector('[data-editor-pdf-export]').disabled};`);
    assert.ok(Object.values(warning).every(Boolean));
    fs.writeFileSync(path.join(artifacts,'export-ui-warning.png'),(await win.webContents.capturePage()).toPNG());
    await execute("applicationEditor.commands.undo();await (await import('/src/editor/storage/index.ts')).Storage.instance.waitForDocument('fixture')");
    await until('!appPaginationKey.getState(applicationEditor.state).pending');
    assert.equal(await execute('return uiReview.source===JSON.stringify(applicationEditor.getJSON())'),true);
    return {error,warning,sourceRestored:true};
  }finally{
    await execute(`const {DocumentRenderSession}=await import('/src/document-export/document-render.ts');DocumentRenderSession.prototype.render=uiReview.render;removeEventListener('unhandledrejection',uiReview.listener)`);
  }
};

exports.runLifecycle = async (context) => {
  const { execute, editorPDFTest, artifacts } = context;
  assert(editorPDFTest, "Use the real experimental PDF bridge");
  const audit = { preparation: [] };
  const save = () =>
    fs.writeFileSync(
      path.join(artifacts, "export-lifecycle.json"),
      JSON.stringify(audit, null, 2),
    );
  try {
    await prepare(context);
    audit.readiness = await readiness(context);
    save();
    for (const result of audit.readiness)
      for (const [field, value] of Object.entries(result))
        if (field !== "action") assert.equal(value, true, result.action + " " + field);
    audit.frozen = await frozenEditing(context);
    save();
    for (const field of [
      "undo",
      "redo",
      "frozen",
      "baseline",
      "editable",
      "selection",
      "history",
      "autosave",
    ])
      assert.equal(audit.frozen[field], true, field);
    assert.equal(audit.frozen.ownedPages, 0);
    await execute(
      "await window.editorPDFExperimental.export(lifecycle.snapshot,crypto.randomUUID())",
    );
    const pdf = editorPDFTest.outputs.at(-1),
      text = execFileSync("pdftotext", ["-raw", pdf, "-"], {
        encoding: "utf8",
      });
    assert.equal(
      (await PDFDocument.load(fs.readFileSync(pdf))).getPageCount(),
      audit.frozen.pages,
    );
    assert.ok(text.includes("LIFECYCLE-FROZEN-BASELINE"));
    assert.equal(text.includes("EDIT-AFTER-FREEZE"), false);
    audit.nativePDF = { pages: audit.frozen.pages, frozenText: true };
    save();
    for (const phase of ["autosave", "snapshot"])
      for (const entry of ["editor", "document"]) {
        const result = await cancelPreparation(context, phase, entry);
        audit.preparation.push(result);
        save();
        for (const [field, value] of Object.entries(result))
          if (!["phase", "entry"].includes(field))
            assert.equal(value, true, phase + " " + entry + " " + field);
      }
    audit.navigation = await navigateAndCancel(context);
    save();
    for (const [field, value] of Object.entries(audit.navigation))
      assert.equal(value, true, field);
    audit.numbering = await numbering(context);
    save();
    for (const [field, value] of Object.entries(audit.numbering))
      assert.equal(value, true, field);
    audit.lateImage = await lateImage(context);
    save();
    for (const [field, value] of Object.entries(audit.lateImage))
      assert.equal(value, true, field);
    audit.cleanup = await execute(
      `await new Promise(requestAnimationFrame);return {ownedPages:document.querySelectorAll('.editor-pdf-pages').length,activeURLs:lifecycle.createdURLs.size,errors:window.errors}`,
    );
    save();
    assert.equal(audit.cleanup.ownedPages, 0);
    assert.equal(audit.cleanup.activeURLs, 0);
    assert.deepEqual(audit.cleanup.errors, []);
    console.log(
      "PASS: frozen native PDF survives live edits/undo/redo; cancellation stops waiting for autosave/IDB; real chapter navigation cancels old export, late work cannot affect a new export; user saves continue and owned DOM/URLs are released.",
    );
    console.log("Lifecycle evidence:", artifacts);
  } finally {
    await execute(
      "if(window.lifecycle){lifecycle.releaseFrozen?.();clearTimeout(lifecycle.frozenTimer);URL.createObjectURL=lifecycle.createURL;URL.revokeObjectURL=lifecycle.revokeURL}",
    );
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE = "1";
  process.env.HIGHTEX_EDITOR_PDF_LIFECYCLE = "1";
  require("./editor-pagination.cjs");
}
