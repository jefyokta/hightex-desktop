const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {measureContent,compareContent} = require('./editor-pdf-geometry.cjs');
const {verifyPDFMarkers} = require('./editor-pdf-equivalence.cjs');
const {containsPDFSourceText} = require('./page-plan-pdf.cjs');

async function prepare({execute}) {
  await execute(`
    const h=(id,text)=>({type:'heading',attrs:{id,level:1},content:[{type:'text',text}]});
    const category={id:1,name:'Fixture',variant:'thesis',chapters:[{chapter:'1',title:'Introduction'},{chapter:'2',title:'Pengujian'}]};
    window.hightex.categories=async()=>[category];
    const citations=Array.from({length:42},(_,i)=>({key:'numbering-'+i,bib:'@article{numbering-'+i+',title={BIB'+String(i).padStart(3,'0')+' '+sentence.repeat(3)+'},author={Writer, Aria},year={2025},journal={Journal of Pagination},'+(i%2?'url={https://example.org/'+('longsegment'.repeat(10))+i+'}}':'doi={10.1234/'+('longidentifier'.repeat(9))+i+'}}')}));
    await db.cite.bulkPut(citations);
    await db.chapters.bulkPut([
      {id:'fixture.1',content:[h('numbering-first','Introduction'),...Array.from({length:12},()=>p(sentence.repeat(4)))]},
      {id:'fixture.2',content:[h('numbering-second','Pengujian'),p('EQC001 '+sentence.repeat(6)),{type:'paragraph',content:citations.flatMap(row=>[{type:'cite',attrs:{cite:row.key}},{type:'text',text:' '}])}]},
      {id:'fixture.foreword',content:[h('numbering-foreword','KATA PENGANTAR'),p('EQF001 '+sentence.repeat(45)),p('EQF002 Penutup pengantar.')]},
      {id:'fixture.attachment',content:[h('numbering-a','Lampiran pertama'),p('EQA001 '+sentence.repeat(32)),h('numbering-b','Lampiran kedua'),p('EQB001 '+sentence.repeat(25))]},
    ]);
    const {Storage}=await import('/src/editor/storage/index.ts');
    const {paginationKey}=await import('/src/editor/pagination/state.ts');
    const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
    const {paginationSection}=await import('/src/editor/pagination/section-context.ts');
    const {undoDepth,redoDepth}=window.nativeEditor;
    const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
    window.numberingTest={Storage,key:paginationKey,geometry:paginationGeometry,group:paginationSection,capture:captureDocumentPDF,undoDepth,redoDepth};
    window.numberingState=()=>applicationEditor&&!applicationEditor.isDestroyed&&paginationKey.getState(applicationEditor.state);
    window.numberingLabels=()=>Array.from(applicationEditor.view.dom.closest('.page').querySelectorAll('.editor-pagination-number'),node=>node.textContent);
    await window.config.set({editor:{pagination:true}});
    window.mountApplication();
  `);
}

async function ready(context,id) {
  await context.until(`window.applicationEditor?.isEditable&&applicationChapter()==='fixture.${id}'&&numberingState()?.enabled&&!numberingState().pending&&numberingState().numbering&&!numberingState().numbering.pending`,30000);
  const state=await context.execute('return {numbering:numberingState().numbering,layout:applicationLayout()}');
  assert.equal(state.layout.error,undefined,JSON.stringify(state));
  assert.equal(state.numbering.error,undefined,JSON.stringify(state));
}

async function captureSection(context,id) {
  const {execute,editorPDFTest,artifacts}=context;
  await execute(`window.navigate('/document/fixture/${id}')`);
  await ready(context,id);
  const before=await execute(`
    const e=applicationEditor, test=numberingTest;
    await test.Storage.instance.waitForDocument('fixture');
    const paper=e.view.dom.closest('.page');
    const geometry=test.geometry(numberingState().options,test.group(paper));
    test.baseline={source:JSON.stringify(e.getJSON()),stored:JSON.stringify(await db.chapters.toArray()),selection:JSON.stringify(e.state.selection.toJSON()),undo:test.undoDepth(e.state),redo:test.redoDepth(e.state)};
    test.live=(${measureContent.toString()})([{root:e.view.dom,paper},...Array.from(paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper}))],geometry);
    test.snapshot=await test.capture(e,new AbortController().signal);
    return {live:test.live,snapshot:test.snapshot,labels:numberingLabels()};
  `);
  const section=before.snapshot.sections.find(section=>section.id===id);
  assert.deepEqual(before.labels,section.labels,'Visible global labels differ from final PDF');
  let printed;
  editorPDFTest.inspectPrint(async win=>{
    printed=await win.webContents.executeJavaScript(`({content:(${measureContent.toString()})(Array.from(document.querySelectorAll('[data-document-section="${id}"]')).map(paper=>({root:paper,paper,page:Number(paper.dataset.documentPage)}))),bibliography:Array.from(document.querySelectorAll('[data-document-section="bibliography"]'),paper=>({page:Number(paper.dataset.documentPage),text:paper.innerText})),labels:Array.from(document.querySelectorAll('[data-document-section="${id}"] .editor-pagination-number'),node=>node.textContent)})`);
  });
  await execute('await window.editorPDFExperimental.export(numberingTest.snapshot,crypto.randomUUID())');
  const file=editorPDFTest.outputs.at(-1),offset=section.firstPage-1;
  assert.deepEqual(printed.labels,before.labels);
  const shifted={...before.live,glyphs:before.live.glyphs.map(item=>({...item,page:item.page+offset})),images:before.live.images.map(item=>({...item,page:item.page+offset}))};
  fs.writeFileSync(path.join(artifacts,'global-'+id+'-geometry.json'),JSON.stringify({expected:shifted,actual:printed.content},null,2));
  fs.writeFileSync(path.join(artifacts,'global-'+id+'.html'),before.snapshot.html);
  const geometry=compareContent(shifted,printed.content);
  const layout=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'}).split('\f');
  const raw=execFileSync('pdftotext',['-raw',file,'-'],{encoding:'utf8'}).split('\f');
  for(const run of before.live.runs) assert.ok(containsPDFSourceText(run.text,layout[run.page+offset-1],raw[run.page+offset-1]),'Source text moved from live page');
  const markers=verifyPDFMarkers(file,before.live.words.map(item=>({...item,page:item.page+offset})));
  const integrity=await execute(`const e=applicationEditor,t=numberingTest,b=t.baseline;return {source:b.source===JSON.stringify(e.getJSON()),stored:b.stored===JSON.stringify(await db.chapters.toArray()),selection:b.selection===JSON.stringify(e.state.selection.toJSON()),history:b.undo===t.undoDepth(e.state)&&b.redo===t.redoDepth(e.state),errors:window.errors}`);
  assert.deepEqual(integrity,{source:true,stored:true,selection:true,history:true,errors:[]});
  fs.copyFileSync(file,path.join(artifacts,'global-'+id+'.pdf'));
  return {section,geometry,markers,runs:before.live.runs.length,integrity,bibliography:before.snapshot.sections.find(section=>section.id==='bibliography')};
}

