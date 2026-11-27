// Trusted Chromium input + OS clipboard + a separate Cocoa text view, not synthetic ClipboardEvents.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');const {clipboard}=require('electron');const {PDFDocument}=require('pdf-lib');
const {readClipboard,restoreClipboard}=require('./editor-native-interactions.cjs');
exports.run=async({execute,until,win,artifacts,editorPDFTest})=>{
  const report={protocol:'Native Electron mouse/clipboard commands and an independent osascript Cocoa NSTextView copy. No human operator or IME candidate review.'};
  const save=()=>fs.writeFileSync(path.join(artifacts,'native-list-caption.json'),JSON.stringify(report,null,2));
  console.log('Native list/caption artifacts:',artifacts);
  const previous=readClipboard();
  try{
    await execute(`
      setPages(false);editor.commands.setContent({type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'Introduction'}]},p(sentence.repeat(8)),{type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[p('BEGIN OSLIST satu')]},{type:'listItem',content:[p('OSLIST dua')]}]},{type:'horizontalRule'},{...makeTable(3),content:[{type:'figcaption',content:[{type:'text',text:'OSCAPTION END'}]},makeTable(3).content[1]]},p('OSWORKFLOWEND')]});await waitSaved();setPages(true);
    `);
    await until('layoutReady()&&!layout().error');
    await execute(`
      window.osBefore=editor.state.doc;window.osSource=JSON.stringify(editor.getJSON());
      window.osListCaption={};editor.state.doc.descendants((node,pos)=>{
        if(node.type.name==='paragraph'&&node.textContent==='BEGIN OSLIST satu')osListCaption.from=pos+1;
        if(node.type.name==='figcaption')osListCaption.to=pos+1+node.content.size;
      });editor.view.dom.closest('.page').style.transform='scale(.65)';editor.view.dom.closest('.page').style.transformOrigin='top center';
    `);
    report.before=await execute('return JSON.parse(osSource)');save();
    win.show();win.focus();win.webContents.focus();
    const points=await execute(`
      const first=editor.view.coordsAtPos(osListCaption.from);window.scrollBy(0,first.top-110);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return [osListCaption.from,osListCaption.to].map(pos=>{const box=editor.view.coordsAtPos(pos);return {x:Math.round(box.left+1),y:Math.round((box.top+box.bottom)/2)}});
    `);
    assert.ok(points.every(point=>point.y>0&&point.y<950),'Drag endpoints must be visible');
    win.webContents.sendInputEvent({type:'mouseDown',...points[0],button:'left',clickCount:1});
    for(let i=1;i<=16;i++)win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(points[0].x+(points[1].x-points[0].x)*i/16),y:Math.round(points[0].y+(points[1].y-points[0].y)*i/16),button:'left',modifiers:['leftButtonDown']});
    win.webContents.sendInputEvent({type:'mouseUp',...points[1],button:'left',clickCount:1});
    await execute('await new Promise(requestAnimationFrame)');
    report.drag=await execute(`return {pages:layout().pages,selection:editor.state.selection.toJSON(),includesList:editor.state.doc.textBetween(editor.state.selection.from,editor.state.selection.to).includes('OSLIST'),includesCaption:editor.state.doc.textBetween(editor.state.selection.from,editor.state.selection.to).includes('OSCAPTION'),sourceUnchanged:editor.state.doc.eq(osBefore)}`);
    save();assert.ok(report.drag.pages>=2);assert.equal(report.drag.includesList,true);assert.equal(report.drag.includesCaption,true);assert.equal(report.drag.sourceUnchanged,true);
    win.webContents.copy();await execute('await new Promise(requestAnimationFrame)');
    report.copy={list:clipboard.readText().includes('OSLIST'),caption:clipboard.readText().includes('OSCAPTION'),noWidgets:!/data-editor-page-break|editor-pagination|\u2060/.test(clipboard.readHTML())};
    assert.deepEqual(report.copy,{list:true,caption:true,noWidgets:true});
    await execute('closeHistory()');win.webContents.cut();await until('!editor.state.doc.eq(osBefore)');await execute('await waitSaved();closeHistory()');
    win.webContents.paste();await until('editor.state.doc.eq(osBefore)||layout().error');report.afterPaste=await execute('return editor.getJSON()');save();
    assert.equal(await execute('return editor.state.doc.eq(osBefore)'),true,'Cut/paste at the unchanged origin changed source structure or IDs');await execute('await waitSaved();closeHistory()');
    report.cutPaste=await execute('const saved=JSON.stringify((await db.chapters.get("fixture.1")).content)===JSON.stringify(editor.getJSON().content);editor.commands.undo();const undoPaste=!editor.state.doc.eq(osBefore);editor.commands.undo();const undoCut=editor.state.doc.eq(osBefore);editor.commands.redo();editor.commands.redo();await waitSaved();return {saved,undoPaste,undoCut,redo:editor.state.doc.eq(osBefore)}');
    assert.deepEqual(report.cutPaste,{saved:true,undoPaste:true,undoCut:true,redo:true});save();
    const copied=execFileSync('osascript',['-l','JavaScript','-e',`
      ObjC.import('AppKit');$.NSApplication.sharedApplication;
      const view=$.NSTextView.alloc.initWithFrame($.NSMakeRect(0,0,400,200));
      view.string=$('OSNATIVEEXTERNAL');view.selectAll(null);view.copy(null);
      $.NSPasteboard.generalPasteboard.stringForType($.NSPasteboardTypeString).js;
    `],{encoding:'utf8'}).trim();assert.equal(copied,'OSNATIVEEXTERNAL');
    await execute(`closeHistory();let end;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='paragraph'&&node.textContent==='BEGIN OSLIST satu')end=pos+node.nodeSize-1});editor.commands.setTextSelection(end);editor.view.focus()`);
    win.webContents.paste();await until('editor.state.doc.textContent.includes("OSNATIVEEXTERNAL")');
    report.external=await execute('await waitSaved();closeHistory();editor.commands.undo();const undo=editor.state.doc.eq(osBefore);editor.commands.redo();await waitSaved();return {undo,redo:editor.state.doc.textContent.includes("OSNATIVEEXTERNAL"),stored:JSON.stringify((await db.chapters.get("fixture.1")).content)===JSON.stringify(editor.getJSON().content)}');
    assert.deepEqual(report.external,{undo:true,redo:true,stored:true});save();
    await execute('window.osStored=JSON.stringify(editor.getJSON());window.osDOM=editor.view.dom;window.mountChapterFixture()');
    await until('window.ready&&editor&&!editor.isDestroyed&&editor.view.dom!==osDOM');
    await execute('setPages(true)');await until('layoutReady()&&!layout().error');
    report.reopen=await execute('return osStored===JSON.stringify(editor.getJSON())');assert.equal(report.reopen,true);
    editorPDFTest.connect(await execute('return location.href'));
    await execute(`const {captureDocumentPDF}=await import('/src/document-export/capture.ts');window.osSnapshot=await captureDocumentPDF(editor,new AbortController().signal);await window.editorPDFExperimental.export(osSnapshot,crypto.randomUUID())`);
    const file=editorPDFTest.outputs.at(-1),pdf=await PDFDocument.load(fs.readFileSync(file));
    const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
    for(const marker of ['OSLIST','OSCAPTION','OSNATIVEEXTERNAL','OSWORKFLOWEND'])assert.ok(text.includes(marker),'Native PDF missing '+marker);
    report.pdf={file,pages:pdf.getPageCount(),sourceUnchanged:await execute('return osStored===JSON.stringify(editor.getJSON())')};assert.equal(report.pdf.sourceUnchanged,true);
    report.errors=await execute('return errors');assert.deepEqual(report.errors,[]);report.complete=true;save();
  }catch(error){report.failure={message:error.message,stack:error.stack};save();throw error}
  finally{restoreClipboard(previous);report.clipboardRestored=readClipboard()===previous;save();assert.equal(report.clipboardRestored,true)}
  console.log('PASS native list/caption drag, cut/paste, external Cocoa copy, reopen and PDF:',artifacts);
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_NATIVE_LIST_CAPTION='1';process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';require('./editor-pagination.cjs')}
