const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow } = require('electron');
const { execFileSync } = require('node:child_process');
const { PDFDocument } = require('pdf-lib');
const { measureContent, compareContent } = require('./editor-pdf-geometry.cjs');
const { selectWordSamples } = require('./editor-line-projection.cjs');
const { verifyPDFMarkers } = require('./editor-pdf-equivalence.cjs');

const appContent=execute=>execute(`
  const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
  const paper=applicationEditor.view.dom.closest('.page'),state=appPaginationKey.getState(applicationEditor.state);
  return (${measureContent.toString()})([{root:applicationEditor.view.dom,paper},...Array.from(paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper}))],paginationGeometry(state.options));
`);
async function reviewInteractions(context){
  const {execute,until,win,artifacts}=context;
  const baseline=await appContent(execute),ui=await require('./editor-pdf-lifecycle.cjs').reviewExportUI(context),zoom=[];
  for(const target of [.5,2,1]){
    await execute(`
      dispatchEvent(new KeyboardEvent('keydown',{key:'0',ctrlKey:true,bubbles:true}));await new Promise(requestAnimationFrame);
      for(let index=0;index<Math.round(Math.abs(${target}-1)*10);index++){
        dispatchEvent(new KeyboardEvent('keydown',{key:${target}<1?'-':'+',ctrlKey:true,bubbles:true}));await new Promise(requestAnimationFrame);
      }
    `);
    zoom.push({zoom:target,geometry:compareContent(baseline,await appContent(execute))});
  }
  const resources=await execute(`
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const {EditorPDFStateError}=await import('/src/exception/editor-pdf-state-error.ts');
    const {paginationReport}=await import('/src/editor/pagination/report-error.ts');
    const {waitForContentFonts}=await import('/src/document-engine/resources/fonts.ts');
    const result={},style=document.createElement('style');document.head.append(style);
    try{
      const resources=new DocumentResources(new AbortController().signal);await resources.styles();
      style.sheet.insertRule('.fixture-presentation-change{color:blue}');
      try{resources.assertCurrent()}catch(error){result.retryable=error instanceof EditorPDFStateError&&!paginationReport(error,'Style capture')}
    }finally{style.remove()}
    const load=document.fonts.load,cause=Error('FONT-LOAD-PROBE');
    try{
      document.fonts.load=async()=>{throw cause};
      try{await waitForContentFonts(applicationEditor.view.dom)}catch(error){result.fontCause=error.cause===cause;result.fontReported=Boolean(paginationReport(error,'Font loading'))}
    }finally{document.fonts.load=load}
    document.fonts.dispatchEvent(new Event('loading'));
    await new Promise(queueMicrotask);
    result.pending=appPaginationKey.getState(applicationEditor.state).pending;
    document.fonts.dispatchEvent(new Event('loadingdone'));
    return result;
  `);
  assert.ok(Object.values(resources).every(Boolean),'Resource lifecycle: '+JSON.stringify(resources));
  await until('!appPaginationKey.getState(applicationEditor.state).pending&&appPaginationKey.getState(applicationEditor.state).result');
  resources.geometry=compareContent(baseline,await appContent(execute));
  const capturePresentation=()=>execute(`
    const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
    const task=new AbortController(),timer=setTimeout(()=>task.abort(Error('Theme capture deadline')),30000);
    try{const snapshot=await captureDocumentPDF(applicationEditor,task.signal);return {sections:snapshot.sections,sourceHash:snapshot.sourceHash,presentation:snapshot.presentation,views:snapshot.projection.views}}finally{clearTimeout(timer)}
  `);
  const light=await capturePresentation();
  await execute("window.reviewAppearance=document.documentElement.className;document.documentElement.classList.toggle('dark')");
  let theme;
  try{
    await until('!appPaginationKey.getState(applicationEditor.state).pending&&appPaginationKey.getState(applicationEditor.state).result');
    const dark=await capturePresentation();
    assert.deepEqual(dark.sections,light.sections);assert.equal(dark.sourceHash,light.sourceHash);assert.deepEqual(dark.views,light.views);
    theme={editor:compareContent(baseline,await appContent(execute)),document:require('./editor-core-mvp.cjs').comparePresentation(light.presentation,dark.presentation)};
  }finally{await execute('document.documentElement.className=reviewAppearance')}
  await until('!appPaginationKey.getState(applicationEditor.state).pending&&appPaginationKey.getState(applicationEditor.state).result');
  return {ui,zoom,resources,theme};
}

