const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PDFDocument } = require('pdf-lib');

exports.run = async ({execute,win,artifacts,editorPDFTest}) => {
  editorPDFTest.connect(win.webContents.getURL());
  const captured=await execute(`
    const {captureMaterializedPages}=await import('/tests/helpers/capture-materialized-pages.ts');
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const {validateEditorPDFSnapshot}=await import('/shared/editor-pdf-contract.ts');
    const root=document.createElement('main');root.style.cssText='position:absolute;left:-10000px;top:0';
    for(let index=0;index<2;index++){
      const page=document.createElement('div');page.className='editor-page-fragment';page.style.cssText='width:600px;height:800px;position:relative';
      page.dataset.documentSection='1';page.dataset.pageLabel=String(index+1);
      const content=document.createElement('div');content.className='tiptap';
      const p=document.createElement('p');p.id='adapter-page-'+index;p.textContent='ADAPTER-PAGE-'+index;
      content.append(p);page.append(content);root.append(page);
    }
    document.body.append(root);
    const resources=new DocumentResources(new AbortController().signal);
    try {
      window.adapterSnapshot=await captureMaterializedPages(root,{documentId:'fixture',chapterId:'fixture.1',title:'Diagnostic adapter',author:'Writer',
        sourceHash:'a'.repeat(64),planHash:'b'.repeat(64)},resources,'',new AbortController().signal);
      validateEditorPDFSnapshot(adapterSnapshot);
      return {version:adapterSnapshot.version,pages:adapterSnapshot.pages,sections:adapterSnapshot.sections,views:adapterSnapshot.projection.views,contexts:adapterSnapshot.projection.contexts.length};
    }finally{root.remove()}
  `);
  assert.equal(captured.version,3);assert.equal(captured.pages,2);assert.equal(captured.contexts,2);
  assert.deepEqual(captured.sections,[{id:'1',firstPage:1,pages:2,labels:['1','2']}]);
  if(process.env.HIGHTEX_CANONICAL_DEBUG){
    const {BrowserWindow}=require('electron');
    await execute('window.adapterDebug=window.editorPDFExperimental.debug(adapterSnapshot,crypto.randomUUID())');
    const deadline=Date.now()+15000;let debug;
    while(Date.now()<deadline){
      debug=BrowserWindow.getAllWindows().find(window=>!window.isDestroyed()&&window.webContents.getURL().includes('&debug=1'));
      if(debug&&await debug.webContents.executeJavaScript("!!document.querySelector('[data-debug-export]')").catch(()=>false))break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.ok(debug);
    const state=await debug.webContents.executeJavaScript(`({controls:!!document.querySelector('[data-debug-export]'),viewport:!!document.querySelector('[data-print-viewport]'),appRoutes:performance.getEntriesByType('resource').some(entry=>entry.name.includes('/src/App.tsx'))})`);
    assert.deepEqual(state,{controls:true,viewport:true,appRoutes:false});
    fs.writeFileSync(path.join(artifacts,'lightweight-print-debug.json'),JSON.stringify(state,null,2));
    debug.destroy();await execute('await adapterDebug');
    console.log('PASS lightweight print/debug entry:',artifacts);return;
  }
  await execute('await window.editorPDFExperimental.export(adapterSnapshot,crypto.randomUUID())');
  const file=editorPDFTest.outputs.at(-1),pdf=await PDFDocument.load(fs.readFileSync(file));
  assert.equal(pdf.getPageCount(),2);
  const text=execFileSync('pdftotext',['-raw',file,'-'],{encoding:'utf8'}).split('\f');
  assert.ok(text[0].includes('ADAPTER-PAGE-0'));assert.ok(text[1].includes('ADAPTER-PAGE-1'));
  fs.writeFileSync(path.join(artifacts,'canonical-adapter.json'),JSON.stringify({...captured,nativePages:2,correctTextPages:true},null,2));
  console.log('PASS canonical diagnostic adapter:',artifacts);
};
