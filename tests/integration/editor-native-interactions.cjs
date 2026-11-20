const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { clipboard } = require('electron');
const { prepareClipboard, exportClipboard } = require('./editor-pagination-clipboard.cjs');

// NSPasteboard restores all items/types atomically. Repeated writeBuffer calls
// would replace formats, losing rich/image clipboard data from another app.
const readClipboard = () => execFileSync('osascript',['-l','JavaScript','-e',`
  ObjC.import('AppKit');
  const items=$.NSPasteboard.generalPasteboard.pasteboardItems,result=[];
  for(let i=0;i<items.count;i++){
    const item=items.objectAtIndex(i),formats=[];
    for(let j=0;j<item.types.count;j++){
      const type=item.types.objectAtIndex(j);
      formats.push([type.js,item.dataForType(type).base64EncodedStringWithOptions(0).js]);
    }
    result.push(formats);
  }
  JSON.stringify(result);
`],{encoding:'utf8'}).trim();
const restoreClipboard = input => execFileSync('osascript',['-l','JavaScript','-e',`
  ObjC.import('AppKit');
  const bytes=$.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
  const input=$.NSString.alloc.initWithDataEncoding(bytes,$.NSUTF8StringEncoding).js;
  const items=JSON.parse(input).map(formats=>{
    const item=$.NSPasteboardItem.alloc.init;
    for(const [type,value] of formats)item.setDataForType($.NSData.alloc.initWithBase64EncodedStringOptions(value,0),$(type));
    return item;
  });
  const board=$.NSPasteboard.generalPasteboard;
  board.clearContents;
  if(items.length)board.writeObjects($(items));
`],{input,stdio:['pipe','ignore','pipe']});