exports.runDocumentNumbering=async context=>{
  const {execute,until,artifacts,editorPDFTest}=context;
  const report={scope:'Actual application chapter navigation; live global labels and editable introduction/appendix versus native PDF'};
  const save=()=>fs.writeFileSync(path.join(artifacts,'document-numbering.json'),JSON.stringify(report,null,2));
  try {
    await prepare(context);
    await ready(context,'1');
    assert.equal(editorPDFTest.outputs.length,0,'Background numbering must not print');
    report.content=await captureSection(context,'2');
    assert.ok(Number(report.content.section.labels[0])>1,'Second chapter still starts at one');
    assert.ok(report.content.bibliography.pages>1,'Long bibliography must cross pages');
    const text=execFileSync('pdftotext',['-layout',editorPDFTest.outputs.at(-1),'-'],{encoding:'utf8'});
    for(let i=0;i<42;i++)assert.ok(text.includes('BIB'+String(i).padStart(3,'0')),'Bibliography entry lost');
    const compact=text.replace(/\s/g,'');
    for(let i=0;i<42;i++)assert.ok(compact.includes(i%2?'https://example.org/'+('longsegment'.repeat(10))+i:'https://doi.org/10.1234/'+('longidentifier'.repeat(9))+i),'Long DOI/URL lost or clipped');
    report.foreword=await captureSection(context,'foreword');
    assert.ok(report.foreword.section.labels[0]!=='i','Introduction ignores preceding front matter');
    report.appendix=await captureSection(context,'attachment');
    assert.ok(report.appendix.section.labels.includes('A - 1'));
    assert.ok(report.appendix.section.labels.includes('B - 1'));
    await execute("window.navigate('/document/fixture/2')");
    await ready(context,'2');
    const initial=await execute('return numberingLabels()[0]');
    report.reflow=await execute(`const before=JSON.stringify(applicationEditor.getJSON());const row=await db.chapters.get('fixture.1');row.content.push(...Array.from({length:16},()=>p(sentence.repeat(5))));await db.chapters.put(row);return {source:before}`);
    await until(`!numberingState().numbering.pending&&Number(numberingLabels()[0])>Number(${JSON.stringify(initial)})`,30000);
    report.reflow={before:initial,after:await execute('return numberingLabels()[0]'),sourceUnchanged:await execute(`return JSON.stringify(applicationEditor.getJSON())===${JSON.stringify(report.reflow.source)}`)};
    assert.equal(report.reflow.sourceUnchanged,true);
    await execute("applicationEditor.commands.insertContent('Edited during numbering ');window.navigate('/document/fixture/foreword');window.navigate('/document/fixture/attachment')");
    await ready(context,'attachment');
    await execute('await window.config.set({editor:{pagination:false}})');
    await until("!document.querySelector('.editor-pagination-sheets')&&!document.querySelector('.editor-pdf-pages')&&!document.querySelector('[data-pagination-measure]')");
    assert.deepEqual(await execute('return errors'),[]);
    report.passed=true;save();
    console.log('PASS: global editor/PDF labels, chapter-offset invalidation, editable front/appendix glyph parity, multipage bibliography and cancellation cleanup.');
    console.log('Document numbering evidence:',artifacts);
  } catch(error) {report.failure={message:error.message,stack:error.stack};save();throw error}
  finally {editorPDFTest.inspectPrint(undefined)}
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';
  process.env.HIGHTEX_DOCUMENT_NUMBERING='1';
  require('./editor-pagination.cjs');
}
