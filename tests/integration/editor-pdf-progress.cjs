const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {PDFDocument} = require('pdf-lib');
const {BrowserWindow,ipcMain} = require('electron');

// Actual capture/UI/IPC/host lifecycle; native bytes are synthetic to hold precise stages.
exports.run = async ({execute,until,win,artifacts,editorPDFTest}) => {
  editorPDFTest.connect(win.webContents.getURL());
  await execute(`setPages(false);editor.commands.setContent({type:'doc',content:[{type:'heading',attrs:{level:1,id:'progress-heading'},content:[{type:'text',text:'Progress export'}]},p('Isi dokumen untuk progress ekspor.') ]});await waitSaved();setPages(true)`);
  await until("layoutReady()&&!document.querySelector('[data-editor-pdf-export]').disabled");
  await execute(`
    const {DocumentRenderSession}=await import('/src/document-export/document-render.ts');
    window.captureProgressHold={original:DocumentRenderSession.prototype.render,entered:false};
    DocumentRenderSession.prototype.render=function(signal,options,hooks){
      return captureProgressHold.original.call(this,signal,options,engine=>{
        hooks?.(engine);
        let sections=0;
        engine.events.on('section.before',()=>{
          if(++sections===2&&!captureProgressHold.entered){
            captureProgressHold.entered=true;
            return new Promise(resolve=>captureProgressHold.release=resolve);
          }
        });
      });
    };
  `);
  const source = await execute('return JSON.stringify(editor.getJSON())');
  let calls = 0, holdAt = 2, held, release;
  editorPDFTest.overrideNativePrint(async host => {
    calls++;
    if(calls===holdAt){
      held=host;
      await new Promise(resolve=>{
        release=resolve;
        host.once('closed',resolve);
      });
      if(host.isDestroyed())throw Error('Synthetic print interrupted by host cancellation');
    }
    const size = await host.webContents.executeJavaScript(`(()=>{const paper=document.querySelector('[data-print-viewport]');return {width:parseFloat(paper.style.width),height:parseFloat(paper.style.height)}})()`);
    const pdf = await PDFDocument.create();pdf.addPage([size.width*.75,size.height*.75]);
    return pdf.save();
  });
  try {
    await execute("document.querySelector('[data-editor-pdf-export]').click()");
    await until("captureProgressHold.entered&&document.querySelector('[data-editor-pdf-phase=capture]')?.textContent.includes('1/')");
    const capture = await execute("return document.querySelector('[data-editor-pdf-phase=capture]').textContent");
    await execute("captureProgressHold.release()");
    await until("document.querySelector('[data-editor-pdf-phase=export]')?.textContent.includes('1/')");
    assert.ok(held,'Fixture did not pause the second native strip');
    await execute("window.exportTimerAtHold=document.querySelector('[data-editor-pdf-elapsed]').textContent");
    await until("document.querySelector('[data-editor-pdf-elapsed]')?.textContent!==exportTimerAtHold");
    const progress = await execute(`return {text:document.querySelector('[data-editor-pdf-progress]').textContent,timer:document.querySelector('[data-editor-pdf-elapsed]').textContent,cancelEnabled:!document.querySelector('[data-editor-pdf-cancel]').disabled}`);
    assert.equal(progress.cancelEnabled,true);
    win.webContents.send('experimental:editor-pdf:progress','stale-request',{stage:'writing',pages:99,completedPages:99});
    await execute('await new Promise(requestAnimationFrame)');
    assert.equal(await execute("return document.querySelector('[data-editor-pdf-progress]').textContent"),progress.text);
    fs.writeFileSync(path.join(artifacts,'pdf-progress.png'),(await win.webContents.capturePage()).toPNG());
    release();
    await until("!document.querySelector('[data-editor-pdf-export]').disabled&&document.querySelector('[data-editor-pdf-completed=saved]')");
    assert.equal(fs.existsSync(editorPDFTest.outputs[0]),true);
    const completed = await execute("return document.querySelector('[data-editor-pdf-completed]').textContent");
    holdAt = calls+1;held=undefined;
    await execute("document.querySelector('[data-editor-pdf-export]').click()");
    await until("document.querySelector('[data-editor-pdf-phase=export]')?.textContent.includes('0/')");
    const deadline=Date.now()+5000;
    while(!held&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
    assert.ok(held);
    await execute("document.querySelector('[data-editor-pdf-cancel]').click()");
    await until("!document.querySelector('[data-editor-pdf-export]').disabled&&document.querySelector('[data-editor-pdf-completed=cancelled]')");
    assert.equal(held.isDestroyed(),true);
    assert.equal(fs.existsSync(editorPDFTest.outputs[1]),false);
    assert.equal(ipcMain.listenerCount('experimental:editor-pdf:ready'),0);
    assert.equal(BrowserWindow.getAllWindows().filter(window=>window!==win&&window.webContents.getURL().includes('/experimental/editor-pdf/print')).length,0);
    assert.equal(await execute('return JSON.stringify(editor.getJSON())'),source);
    assert.deepEqual(await execute('return errors'),[]);
    const cancelled = await execute("return document.querySelector('[data-editor-pdf-completed]').textContent");
    fs.writeFileSync(path.join(artifacts,'pdf-cancelled.png'),(await win.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(artifacts,'pdf-progress.json'),JSON.stringify({scope:'real capture/UI/IPC/host; synthetic native PDF bytes, not a performance measurement',capture,progress,completed,cancelled,foreignProgressIgnored:true,cancelDestroysHost:true,noCancelledFile:true,sourceUnchanged:true},null,2));
    console.log('PASS PDF progress and cancellation:',artifacts);
  } finally {
    release?.();editorPDFTest.overrideNativePrint(undefined);
    await execute("captureProgressHold.release?.();(await import('/src/document-export/document-render.ts')).DocumentRenderSession.prototype.render=captureProgressHold.original");
  }
};