exports.run = async context => {
  const {execute,until,win,artifacts}=context;
  const report={platform:process.platform,os:os.release(),protocol:'Electron native editing commands use the macOS clipboard; trusted Chromium keyboard/mouse input. Physical OS IME candidate UI requires operator review.'};
  const save=()=>fs.writeFileSync(path.join(artifacts,'native-interactions.json'),JSON.stringify(report,null,2));
  // Preserve every available format in memory; never write existing clipboard data to evidence.
  const previous=readClipboard();
  const frame=()=>execute('await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const key=async(keyCode,modifiers=[])=>{
    win.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});
    win.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});
    await frame();
  };
  try {
    await prepareClipboard(context);
    await execute(`
      clip.source.content.splice(2,0,{type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[
        {type:'paragraph',attrs:{id:'native-list'},content:[{type:'text',text:'NATIVE-LIST'}]}
      ]}]});await clip.install();
    `);
    await until('layoutReady()&&!layout().error');
    win.show();win.focus();win.webContents.focus();
    await until('document.hasFocus()',5000);
    await execute(`
      editor.view.focus();
      window.nativeReview={cut:layout().breaks.find(item=>item.kind==='line').from,source:editor.state.doc};
      nativeReview.point=()=>{
        const selection=window.getSelection(),range=selection.getRangeAt(0),box=range.getBoundingClientRect();
        const pos=editor.view.coordsAtPos(editor.state.selection.head),page=editor.view.dom.closest('.page').getBoundingClientRect();
        return {from:editor.state.selection.from,cut:nativeReview.cut,top:box.top,left:box.left,model:pos,pageTop:page.top,
          dom:editor.view.posAtDOM(selection.focusNode,selection.focusOffset),parent:selection.focusNode.parentElement.outerHTML.slice(0,350)};
      };
      editor.commands.setTextSelection(nativeReview.cut-1);
    `);
    await frame();
    await key('Right');await key('Right');
    const right=await execute('return editor.state.selection.from>nativeReview.cut');
    await key('Left');await key('Left');
    const left=await execute('return editor.state.selection.from<nativeReview.cut');
    await key('Right',['shift']);await key('Right',['shift']);
    report.arrows={left,right,shift:await execute('return editor.state.selection.from<nativeReview.cut&&editor.state.selection.to>nativeReview.cut')};
    for(const [direction,ok] of Object.entries(report.arrows))assert.equal(ok,true,'Boundary navigation: '+direction);
    save();

    await execute('editor.commands.setTextSelection(nativeReview.cut-1);editor.view.focus()');
    const initial=await execute('return nativeReview.point()');
    await key('Down');
    const down=await execute('return nativeReview.point()');
    report.arrows.down=await execute('return editor.state.selection.from>nativeReview.cut');
    await key('Up');
    const up=await execute('return nativeReview.point()');
    report.arrows.up=up.from<=up.cut&&up.top<down.top;
    report.vertical={initial,down,up};save();
    await execute('editor.commands.setTextSelection(nativeReview.cut-1);editor.view.focus()');
    await key('Down',['shift']);
    report.arrows.shiftDown=await execute('return editor.state.selection.anchor===nativeReview.cut-1&&editor.state.selection.head>=nativeReview.cut');
    await key('Up',['shift']);
    report.arrows.shiftUp=await execute('return editor.state.selection.anchor===nativeReview.cut-1&&editor.state.selection.head<nativeReview.cut');
    const points=await execute(`
      const start=editor.view.coordsAtPos(nativeReview.cut-25);
      window.scrollBy(0,start.top-200);await new Promise(requestAnimationFrame);
      return [nativeReview.cut-25,nativeReview.cut+25].map(pos=>{
        const box=editor.view.coordsAtPos(pos);return {x:Math.round(box.left+1),y:Math.round((box.top+box.bottom)/2)};
      });
    `);
    win.webContents.sendInputEvent({type:'mouseDown',...points[0],button:'left',clickCount:1});
    for(let index=1;index<=12;index++)win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(points[0].x+(points[1].x-points[0].x)*index/12),y:Math.round(points[0].y+(points[1].y-points[0].y)*index/12),button:'left',modifiers:['leftButtonDown']});
    win.webContents.sendInputEvent({type:'mouseUp',...points[1],button:'left',clickCount:1});
    await frame();
    report.drag=await execute('return {crosses:editor.state.selection.from<nativeReview.cut&&editor.state.selection.to>nativeReview.cut,source:editor.state.doc.eq(nativeReview.source)}');
    assert.deepEqual(report.drag,{crosses:true,source:true});save();

    const selected=await execute(`
      editor.commands.setTextSelection({from:nativeReview.cut-25,to:nativeReview.cut+25});editor.view.focus();
      nativeReview.from=editor.state.selection.from;nativeReview.to=editor.state.selection.to;
      return editor.state.doc.textBetween(nativeReview.from,nativeReview.to,'\\n\\n');
    `);
    win.webContents.copy();await frame();
    report.copy={text:clipboard.readText()===selected,formatting:/<strong>/.test(clipboard.readHTML())&&/<em>/.test(clipboard.readHTML()),noWidgets:!/data-editor-page-break|editor-pagination|\u2060/.test(clipboard.readHTML())};
    for(const [name,ok] of Object.entries(report.copy))assert.equal(ok,true,'System copy: '+name);
    await execute('closeHistory()');win.webContents.cut();
    await until('editor.state.doc.eq(nativeEditor.EditorState.create({doc:nativeReview.source}).tr.delete(nativeReview.from,nativeReview.to).doc)');
    await execute('await waitSaved();closeHistory()');
    win.webContents.paste();
    await until('editor.state.doc.eq(nativeReview.source)');
    report.paste=await execute('await waitSaved();closeHistory();editor.commands.undo();const undoPaste=!editor.state.doc.eq(nativeReview.source);editor.commands.undo();const undoCut=editor.state.doc.eq(nativeReview.source);editor.commands.redo();editor.commands.redo();await waitSaved();return {undoPaste,undoCut,redo:editor.state.doc.eq(nativeReview.source),saved:await clip.saved()}');
    for(const [name,ok] of Object.entries(report.paste))assert.equal(ok,true,'System cut/paste: '+name);
    clipboard.writeText('NATIVE-PLAIN-PASTE');
    await execute('closeHistory();editor.commands.setTextSelection(nativeReview.cut-2);editor.view.focus()');
    win.webContents.paste();
    await until('editor.state.doc.textContent.includes("NATIVE-PLAIN-PASTE")');
    report.external=await execute('await waitSaved();closeHistory();editor.commands.undo();await waitSaved();return {undo:editor.state.doc.eq(nativeReview.source),saved:await clip.saved()}');
    assert.deepEqual(report.external,{undo:true,saved:true});save();
    await execute('closeHistory();const list=clip.find("paragraph","native-list");editor.commands.setTextSelection(list.pos+list.node.nodeSize-1);editor.view.focus()');
    win.webContents.paste();
    await until('clip.find("paragraph","native-list").node.textContent.includes("NATIVE-PLAIN-PASTE")');
    await key('Return',['shift']);
    report.list=await execute('const list=clip.find("paragraph","native-list");return {paste:list.node.textContent.includes("NATIVE-PLAIN-PASTE"),hardBreak:list.node.lastChild?.type.name==="hardBreak",items:editor.state.selection.$from.node(-1).childCount}');
    assert.equal(report.list.hardBreak,true,'Shift+Enter must insert BR in the same paragraph');
    await key('Return');
    report.list.newItem=await execute('let items=0;editor.state.doc.descendants(node=>{if(node.type.name==="orderedList")items=node.childCount});return items===2');
    assert.equal(report.list.newItem,true,'Enter must create another list item');
    report.list.undo=await execute('await waitSaved();closeHistory();editor.commands.undo();await waitSaved();return editor.state.doc.eq(nativeReview.source)&&await clip.saved()');
    assert.equal(report.list.undo,true);save();

    await execute('window.nativeReviewStored=JSON.stringify(editor.getJSON());window.nativeReviewDOM=editor.view.dom;window.mountChapterFixture()');
    await until('window.ready&&editor&&!editor.isDestroyed&&editor.view.dom!==nativeReviewDOM');
    await execute('setPages(true)');
    await until('layoutReady()&&!layout().error');
    report.reopen=await execute('return JSON.stringify(editor.getJSON())===nativeReviewStored');
    assert.equal(report.reopen,true);
    report.pdf=await exportClipboard(context);
    report.errors=await execute('return errors');assert.deepEqual(report.errors,[]);
    report.passed=Object.values(report.arrows).every(Boolean);save();
    assert.equal(report.passed,true,'Vertical navigation did not cross the visual page boundary');
  } catch(error) {report.failure={message:error.message,stack:error.stack};save();throw error}
  finally {
    restoreClipboard(previous);
    report.clipboardRestored=readClipboard()===previous;
    save();assert.equal(report.clipboardRestored,true,'Restore original clipboard formats');
  }
  console.log('PASS native keyboard, drag and system clipboard:',artifacts);
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';
  process.env.HIGHTEX_NATIVE_INTERACTIONS='1';
  require('./editor-pagination.cjs');
}
