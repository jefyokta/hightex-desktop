// One current document: toolbar, shared cancellation, workspace export, watermark and historical source.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');const {PDFDocument}=require('pdf-lib');
exports.run=async({execute,until,win,artifacts,editorPDFTest})=>{
  const report={exports:[]};const save=()=>fs.writeFileSync(path.join(artifacts,'single-pagination.json'),JSON.stringify(report,null,2));
  const previous=process.env.HIGHTEX_SINGLE_RESUME?JSON.parse(fs.readFileSync(process.env.HIGHTEX_SINGLE_RESUME,'utf8')):undefined;
  if(previous)report.resumedFrom=process.env.HIGHTEX_SINGLE_RESUME;
  console.log('Single pagination artifacts:',artifacts);
  await execute(`
    setPages(false);await waitSaved();window.editor.sourceFile=async()=>undefined;window.application={isDev:false};
    window.legacyPDFCalls=[];window.ipcRenderer={invoke:async(channel)=>{legacyPDFCalls.push(channel);throw Error('Unexpected legacy IPC '+channel)}};
    window.hightex.onPdfProgress=()=>{throw Error('Unexpected legacy progress subscription')};
    await db.chapters.put({id:'fixture.1',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'Introduction'}]},p('MIGRATIONCURRENT. '+sentence.repeat(8)),{type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[p('MIGRATIONLIST satu')]},{type:'listItem',content:[p('MIGRATIONLIST dua')]}]},makeTable(4),p('MIGRATIONEND')]});
    ${previous?`await db.chapters.bulkPut(${JSON.stringify(previous.fixtureSources)});`:''}
    await window.config.set({editor:{pagination:false}});window.mountApplication();
  `);
  await until('applicationEditor?.isEditable&&applicationLayout().pages&&!applicationLayout().error');
  await until(`document.querySelector('[data-pagination-status]')`);
  report.enabledDespiteOldOffPreference=await execute(`const {paginationKey}=await import('/src/editor/pagination/state.ts');return paginationKey.getState(applicationEditor.state).enabled`);
  assert.equal(report.enabledDespiteOldOffPreference,true);
  report.fixtureSources=await execute('await waitSaved();window.migrationStored=JSON.stringify(await db.chapters.toArray());return JSON.parse(migrationStored)');save();
  editorPDFTest.connect(await execute('return location.href'));
  // Hold only this UI capture so cancellation is deterministic, without slowing native print.
  if(!previous){await execute(`
    const {DocumentRenderSession}=await import('/src/document-export/document-render.ts');const {abortable}=await import('/src/utils/abortable.ts');
    window.migrationRender=DocumentRenderSession.prototype.render;
    DocumentRenderSession.prototype.render=async function(signal,...args){window.migrationHeld=true;await abortable(new Promise(resolve=>window.migrationRelease=resolve),signal);return migrationRender.call(this,signal,...args)};
    document.querySelector('[data-tour="editor-pdf"]').click();
  `);
  await until('window.migrationHeld&&applicationPDF.busy');
  assert.equal(await execute(`return document.querySelector('[data-editor-pdf-export]').disabled`),true,'Toolbar and page export must share one job');
  await execute(`document.querySelector('[data-editor-pdf-cancel]').click();const {DocumentRenderSession}=await import('/src/document-export/document-render.ts');DocumentRenderSession.prototype.render=migrationRender;migrationRelease()`);
  await until('!applicationPDF.busy');
  assert.equal(await execute('return applicationPDF.outcome'),'cancelled');report.sharedCaptureCancellation=true;
  }else report.sharedCaptureCancellation=previous.sharedCaptureCancellation;
  const exported=async(name,click)=>{
    const count=editorPDFTest.outputs.length;
    if(typeof click==='function')await click();else await execute(click);
    await until(`!!document.querySelector('[data-editor-pdf-completed="saved"],[data-editor-pdf-error]')`,90000);
    const error=await execute(`return document.querySelector('[data-editor-pdf-error]')?.textContent`);
    if(error){report.failure=error;save();throw Error(error)}
    assert.equal(editorPDFTest.outputs.length,count+1);
    const file=editorPDFTest.outputs.at(-1),pdf=await PDFDocument.load(fs.readFileSync(file));
    const bbox=execFileSync('pdftotext',['-bbox',file,'-'],{encoding:'utf8',maxBuffer:16*1024*1024});
    const item={name,file,pages:pdf.getPageCount(),metadata:JSON.parse(pdf.getSubject())};report.exports.push(item);save();
    return {item,pdf,bbox,pages:bbox.match(/<page\s[^>]*>[\s\S]*?<\/page>/g)};
  };
  let toolbar;
  if(previous){
    const item=previous.exports.find(item=>item.name==='toolbar'),pdf=await PDFDocument.load(fs.readFileSync(item.file));
    const bbox=execFileSync('pdftotext',['-bbox',item.file,'-'],{encoding:'utf8',maxBuffer:16*1024*1024});
    toolbar={item,pdf,bbox,pages:bbox.match(/<page\s[^>]*>[\s\S]*?<\/page>/g)};report.exports.push(item);save();
  }else toolbar=await exported('toolbar',`document.querySelector('[data-tour="editor-pdf"]').click()`);
  assert.ok(toolbar.bbox.includes('MIGRATIONCURRENT'));assert.equal(toolbar.item.metadata.hasWm,false);
  await execute(`const {workspacePDFRow}=await import('/tests/helpers/workspace-pdf-row.tsx');mountCustomFixture(workspacePDFRow(await db.documents.get('fixture')))`);
  await until(`document.querySelector('[data-tour="document-actions"]')`);
  const rowClick=async watermark=>{
    const key=watermark?'export_watermark':'export_pdf';
    const point=await execute(`const button=document.querySelector('[data-tour="document-actions"]'),box=button.getBoundingClientRect();const {t}=await import('/src/utils/lang.ts');window.migrationMenuLabel=t('dashboard.${key}');return {x:Math.round(box.left+box.width/2),y:Math.round(box.top+box.height/2)}`);
    win.show();win.focus();win.webContents.focus();
    win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});
    win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});
    await until(`Array.from(document.querySelectorAll('[role="menuitem"]')).some(item=>item.textContent.trim()===migrationMenuLabel)`);
    assert.equal(await execute(`return document.body.hasAttribute('data-scroll-locked')`),false,'Export menu must not change the presentation stylesheet lifecycle');
    await execute(`Array.from(document.querySelectorAll('[role="menuitem"]')).find(item=>item.textContent.trim()===migrationMenuLabel).click()`);
  };
  let workspace;
  if(previous?.exports.some(item=>item.name==='workspace')){
    const item=previous.exports.find(item=>item.name==='workspace'),pdf=await PDFDocument.load(fs.readFileSync(item.file));
    const bbox=execFileSync('pdftotext',['-bbox',item.file,'-'],{encoding:'utf8',maxBuffer:16*1024*1024});
    workspace={item,pdf,bbox,pages:bbox.match(/<page\s[^>]*>[\s\S]*?<\/page>/g)};report.exports.push(item);save();
  }else workspace=await exported('workspace',()=>rowClick(false));
  assert.deepEqual(workspace.pages,toolbar.pages,'Workspace and active editor PDF text/X/Y differ');
  assert.equal(workspace.item.metadata.sourceHash,toolbar.item.metadata.sourceHash);
  // A second action must wait for its new job, not the previous success label.
  if(previous?.watermark){report.watermark=previous.watermark;save();}else{
  await rowClick(true);await until(`!document.querySelector('[data-editor-pdf-completed="saved"]')`);
  await until(`!!document.querySelector('[data-editor-pdf-completed="saved"]')`,90000);
  const wmFile=editorPDFTest.outputs.at(-1),wm=await PDFDocument.load(fs.readFileSync(wmFile));
  const wmBoxes=execFileSync('pdftotext',['-bbox',wmFile,'-'],{encoding:'utf8',maxBuffer:16*1024*1024}).match(/<page\s[^>]*>[\s\S]*?<\/page>/g);
  assert.deepEqual(wmBoxes,toolbar.pages,'Watermark changed text or page geometry');
  assert.equal(JSON.parse(wm.getSubject()).hasWm,true);
  const images=execFileSync('pdfimages',['-list',wmFile],{encoding:'utf8'});assert.ok(images.split('\n').length>wm.getPageCount());
  report.watermark={file:wmFile,pages:wm.getPageCount(),wordTextAndXYExact:true,imageList:images};save();
  }
  assert.equal(await execute('return migrationStored===JSON.stringify(await db.chapters.toArray())'),true);
  await execute(`
    const rows=await db.chapters.toArray();await db.chapters.bulkPut(rows.map(row=>({...row,id:row.id+'.v1'})));
    const old=await db.chapters.get('fixture.1.v1');old.content[1].content=[{type:'text',text:'MIGRATIONHISTORY'}];await db.chapters.put(old);
    window.migrationHistoryStored=JSON.stringify(await db.chapters.toArray());window.mountApplication('/document/fixture/1/v1');
  `);
  await until('applicationEditor?.isEditable&&applicationChapter()==="fixture.1.v1"&&!applicationLayout().error');
  const history=await exported('historical',`document.querySelector('[data-tour="editor-pdf"]').click()`);
  assert.ok(history.bbox.includes('MIGRATIONHISTORY'));assert.ok(!history.bbox.includes('MIGRATIONCURRENT'));
  assert.equal(await execute('return migrationHistoryStored===JSON.stringify(await db.chapters.toArray())'),true);
  report.legacyCalls=await execute('return legacyPDFCalls');assert.deepEqual(report.legacyCalls,[]);
  report.errors=await execute('return errors');assert.deepEqual(report.errors,[]);report.complete=true;save();
  console.log('PASS single pagination through actual toolbar/workspace/watermark/history:',artifacts);
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_SINGLE_PAGINATION='1';process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';require('./editor-pagination.cjs')}