async function metadataLifecycle({execute,until,win},report) {
    await execute(`
      window.appEditorBeforeMetadata={editor:applicationEditor,doc:applicationEditor.state.doc,selection:applicationEditor.state.selection.toJSON(),history:historyDepth(applicationEditor)};
      document.querySelector('details[data-editor-ui] > summary').click();
      document.querySelector('details[data-editor-ui] [data-tour="editor-keywords"] input').focus();
    `);
    await win.webContents.insertText('APPKEYNEW');
    const attached=win.webContents.debugger.isAttached();if(!attached)win.webContents.debugger.attach('1.3');
    try{
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    }finally{if(!attached)win.webContents.debugger.detach()}
    await until("document.querySelector('#page [data-section-composition]')?.textContent.includes('APPKEYNEW')&&!appPaginationKey.getState(applicationEditor.state).pending",30000);
    report.keywordUpdate=await execute(`
      return {editorSame:applicationEditor===appEditorBeforeMetadata.editor,sourceSame:applicationEditor.state.doc===appEditorBeforeMetadata.doc,
        selectionSame:JSON.stringify(applicationEditor.state.selection.toJSON())===JSON.stringify(appEditorBeforeMetadata.selection),
        historySame:JSON.stringify(historyDepth(applicationEditor))===JSON.stringify(appEditorBeforeMetadata.history),
        persisted:(await db.documents.get('fixture')).keywords.indonesian.includes('APPKEYNEW')};
    `);
    assert.ok(Object.values(report.keywordUpdate).every(Boolean),'Keyword editing changed the document editor state or failed to update storage');
    await execute(`
      const keyword=Array.from(document.querySelectorAll('details[data-editor-ui] [data-tour="editor-keywords"] span')).find(node=>node.textContent.includes('APPKEYNEW'));
      keyword.querySelector('button').click();
    `);
    await until("!document.querySelector('#page [data-section-composition]')?.textContent.includes('APPKEYNEW')&&!appPaginationKey.getState(applicationEditor.state).pending",30000);
    await execute("window.config.set({editor:{pagination:false}})");
    await until("!document.querySelector('#page [data-section-composition]')&&!appPaginationKey.getState(applicationEditor.state).enabled");
    await execute("window.config.set({editor:{pagination:true}})");
    await until("document.querySelector('#page [data-section-composition]')?.textContent.includes('APPKEYID')&&!appPaginationKey.getState(applicationEditor.state).pending",30000);
    report.toggle=await execute(`return {sameEditor:applicationEditor===appEditorBeforeMetadata.editor,sameSource:applicationEditor.state.doc===appEditorBeforeMetadata.doc,
      sameHistory:JSON.stringify(historyDepth(applicationEditor))===JSON.stringify(appEditorBeforeMetadata.history),sourceUnchanged:appBefore===JSON.stringify(await db.chapters.toArray())}`);
    if(!report.toggle.sourceUnchanged)report.sourceChanges=await execute(`
      const before=JSON.parse(appBefore),after=await db.chapters.toArray();
      return {changes:after.filter(item=>JSON.stringify(item)!==JSON.stringify(before.find(old=>old.id===item.id))).map(item=>({id:item.id,before:before.find(old=>old.id===item.id),after:item})),writes:window.appChapterWrites,inputs:window.appInputs};
    `);
    assert.ok(Object.values(report.toggle).every(Boolean),'Toggling pagination replaced or changed the editor');
}

