const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {BrowserWindow,ipcMain} = require('electron');
const {PDFDocument} = require('pdf-lib');
const {execFileSync} = require('node:child_process');
const {prepareEquivalence,liveAndCapture,verifyPDFMarkers} = require('./editor-pdf-equivalence.cjs');
const {measureContent,compareContent} = require('./editor-pdf-geometry.cjs');

async function prepare(context) {
  await prepareEquivalence(context);
  await context.execute(`
    setPages(false);
    const input=editor.getJSON();
    input.content.push({type:'image',attrs:{src:'fixture-image',width:220}},p('EQI001 Sesudah gambar mandiri.'));
    editor.commands.setContent(input);await waitSaved();await prepareComparison(editor.getJSON());
    window.uiBaseline={selection:editor.state.selection.toJSON()};
    window.uiContent=()=>{
      const paper=editor.view.dom.closest('.page');
      return (${measureContent.toString()})([{root:editor.view.dom,paper},...Array.from(paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper}))],paginationGeometry());
    };
    setPages(true);
  `);
  await context.until("layoutReady()&&!layout().error&&Array.from(editor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)')).every(image=>image.complete&&image.naturalWidth)");
}

async function hoverAudit(context) {
  const {execute,until,win}=context;
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('DOM.enable');
  await win.webContents.debugger.sendCommand('CSS.enable');
  const root=await win.webContents.debugger.sendCommand('DOM.getDocument');
  const initial=await execute('await waitSaved();return {content:uiContent(),plan:JSON.stringify(layout()),source:JSON.stringify(editor.getJSON()),stored:JSON.stringify(await db.chapters.get("fixture.1")),history:historyDepth()}');
  const report=[];
  try {
    for(const [name,selector] of [['figure','#equivalence-image'],['standalone image','.tiptap > .node-image'],['table','#equivalence-table'],['heading','.tiptap h1']]) {
      const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:root.root.nodeId,selector});
      assert.ok(nodeId,'Missing hover target '+name);
      const before=await execute(`const node=document.querySelector(${JSON.stringify(selector)});const box=node.getBoundingClientRect();return {width:box.width,height:box.height}`);
      await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']});
      await execute('await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)');
      const after=await execute(`const node=document.querySelector(${JSON.stringify(selector)});const box=node.getBoundingClientRect();return {width:box.width,height:box.height,content:uiContent(),plan:JSON.stringify(layout()),hover:node.matches(':hover')}`);
      assert.equal(after.hover,true);
      assert.deepEqual({width:after.width,height:after.height},before,'Hover changed '+name+' dimensions');
      assert.equal(after.plan,initial.plan,'Hover changed the page plan');
      report.push({name,geometry:compareContent(initial.content,after.content),dimensions:before});
      await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]});
    }
    for(const kind of ['listItem','figureTable','codeBlock']) {
      await execute(`let target;editor.state.doc.descendants((node,pos)=>{if(target===undefined&&node.type.name===${JSON.stringify(kind)})target=pos+(${JSON.stringify(kind)}==='codeBlock'?1:2)});editor.commands.setTextSelection(target)`);
      await execute('await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)');
      assert.equal(await execute('return JSON.stringify(layout())'),initial.plan,'Selection controls changed the plan');
      report.push({name:kind+' selection',geometry:compareContent(initial.content,await execute('return uiContent()'))});
    }
    await execute("document.querySelector('#equivalence-image [data-editor-ui] button').click()");
    await until("document.querySelector('[data-tippy-root]')");
    const measured=await execute('const measured=await measureFresh();return {plan:JSON.stringify(measured),content:uiContent()}');
    assert.equal(measured.plan,initial.plan,'Open node actions affected measured content');
    report.push({name:'open figure actions',geometry:compareContent(initial.content,measured.content)});
    await execute("document.querySelector('#equivalence-image [data-editor-ui] button').click();editor.commands.setTextSelection({from:uiBaseline.selection.anchor,to:uiBaseline.selection.head})");
    const end=await execute('await waitSaved();return {source:JSON.stringify(editor.getJSON()),stored:JSON.stringify(await db.chapters.get("fixture.1")),history:historyDepth()}');
    assert.deepEqual(end,{source:initial.source,stored:initial.stored,history:initial.history});
    return report;
  } finally {win.webContents.debugger.detach()}
}

