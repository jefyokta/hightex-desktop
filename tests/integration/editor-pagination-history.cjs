// Current edited tables across document-only, active chapters and real application navigation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PDFDocument}=require('pdf-lib');
const {execFileSync}=require('node:child_process');

exports.run=async({execute,until,artifacts,editorPDFTest})=>{
  const report={captures:[]};const save=()=>fs.writeFileSync(path.join(artifacts,'pagination-history.json'),JSON.stringify(report,null,2));
  console.log('History artifacts:',artifacts);
  const prior=JSON.parse(fs.readFileSync(process.env.HIGHTEX_HISTORY_SOURCE,'utf8'));
  const sources=Object.fromEntries(prior.edits.filter(item=>item.source).map(item=>[item.variant,item.source.content]));
  await execute(`
    setPages(false);await waitSaved();
    // The isolated fixture already owns its IDB source; there is no external archive file.
    window.editor.sourceFile=async()=>undefined;
    window.application={isDev:false};
    const {ChapterExtensions}=await import('/src/editor/chapter/chapter-extensions.ts');
    const {chapterSnapshotSource}=await import('/src/editor/chapter/snapshot-source.ts');
    const {getSchema}=window.nativeEditor;
    const {Document}=await import('/src/editor/document/index.ts');
    const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
    const {documentLayoutCache}=await import('/src/editor/document/layout-cache.ts');
    const {paginationKey}=await import('/src/editor/pagination/state.ts');
    const h=text=>({type:'heading',attrs:{level:1},content:[{type:'text',text}]});
    const sources=${JSON.stringify(sources)};
    const category={id:1,name:'Readiness',variant:'thesis',chapters:[{chapter:'1',title:'Matrix native'},{chapter:'2',title:'Matrix native'},{chapter:'3',title:'Metode'},{chapter:'4',title:'Hasil'},{chapter:'5',title:'Penutup'}]};
    window.hightex.categories=async()=>[structuredClone(category)];
    const chapters={'1':sources.merged,'2':sources.nested,'3':[h('Metode'),p('EQH003 Metode penelitian.')],'4':[h('Hasil'),p('EQH004 Hasil pengujian.')],'5':[h('Penutup'),p('EQH005 Kesimpulan.')],attachment:[h('Lampiran A'),p('EQH006 Lampiran.'),h('Lampiran B'),p('EQH007 Lampiran lanjutan.')]};
    await db.chapters.bulkPut(Object.entries(chapters).map(([id,nodes])=>({id:'fixture.'+id,content:chapterSnapshotSource(getSchema(ChapterExtensions.contentSchema(id)),nodes,'fixture.'+id).toJSON().content})));
    window.historyDocument=await new Document('fixture').warm({workspaceIdentity:false,forEditing:true});
    documentLayoutCache().clear();
    window.historyCapture=captureDocumentPDF;window.historyKey=paginationKey;
    window.historyStored=JSON.stringify(await db.chapters.toArray());
    window.historyState=()=>applicationEditor&&!applicationEditor.isDestroyed&&paginationKey.getState(applicationEditor.state);
  `);
  const capture=async(name,expression)=>{
    const snapshot=await execute(`window.historySnapshot=await historyCapture(${expression},new AbortController().signal);return historySnapshot`);
    fs.writeFileSync(path.join(artifacts,name+'-snapshot.json'),JSON.stringify(snapshot));
    assert.equal(await execute('return historyStored===JSON.stringify(await db.chapters.toArray())'),true,name+': capture/navigation wrote source');
    report.captures.push({name,pages:snapshot.pages,sourceHash:snapshot.sourceHash,sections:snapshot.sections});save();
    return snapshot;
  };
  const cold=await capture('document-only','historyDocument');
  await execute(`await window.config.set({editor:{pagination:true}});window.mountApplication('/document/fixture/1')`);
  for(const chapter of ['1','4','2','attachment','1']){
    if(chapter!=='1'||report.captures.length>1)await execute(`window.navigate('/document/fixture/${chapter}')`);
    await until(`window.applicationEditor?.isEditable&&applicationChapter()==='fixture.${chapter}'&&historyState()?.result&&!historyState().pending&&historyState().numbering&&!historyState().numbering.pending`,30000);
    const current=await capture('active-'+chapter,'applicationEditor');
    assert.equal(current.sourceHash,cold.sourceHash,'Source revision differs by active chapter');
    assert.deepEqual(current.sections,cold.sections,'Page breaks/labels differ by active chapter');
    assert.deepEqual(current.projection,cold.projection,'Pages/targets/links differ by active chapter');
    assert.deepEqual(current.presentation,cold.presentation,'Content X/Y extents differ by active chapter');
  }
  editorPDFTest.connect(await execute('return location.href'));
  await execute('await window.editorPDFExperimental.export(historySnapshot,crypto.randomUUID())');
  const file=editorPDFTest.outputs.at(-1),pdf=await PDFDocument.load(fs.readFileSync(file));
  assert.equal(pdf.getPageCount(),cold.pages);
  const pages=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',maxBuffer:16*1024*1024}).split('\f');
  for(const [id,marker]of [['3','EQH003'],['4','EQH004'],['5','EQH005'],['attachment','EQH006']]){
    const section=cold.sections.find(section=>section.id===id);assert.ok(section);
    assert.ok(pages.slice(section.firstPage-1,section.firstPage-1+section.pages).join('').includes(marker),marker+' missing or wrong page');
  }
  report.native={pages:pdf.getPageCount(),file,subject:JSON.parse(pdf.getSubject())};
  report.errors=await execute('return errors');assert.deepEqual(report.errors,[]);report.complete=true;save();
  console.log('PASS identical source across document-only and chapter navigation:',artifacts);
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_PAGINATION_HISTORY='1';process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';require('./editor-pagination.cjs')}