exports.run = async ({ execute, until, artifacts, win, editorPDFTest }) => {
  const report = { scope: 'Actual application experimental export/debug, abstract template/body composition; legacy PDF untouched.' };
  const save = () => fs.writeFileSync(path.join(artifacts,'composite-app.json'),JSON.stringify(report,null,2));
  editorPDFTest.connect(win.webContents.getURL());
  try {
    await execute(`
      await waitSaved();
      const data=await db.documents.get('fixture');
      data.title='APP-TITLE-PROOF';data.altTitle='APP-EN-TITLE-PROOF';data.config={...data.config,statementDate:new Date('2026-01-02T00:00:00Z')};
      data.keywords={indonesian:['APPKEYID'],english:['APPKEYEN']};await db.documents.put(data);
      for(const [id,title,marker] of [['abstract','ABSTRAK','APPBODYID'],['abstract-en','ABSTRACT','APPBODYEN']])
        await db.chapters.put({id:'fixture.'+id,content:[{type:'heading',attrs:{level:1,id:'app-'+id},content:[{type:'text',text:title}]},...Array.from({length:8},(_,i)=>p(marker+'-'+i+' '+sentence.repeat(4)))]});
      const heading=editor.getJSON().content[0];
      let normalContent=[heading,p('APPCHAPTER '+sentence.repeat(2))];
      ${process.env.HIGHTEX_NORMAL_APP ? `
        const {sharedPresentationInput}=await import('/tests/helpers/shared-presentation-input.ts');
        const model={images:{}};
        normalContent.push({type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'APPBR Sebelum hard break'},{type:'hardBreak'},{type:'text',text:'Sesudah hard break '+sentence.repeat(3)}]}]}]});
        sharedPresentationInput(normalContent,model);
        const asset=model.images['shared-tall-image'];
        await db.images.put({id:'shared-tall-image',documentId:'fixture',createdAt:0,blob:new Blob([asset.bytes],{type:asset.mime})});
        normalContent.push({type:'codeBlock',attrs:{language:'javascript'},content:[{type:'text',text:'const APP_CODE = true;'}]},p('APPEND '+sentence));
      ` : ''}
      await db.chapters.put({id:'fixture.1',content:normalContent});
      await (await import('/src/editor/event/index.ts')).getEditorChapter(editor).graph.sync();
      editor.commands.setContent({type:'doc',content:normalContent});await waitSaved();
      window.appBefore=JSON.stringify(await db.chapters.toArray());
      window.appChapterWrites=[];window.appInputs=[];
      const {Storage}=await import('/src/editor/storage/index.ts'),original=Storage.instance.setChapter.bind(Storage.instance);
      Storage.instance.setChapter=chapter=>{appChapterWrites.push({id:chapter.id,content:chapter.content,stack:new Error().stack});return original(chapter)};
      window.addEventListener('beforeinput',event=>appInputs.push({type:event.inputType,data:event.data,tag:event.target.tagName}));
      await window.config.set({editor:{pagination:true}});window.mountApplication('/document/fixture/abbrevation');
    `);
    if(process.env.HIGHTEX_APP_DEBUG_REVIEW_ONLY){
      await execute("window.navigate('/document/fixture/1');window.appPaginationKey=(await import('/src/editor/pagination/state.ts')).paginationKey");
      await until("applicationEditor&&!applicationEditor.isDestroyed&&applicationChapter()==='fixture.1'&&appPaginationKey.getState(applicationEditor.state).result&&!appPaginationKey.getState(applicationEditor.state).pending&&!document.querySelector('[data-editor-pdf-export]')?.disabled",30000);
      report.debug=await require('./editor-pagination-ui.cjs').reviewExportDebug({execute,until,win,artifacts,editorPDFTest});
      report.complete=true;save();return;
    }
    if(process.env.HIGHTEX_APP_FINAL_REVIEW_ONLY){
      await execute("window.navigate('/document/fixture/1');window.appPaginationKey=(await import('/src/editor/pagination/state.ts')).paginationKey");
      await until("applicationEditor&&!applicationEditor.isDestroyed&&applicationChapter()==='fixture.1'&&appPaginationKey.getState(applicationEditor.state).result&&!appPaginationKey.getState(applicationEditor.state).pending&&!document.querySelector('[data-editor-pdf-export]')?.disabled",30000);
      Object.assign(report,await reviewInteractions({execute,until,win,artifacts}));report.complete=true;save();return;
    }
    if(process.env.HIGHTEX_APP_LIFECYCLE_ONLY){
      await execute(`
        window.navigate('/document/fixture/abstract');
      `);
      await until("applicationEditor&&!applicationEditor.isDestroyed&&document.querySelector('#page [data-section-composition]')?.textContent.includes('APPKEYID')",30000);
      await execute("window.appPaginationKey=(await import('/src/editor/pagination/state.ts')).paginationKey");
      await until("!appPaginationKey.getState(applicationEditor.state).pending",30000);
      await metadataLifecycle({execute,until,win},report);report.passed=true;save();console.log('PASS app metadata lifecycle:',artifacts);return;
    }
    await until("document.querySelector('[data-editor-pdf-export]')&&!document.querySelector('[data-editor-pdf-export]').disabled",30000);
    await execute("document.querySelector('[data-editor-pdf-export]').click()");
    await until("document.querySelector('[data-editor-pdf-progress]')||document.querySelector('[data-editor-pdf-error]')",10000);
    await until("document.querySelector('[data-editor-pdf-error]')||(!document.querySelector('[data-editor-pdf-progress]')&&!document.querySelector('[data-editor-pdf-export]').disabled)",60000);
    const error=await execute("return document.querySelector('[data-editor-pdf-error]')?.textContent");assert.ok(!error,error);
    assert.equal(editorPDFTest.outputs.length,1,'Application did not save through the experimental service');
    const file=editorPDFTest.outputs[0],bytes=fs.readFileSync(file),pdf=await PDFDocument.load(bytes);
    report.pages=pdf.getPageCount();report.metadata=JSON.parse(pdf.getSubject());
    const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
    report.markers=Object.fromEntries(['APPKEYID','APPKEYEN',...Array.from({length:8},(_,i)=>'APPBODYID-'+i),...Array.from({length:8},(_,i)=>'APPBODYEN-'+i)].map(marker=>[marker,text.split(marker).length-1]));
    assert.ok(Object.values(report.markers).every(count=>count===1),'App export lost or duplicated abstract content');
    for(const id of ['abstract','abstract-en'])assert.ok(report.metadata.sections.some(section=>section.id===id&&section.pages>0));
    report.sourceUnchanged=await execute("return appBefore===JSON.stringify(await db.chapters.toArray())");assert.equal(report.sourceUnchanged,true);
    await execute("window.navigate('/document/fixture/abstract')");
    await until("window.applicationEditor&&!applicationEditor.isDestroyed&&document.querySelector('#page [data-section-composition]')&&document.querySelector('#page')?.hidden===false",30000);
    await execute("window.appPaginationKey=(await import('/src/editor/pagination/state.ts')).paginationKey");
    await until("!appPaginationKey.getState(applicationEditor.state).pending&&!appPaginationKey.getState(applicationEditor.state).layout.error&&document.querySelector('#page [data-section-composition]')?.textContent.includes('APPKEYID')&&!document.querySelector('[data-editor-pdf-export]')?.disabled",30000);
    report.editor=await execute(`
      const {paginationKey}=await import('/src/editor/pagination/state.ts');
      const layout=paginationKey.getState(applicationEditor.state);
      const body=applicationEditor.view.dom,composition=document.querySelector('#page [data-section-composition]');
      return {layout:layout.layout,pending:layout.pending,keywords:composition.textContent.includes('APPKEYID'),
        sourceContainsKeywords:applicationEditor.state.doc.textContent.includes('APPKEYID'),
        headings:Array.from(composition.querySelectorAll('h1'),node=>node.textContent),
        controls:composition.querySelectorAll('button,input').length};
    `);
    assert.equal(report.editor.keywords,true);assert.equal(report.editor.sourceContainsKeywords,false);assert.equal(report.editor.controls,0);
    assert.equal(report.editor.headings.filter(title=>title==='ABSTRAK').length,1);
    const editorContent=await execute(`
      const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
      const paper=applicationEditor.view.dom.closest('.page'),state=appPaginationKey.getState(applicationEditor.state);
      return (${measureContent.toString()})([{root:paper.querySelector('[data-section-composition]'),paper}],paginationGeometry(state.options,'introduction'));
    `);
    fs.writeFileSync(path.join(artifacts,'application-editor-content.json'),JSON.stringify(editorContent));
    await until("!document.querySelector('[data-editor-pdf-export]').disabled&&document.querySelector('#page [data-section-composition]')",30000);
    await execute("document.querySelector('[data-editor-pdf-export]').click()");
    await until("document.querySelector('[data-editor-pdf-progress]')||document.querySelector('[data-editor-pdf-error]')",10000);
    await until("document.querySelector('[data-editor-pdf-error]')||(!document.querySelector('[data-editor-pdf-progress]')&&!document.querySelector('[data-editor-pdf-export]').disabled)",60000);
    const activeError=await execute("return document.querySelector('[data-editor-pdf-error]')?.textContent");assert.ok(!activeError,activeError);
    const activePDF=await PDFDocument.load(fs.readFileSync(editorPDFTest.outputs[1]));
    report.activeMetadata=JSON.parse(activePDF.getSubject());
    assert.deepEqual(report.activeMetadata.sections,report.metadata.sections,'Active chapter changed the composed document pagination');
    const activeText=execFileSync('pdftotext',['-layout',editorPDFTest.outputs[1],'-'],{encoding:'utf8'});
    assert.equal(activeText,text,'Active chapter changed the printed document content');
    const section=report.activeMetadata.sections.find(section=>section.id==='abstract');
    report.nativeWordBounds=verifyPDFMarkers(editorPDFTest.outputs[1],selectWordSamples(editorContent.glyphs).map(word=>({...word,page:section.firstPage+word.page-1})));
    await execute("document.querySelector('[data-editor-pdf-options]').click()");
    await until("document.querySelector('[data-editor-pdf-debug]')");
    await execute("document.querySelector('[data-editor-pdf-debug]').click()");
    await until("Boolean(document.querySelector('[data-editor-pdf-error]'))||document.querySelector('[data-editor-pdf-progress]')?.textContent.includes('HTML')",60000);
    let debug;
    for(let attempt=0;attempt<100;attempt++){
      debug=BrowserWindow.getAllWindows().find(candidate=>!candidate.isDestroyed()&&candidate.webContents.getURL().includes('debug=1'));
      if(debug&&await debug.webContents.executeJavaScript("Boolean(document.querySelector('[data-editor-pdf-debug-controls]'))"))break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.ok(debug,'Application did not open the actual debug print route');
    report.debug=await debug.webContents.executeJavaScript(`(()=>{
      const controls=document.querySelector('[data-editor-pdf-debug-controls]');
      const fingerprint=controls.dataset.debugFingerprint,contexts=document.querySelectorAll('[data-print-context]').length;
      window.editorPDFViewport.select(${report.pages-1},fingerprint);
      const last=Number(document.querySelector('[data-print-viewport]').dataset.physicalPage);
      window.editorPDFViewport.select(0,fingerprint);
      return {contexts,last,fingerprint,inspect:!!controls.querySelector('[data-debug-inspect]')};
    })()`);
    assert.equal(report.debug.last,report.pages);assert.equal(report.debug.fingerprint,report.activeMetadata.fingerprint);assert.equal(report.debug.inspect,true);
    const printContent=await debug.webContents.executeJavaScript(`(async()=>{
      const request=new URLSearchParams(window.location.search).get('request'),snapshot=await window.editorPDFExperimental.init(request);
      const section=snapshot.sections.find(section=>section.id==='abstract'),view=snapshot.projection.views[section.firstPage-1];
      const context=document.querySelector('[data-print-context="'+view.context+'"] [data-section-context]');
      return (${measureContent.toString()})([{root:context.querySelector('[data-section-composition]'),paper:context}],snapshot.projection.contexts[view.context]);
    })()`);
    report.editorToPrint=compareContent(editorContent,printContent,.75);
    fs.writeFileSync(path.join(artifacts,'application-print-content.json'),JSON.stringify(printContent));
    const englishPrint=await debug.webContents.executeJavaScript(`(async()=>{
      const snapshot=await window.editorPDFExperimental.init(new URLSearchParams(window.location.search).get('request'));
      const section=snapshot.sections.find(section=>section.id==='abstract-en'),view=snapshot.projection.views[section.firstPage-1];
      const context=document.querySelector('[data-print-context="'+view.context+'"] [data-section-context]');
      return (${measureContent.toString()})([{root:context.querySelector('[data-section-composition]'),paper:context}],snapshot.projection.contexts[view.context]);
    })()`);
    debug.close();
    await until("!document.querySelector('[data-editor-pdf-progress]')");
    await metadataLifecycle({execute,until,win},report);
    await execute("document.querySelector('#page').scrollIntoView({block:'start'});await new Promise(requestAnimationFrame)");
    fs.writeFileSync(path.join(artifacts,'application-abstract.png'),(await win.webContents.capturePage()).toPNG());
    await execute("window.navigate('/document/fixture/abstract-en')");
    await until("applicationEditor&&!applicationEditor.isDestroyed&&document.querySelector('#page [data-section-composition]')?.textContent.includes('APPKEYEN')&&!appPaginationKey.getState(applicationEditor.state).pending",30000);
    const englishEditor=await execute(`
      const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
      const paper=applicationEditor.view.dom.closest('.page'),state=appPaginationKey.getState(applicationEditor.state);
      const composition=paper.querySelector('[data-section-composition]');
      if(Array.from(composition.querySelectorAll('h1')).filter(heading=>heading.textContent==='ABSTRACT').length!==1)throw Error('English abstract heading duplicated');
      if(applicationEditor.state.doc.textContent.includes('APPKEYEN'))throw Error('English keywords entered source');
      return (${measureContent.toString()})([{root:composition,paper}],paginationGeometry(state.options,'introduction'));
    `);
    report.englishEditorToPrint=compareContent(englishEditor,englishPrint,.75);
    const englishSection=report.activeMetadata.sections.find(section=>section.id==='abstract-en');
    report.englishNativeWordBounds=verifyPDFMarkers(editorPDFTest.outputs[1],selectWordSamples(englishEditor.glyphs).map(word=>({...word,page:englishSection.firstPage+word.page-1})));
    fs.writeFileSync(path.join(artifacts,'application-english-content.json'),JSON.stringify({editor:englishEditor,print:englishPrint}));
    await execute("document.querySelector('#page').scrollIntoView({block:'start'});await new Promise(requestAnimationFrame)");
    fs.writeFileSync(path.join(artifacts,'application-abstract-en.png'),(await win.webContents.capturePage()).toPNG());
    report.navigationSourceUnchanged=await execute("return appBefore===JSON.stringify(await db.chapters.toArray())");
    assert.equal(report.navigationSourceUnchanged,true);
    if(process.env.HIGHTEX_NORMAL_APP){
      await execute("window.navigate('/document/fixture/1')");
      await until("applicationEditor&&!applicationEditor.isDestroyed&&applicationChapter()==='fixture.1'&&!appPaginationKey.getState(applicationEditor.state).pending&&!appPaginationKey.getState(applicationEditor.state).layout.error&&!document.querySelector('[data-editor-pdf-export]')?.disabled&&Array.from(applicationEditor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)')).every(image=>image.complete&&image.naturalWidth>0)",30000);
      const normalEditor=await execute(`
        const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
        const paper=applicationEditor.view.dom.closest('.page'),state=appPaginationKey.getState(applicationEditor.state);
        const surfaces=[{root:applicationEditor.view.dom,paper},...Array.from(paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper}))];
        return (${measureContent.toString()})(surfaces,paginationGeometry(state.options));
      `);
      report.cacheBeforeExport=await execute(`
        window.layoutCache=(await import('/src/editor/document/layout-cache.ts')).documentLayoutCache();
        window.normalReadyResult=appPaginationKey.getState(applicationEditor.state).result;
        if(!normalReadyResult||!Object.isFrozen(normalReadyResult))throw Error('Editor has no published immutable result');
        if(layoutCache.get(normalReadyResult.identity)?.result!==normalReadyResult)throw Error('Editor result was not shared with document compilation');
        return layoutCache.stats;
      `);
      report.normalColumns=await execute(`
        const paper=applicationEditor.view.dom.closest('.page');
        const widths=table=>Array.from(table.querySelectorAll('colgroup > col'),col=>col.getBoundingClientRect().width);
        return {source:widths(applicationEditor.view.dom.querySelector('table')),
          repeated:Array.from(paper.querySelectorAll('.editor-pagination-furniture table'),widths)};
      `);
      assert.ok(report.normalColumns.repeated.length>0,'Continuation header was not exercised');
      for(const widths of report.normalColumns.repeated){
        assert.equal(widths.length,report.normalColumns.source.length,'Repeated header lost a column');
        widths.forEach((width,index)=>assert.ok(Math.abs(width-report.normalColumns.source[index])<.75,'Continuation header column changed width'));
      }
      await execute("document.querySelector('[data-editor-pdf-export]').click()");
      await until("document.querySelector('[data-editor-pdf-progress]')||document.querySelector('[data-editor-pdf-error]')",10000);
      await until("document.querySelector('[data-editor-pdf-error]')||(!document.querySelector('[data-editor-pdf-progress]')&&!document.querySelector('[data-editor-pdf-export]').disabled)",60000);
      const error=await execute("return document.querySelector('[data-editor-pdf-error]')?.textContent");assert.ok(!error,error);
      const file=editorPDFTest.outputs.at(-1),pdf=await PDFDocument.load(fs.readFileSync(file));
      report.cacheAfterExport=await execute("return layoutCache.stats");
      assert.ok(report.cacheAfterExport.hits>report.cacheBeforeExport.hits,'PDF did not reuse published chapter layouts');
      assert.equal(report.cacheAfterExport.misses,report.cacheBeforeExport.misses,'Unchanged export recompiled an editable section');
      report.normalMetadata=JSON.parse(pdf.getSubject());
      assert.deepEqual(report.normalMetadata.sections,report.metadata.sections,'Normal active chapter changed section pagination');
      assert.equal(execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'}),text,'Normal active chapter changed PDF layout');
      await execute("document.querySelector('[data-editor-pdf-options]').click()");
    await until("document.querySelector('[data-editor-pdf-debug]')");
    await execute("document.querySelector('[data-editor-pdf-debug]').click()");
      let normalDebug;
      for(let attempt=0;attempt<200;attempt++){
        normalDebug=BrowserWindow.getAllWindows().find(candidate=>!candidate.isDestroyed()&&candidate.webContents.getURL().includes('debug=1'));
        if(normalDebug&&await normalDebug.webContents.executeJavaScript("Boolean(window.editorPDFViewport)"))break;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      assert.ok(normalDebug,'Normal chapter debug did not open');
      const normalPrint=await normalDebug.webContents.executeJavaScript(`(async()=>{
        const snapshot=await window.editorPDFExperimental.init(new URLSearchParams(window.location.search).get('request'));
        const section=snapshot.sections.find(section=>section.id==='1'),view=snapshot.projection.views[section.firstPage-1];
        const context=document.querySelector('[data-print-context="'+view.context+'"] [data-section-context]');
        const surfaces=[{root:context.querySelector('.tiptap'),paper:context},...Array.from(context.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper:context}))];
        return (${measureContent.toString()})(surfaces,snapshot.projection.contexts[view.context]);
      })()`);
      normalDebug.close();
      fs.writeFileSync(path.join(artifacts,'normal-content.json'),JSON.stringify({editor:normalEditor,print:normalPrint}));
      report.normalEditorToPrint=compareContent(normalEditor,normalPrint,.75);
      const normalSection=report.normalMetadata.sections.find(section=>section.id==='1');
      report.normalNativeWordBounds=verifyPDFMarkers(file,selectWordSamples(normalEditor.glyphs).map(word=>({...word,page:normalSection.firstPage+word.page-1})));
      report.normalSourceUnchanged=await execute("return appBefore===JSON.stringify(await db.chapters.toArray())");assert.equal(report.normalSourceUnchanged,true);
      report.normalBeforeResize=await execute(`
        window.normalBeforeResize=applicationEditor.state.doc;
        const image=applicationEditor.view.dom.querySelector('.node-image img');
        const box=image.getBoundingClientRect();
        applicationEditor.view.dom.querySelector('.node-image span[data-editor-ui]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:box.right,cancelable:true}));
        document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:box.right+60}));
        document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
        await new Promise(requestAnimationFrame);
        return {before:240,after:image.getBoundingClientRect().width};
      `);
      assert.ok(report.normalBeforeResize.after>report.normalBeforeResize.before,'Image resizing failed');
      await execute("if(!applicationEditor.commands.undo())throw Error('Image resize could not be undone')");
      await until("!appPaginationKey.getState(applicationEditor.state).pending&&applicationEditor.state.doc.eq(normalBeforeResize)",10000);
      report.normalResizeUndo=await execute(`
        await (await import('/src/editor/storage/index.ts')).Storage.instance.waitForDocument('fixture');
        return {source:applicationEditor.state.doc.eq(normalBeforeResize),width:applicationEditor.view.dom.querySelector('.node-image img').getBoundingClientRect().width,
          stored:appBefore===JSON.stringify(await db.chapters.toArray())};
      `);
      assert.equal(report.normalResizeUndo.source,true);assert.equal(report.normalResizeUndo.stored,true);
      assert.ok(Math.abs(report.normalResizeUndo.width-240)<.1,'Undo did not restore the legacy string image width');
      if(process.env.HIGHTEX_APP_FINAL_REVIEW){
        Object.assign(report,await reviewInteractions({execute,until,win,artifacts}));save();
      }
    }
    report.complete=true;save();console.log('PASS: application composite PDF/debug. Artifacts:',artifacts);
  } catch(error){report.failure={message:error.message,stack:error.stack};save();throw error;}
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_COMPOSITE_APP='1';process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';process.env.HIGHTEX_EDITOR_EQUIVALENCE='1';require('./editor-pagination.cjs');}