async function previewWindow() {
  const end=Date.now()+25000;
  while(Date.now()<end) {
    const win=BrowserWindow.getAllWindows().find(win=>!win.isDestroyed()&&win.webContents.getURL().includes('&debug=1'));
    if(win&&await win.webContents.executeJavaScript("!!document.querySelector('[data-debug-export]:not(:disabled)')").catch(()=>false)) return win;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw Error('Debug HTML did not become ready');
}

async function openDebug({execute,until}) {
  await execute("document.querySelector('[data-editor-pdf-options]').click()");
  await until("document.querySelector('[data-editor-pdf-debug]')");
  await execute("document.querySelector('[data-editor-pdf-debug]').click()");
  return previewWindow();
}

async function reviewExportOptions({execute,until,win,artifacts}) {
  assert.equal(await execute("return document.querySelectorAll('[data-pagination-status] details,[data-pagination-status] summary').length"),0);
  await execute("const button=document.querySelector('[data-editor-pdf-options]');button.scrollIntoView({block:'center',behavior:'instant'});button.click()");
  await until("document.querySelector('[data-editor-pdf-options-panel]')");
  await until("getComputedStyle(document.querySelector('[data-editor-pdf-options-panel]')).opacity==='1'");
  const menu=await execute(`const panel=document.querySelector('[data-editor-pdf-options-panel]'),box=panel.getBoundingClientRect();return {
    role:panel.getAttribute('role'),inside:box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight,
    expanded:document.querySelector('[data-editor-pdf-options]').getAttribute('aria-expanded')==='true'};`);
  assert.equal(menu.role,'dialog');assert.equal(menu.inside,true);assert.equal(menu.expanded,true);
  fs.writeFileSync(path.join(artifacts,'export-options.png'),(await win.webContents.capturePage()).toPNG());
  await execute("document.querySelector('[data-pagination-report]').click()");
  await until("document.querySelector('[data-pagination-feedback]')");
  await execute("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await until("!document.querySelector('[data-pagination-feedback]')");
  await execute("if(!document.querySelector('[data-editor-pdf-options-panel]'))document.querySelector('[data-editor-pdf-options]').click()");
  await until("document.querySelector('[data-editor-pdf-options-panel]')");
  await execute("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await until("!document.querySelector('[data-editor-pdf-options-panel]')&&document.activeElement.matches('[data-editor-pdf-options]')");
  fs.writeFileSync(path.join(artifacts,'export-controls.png'),(await win.webContents.capturePage()).toPNG());
  return {...menu,escape:true,feedback:true};
}
exports.reviewExportOptions=reviewExportOptions;

async function debugAudit(context) {
  const {execute,until,editorPDFTest,win,artifacts}=context;
  const before=editorPDFTest.outputs.length;
  const appEditor=await execute("return Boolean(window.applicationEditor&&!applicationEditor.isDestroyed)");
  const active=appEditor?'applicationEditor':'editor';
  await execute(`await waitSaved();window.debugSourceBefore=JSON.stringify(${active}.getJSON());window.debugHistoryBefore=JSON.stringify(historyDepth(${active}))`);
  const menu=await reviewExportOptions(context);

  let diagnostic;
  if(appEditor){
    await execute(`
      const e=applicationEditor;e.view.dispatch(nativeEditor.closeHistory(e.state.tr));
      e.commands.insertContentAt(e.state.doc.content.size,{type:'paragraph',content:[{type:'refComponent',attrs:{ref:'imageFigure',link:'debug-ui-missing'}}]});
      e.view.dispatch(nativeEditor.closeHistory(e.state.tr));await waitSaved();
    `);
    await until("!appPaginationKey.getState(applicationEditor.state).pending&&appPaginationKey.getState(applicationEditor.state).result?.issues.some(issue=>issue.key==='debug-ui-missing')");
    await execute("document.querySelector('[data-pagination-status] [data-pagination-diagnostics] [data-slot=collapsible-trigger]').click()");
    await until("document.querySelector('[data-pagination-status] [data-pagination-open-source]')");
    await execute("const panel=document.querySelector('[data-pagination-status] [data-pagination-diagnostics]');const row=Array.from(panel.querySelectorAll('li')).find(node=>node.textContent.includes('debug-ui-missing'));row.querySelector('[data-pagination-open-source]').click()");
    await until("applicationEditor.state.selection.node?.attrs.link==='debug-ui-missing'");
    diagnostic=await execute(`const panel=document.querySelector('[data-pagination-status] [data-pagination-diagnostics]');return {
      expanded:panel.querySelector('[data-slot=collapsible-trigger]').getAttribute('aria-expanded')==='true',
      source:applicationEditor.state.selection.node?.attrs.link==='debug-ui-missing',
      recovered:applicationEditor.view.dom.textContent.includes('Gambar ?'),
      exportEnabled:!document.querySelector('[data-editor-pdf-export]').disabled};`);
    assert.ok(Object.values(diagnostic).every(Boolean));
    await execute("applicationEditor.commands.undo();await waitSaved()");
    await until("!appPaginationKey.getState(applicationEditor.state).pending&&!document.querySelector('[data-editor-pdf-export]').disabled");
    assert.equal(await execute('return debugSourceBefore===JSON.stringify(applicationEditor.getJSON())'),true);
  }

  const preview=await openDebug(context);
  const debug=await preview.webContents.executeJavaScript(`(async()=>{
    window.debugReviewSnapshot=await window.editorPDFExperimental.init(new URLSearchParams(location.search).get('request'));
    return {fingerprint:debugReviewSnapshot.fingerprint,pages:debugReviewSnapshot.pages,ui:document.querySelectorAll('.editor-pdf-pages [data-editor-ui]').length,
      nativeSummary:document.querySelectorAll('[data-editor-pdf-debug-controls] details,[data-editor-pdf-debug-controls] summary').length};
  })()`);
  assert.equal(preview.isVisible(),true);assert.equal(debug.ui,0);assert.equal(debug.nativeSummary,0);
  assert.equal(editorPDFTest.outputs.length,before,'Inspecting HTML printed a PDF');
  assert.equal(await preview.webContents.executeJavaScript("document.querySelectorAll('.editor-pdf-pages [inert]').length"),0);
  const navigation=await preview.webContents.executeJavaScript(`(async()=>{
    const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const selected=()=>Number(document.querySelector('[data-print-viewport]').dataset.physicalPage);
    document.querySelector('[data-debug-next]').click();await frame();const next=selected()===2;
    document.querySelector('[data-debug-previous]').click();await frame();const previous=selected()===1;
    document.querySelector('[data-debug-section="1"]').click();await frame();
    const section=debugReviewSnapshot.sections.find(section=>section.id==='1');
    const sectionNavigation=selected()===section.firstPage&&document.querySelector('[data-debug-section="1"]').getAttribute('aria-current')==='page';
    const input=document.querySelector('[data-debug-page]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(debugReviewSnapshot.pages));
    input.dispatchEvent(new Event('input',{bubbles:true}));await frame();
    input.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await frame();
    const jump=selected()===debugReviewSnapshot.pages&&document.querySelector('[data-debug-next]').disabled;
    document.querySelector('[data-debug-section="toc"]').click();await frame();
    const link=document.querySelector('[data-print-viewport] .toc-row');
    const id=decodeURIComponent(link.getAttribute('href').slice(1));
    const target=debugReviewSnapshot.projection.targets.find(target=>target.id===id);
    link.click();await frame();const referenceNavigation=selected()===target.page;
    return {next,previous,sectionNavigation,jump,referenceNavigation};
  })()`);
  assert.ok(Object.values(navigation).every(Boolean),JSON.stringify(navigation));
  const inspectLayout = await preview.webContents.executeJavaScript(`(()=>{
    const canvas=document.querySelector('[data-editor-pdf-debug-surface]'),paper=canvas.querySelector('[data-print-viewport]');
    const describe=node=>({tag:node.tagName,classes:node.className,box:node.getBoundingClientRect().toJSON(),pointer:getComputedStyle(node).pointerEvents,position:getComputedStyle(node).position,inert:node.inert});
    return {size:[innerWidth,innerHeight],canvas:describe(canvas),paper:describe(paper),ancestors:[...function*(node){while(node){yield describe(node);node=node.parentElement}}(paper)]};
  })()`);
  fs.writeFileSync(path.join(artifacts,'debug-before-inspect.png'),(await preview.webContents.capturePage()).toPNG());
  const inspections=[],nativeInspect=preview.webContents.inspectElement.bind(preview.webContents);
  preview.webContents.inspectElement=(x,y)=>{inspections.push([x,y]);nativeInspect(x,y)};
  preview.webContents.closeDevTools();
  await preview.webContents.executeJavaScript("document.querySelector('[data-debug-inspect]').click()");
  const inspectDeadline=Date.now()+5000;
  while((!inspections.length||!preview.webContents.isDevToolsOpened())&&Date.now()<inspectDeadline)await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(inspections.length,1);assert.equal(preview.webContents.isDevToolsOpened(),true);
  const target=await preview.webContents.executeJavaScript(`(()=>{
    const [x,y]=${JSON.stringify(inspections[0])},element=document.elementFromPoint(x,y);
    return {x,y,content:Boolean(element?.closest('[data-print-viewport]')),hit:element?.tagName,
      size:[innerWidth,innerHeight],stack:document.elementsFromPoint(x,y).map(node=>({tag:node.tagName,classes:node.className,pointer:getComputedStyle(node).pointerEvents,box:node.getBoundingClientRect().toJSON()}))};
  })()`);
  fs.writeFileSync(path.join(artifacts,'debug-inspector.json'),JSON.stringify({navigation,inspectLayout,target},null,2));
  assert.equal(target.content,true,'Inspector selected the toolbar/blank background');
  preview.webContents.closeDevTools();
  const layouts=[];
  for(const [width,height] of [[1100,900],[650,800]]){
    preview.setContentSize(width,height);
    await preview.webContents.executeJavaScript("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    const layout=await preview.webContents.executeJavaScript(`(()=>{
      const canvas=document.querySelector('[data-editor-pdf-debug-surface]').getBoundingClientRect(),sidebar=document.querySelector('.debug-sidebar'),side=sidebar.getBoundingClientRect(),bar=document.querySelector('.debug-toolbar').getBoundingClientRect();
      const nav=document.querySelector('.debug-sections').getBoundingClientRect(),identity=document.querySelector('.debug-identity').getBoundingClientRect();
      const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      return {width:innerWidth,height:innerHeight,noOverlay:overlap(canvas,side)===0&&overlap(canvas,bar)===0,
        sidebarInside:side.left>=0&&side.right<=innerWidth&&side.top>=0&&side.bottom<=innerHeight,
        noPanelOverflow:sidebar.scrollWidth<=sidebar.clientWidth+1&&nav.bottom<=identity.top+1,
        canvasVisible:canvas.width>0&&canvas.height>0};
    })()`);
    assert.ok(layout.noOverlay&&layout.sidebarInside&&layout.canvasVisible&&layout.noPanelOverflow,JSON.stringify(layout));layouts.push(layout);
    fs.writeFileSync(path.join(artifacts,'debug-html-'+width+'.png'),(await preview.webContents.capturePage()).toPNG());
  }
  await execute(`${active}.commands.insertContentAt(${active}.state.doc.content.size-1,' EDIT_AFTER_DEBUG');await waitSaved()`);
  await preview.webContents.executeJavaScript("document.querySelector('[data-debug-export]').click()");
  const deadline=Date.now()+25000;
  while(Date.now()<deadline) {
    if(editorPDFTest.outputs.length===before+1&&fs.existsSync(editorPDFTest.outputs.at(-1))&&await preview.webContents.executeJavaScript("!document.querySelector('[data-debug-export]').disabled")) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(editorPDFTest.outputs.length,before+1);
  const file=editorPDFTest.outputs.at(-1),pdf=await PDFDocument.load(fs.readFileSync(file));
  assert.equal(JSON.parse(pdf.getSubject()).fingerprint,debug.fingerprint);
  const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
  assert.ok(!text.includes('EDIT_AFTER_DEBUG'));assert.ok(!text.includes('Debug HTML'));
  preview.destroy();
  await until("!document.querySelector('[data-editor-pdf-export]').disabled");
  const canceled=await openDebug(context);
  await execute("document.querySelector('[data-editor-pdf-cancel]').click()");
  await until("!document.querySelector('[data-editor-pdf-export]').disabled");
  assert.equal(canceled.isDestroyed(),true);
  assert.equal(ipcMain.listenerCount('experimental:editor-pdf:ready'),0);
  assert.equal(ipcMain.listenerCount('editor:inspect-element'),0);
  assert.deepEqual(await execute('return errors'),[]);
  return {menu,diagnostic,navigation,layouts,inspector:target,fingerprint:debug.fingerprint,pages:pdf.getPageCount(),sameSnapshot:true,lateEditsExcluded:true,controlsExcluded:true,cancelCleanup:true};
}
exports.reviewExportDebug=debugAudit;

exports.runUI=async context=>{
  const {execute,editorPDFTest,artifacts}=context,report={scope:'Hover/selection/menu invariance and development HTML preview -> exact-snapshot native PDF'};
  const save=()=>fs.writeFileSync(path.join(artifacts,'editor-ui-debug.json'),JSON.stringify(report,null,2));
  try {
    await prepare(context);
    report.recount=await require('./editor-reference-recount.cjs').verifyReferenceRecount(context);save();
    report.interactions=await hoverAudit(context);save();
    const {live,snapshot}=await liveAndCapture(context),section=snapshot.sections.find(section=>section.id==='1'),offset=section.firstPage-1;
    const snapshotRefs=await execute("const root=new DOMParser().parseFromString(equivalence.snapshot.html,'text/html');return Array.from(root.querySelectorAll('[data-document-section=\"1\"] a[data-type=ref-component]'),node=>node.textContent)");
    assert.deepEqual(snapshotRefs,report.recount.labels,'PDF did not recount references from source');
    assert.equal(await execute("return new DOMParser().parseFromString(equivalence.snapshot.html,'text/html').querySelectorAll('[data-editor-ui]').length"),0);
    let printed;
    editorPDFTest.inspectPrint(async win=>printed=await win.webContents.executeJavaScript(`(${measureContent.toString()})(Array.from(document.querySelectorAll('[data-document-section="1"]')).map(paper=>({root:paper,paper,page:Number(paper.dataset.documentPage)})))`));
    await execute('await window.editorPDFExperimental.export(equivalence.snapshot,crypto.randomUUID())');
    report.geometry=compareContent({...live,glyphs:live.glyphs.map(g=>({...g,page:g.page+offset})),images:live.images.map(g=>({...g,page:g.page+offset}))},printed);
    report.native=verifyPDFMarkers(editorPDFTest.outputs.at(-1),live.words.map(w=>({...w,page:w.page+offset})));save();
    editorPDFTest.inspectPrint(undefined);
    report.debug=await debugAudit(context);
    fs.copyFileSync(editorPDFTest.outputs.at(-1),path.join(artifacts,'debug-snapshot.pdf'));
    assert.deepEqual(await execute('return errors'),[]);
    assert.equal(await execute("return document.querySelectorAll('[data-pagination-measure],.editor-pdf-pages').length"),0);
    report.passed=true;save();console.log('PASS: hover and selection controls preserve live glyphs/page plans; debug HTML exports its exact snapshot and cleans up.');console.log('UI/debug evidence:',artifacts);
  } catch(error) {report.failure={message:error.message,stack:error.stack};save();throw error}
  finally {editorPDFTest.inspectPrint(undefined)}
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';
  process.env.HIGHTEX_EDITOR_EQUIVALENCE='1';
  process.env.HIGHTEX_PAGINATION_UI='1';
  require('./editor-pagination.cjs');
}
