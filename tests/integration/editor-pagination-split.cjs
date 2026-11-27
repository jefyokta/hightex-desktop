// Actual Splitter UI: canonical PDF upload and stored HighTex -> canonical native IPC -> ZIP.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {PDFDocument,PDFDict,PDFName}=require('pdf-lib');
const {unzipSync}=require('fflate');const {execFileSync}=require('node:child_process');

exports.run=async({execute,until,artifacts,editorPDFTest})=>{
  const report={cases:[]};const save=()=>fs.writeFileSync(path.join(artifacts,'pagination-split.json'),JSON.stringify(report,null,2));
  console.log('Split artifacts:',artifacts);
  const signed=[];
  for(const marker of ['SIGNEDSTATEMENT','SIGNEDAPPROVAL','SIGNEDPLAGIARISM']){
    const pdf=await PDFDocument.create();pdf.addPage().drawText(marker);signed.push(Array.from(await pdf.save()));
  }
  const originalBytes=fs.readFileSync(process.env.HIGHTEX_SPLIT_PDF);
  const original=await PDFDocument.load(originalBytes);
  console.log('Split source loaded:',original.getPageCount(),'pages');
  const mount=async()=>{
    await execute(`
      window.file={save:async(name,bytes)=>{window.splitZip={name,bytes:Array.from(bytes)};return 'fixture/'+name}};
      window.splitZip=undefined;
      const {mountSplitterFixture,setSplitterFile}=await import('/tests/helpers/splitter-ui.tsx');
      window.setSplitterFile=setSplitterFile;window.unmountSplitter=mountSplitterFixture();
    `);
    await until(`document.querySelectorAll('#splitter-fixture input[type=file]').length===4`);
    console.log('Split UI mounted');
  };
  const fillSigned=async offset=>{
    for(let i=0;i<3;i++)await execute(`setSplitterFile(${i+offset},${JSON.stringify(signed[i])},'signed-${i}.pdf')`);
  };
  const start=async()=>{
    await execute(`const {t}=await import('/src/utils/lang.ts');Array.from(document.querySelectorAll('#splitter-fixture button')).find(button=>button.textContent.trim()===t('split.start')).click()`);
    console.log('Split job started');
    await until('!!window.splitZip',120000);
  };
  const inspect=async(name,privateMarker,closingMarker,source)=>{
    const zip=await execute('return splitZip');assert.equal(zip.name,'splitted.zip');
    const files=unzipSync(new Uint8Array(zip.bytes));assert.deepEqual(Object.keys(files).sort(),['original.pdf','payload.json','private.pdf','public.pdf']);
    const item={name,files:{}};
    for(const [filename,bytes]of Object.entries(files)){
      const file=path.join(artifacts,name+'-'+filename);fs.writeFileSync(file,bytes);
      if(!filename.endsWith('.pdf'))continue;
      const pdf=await PDFDocument.load(bytes),text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',maxBuffer:16*1024*1024});
      item.files[filename]={pages:pdf.getPageCount(),bytes:bytes.length};
      if(filename==='public.pdf'){
        assert.ok(!text.includes(privateMarker),'Private text leaked into public PDF');assert.ok(text.includes(closingMarker),'Closing chapter missing from public PDF');
        for(const marker of ['SIGNEDSTATEMENT','SIGNEDAPPROVAL','SIGNEDPLAGIARISM'])assert.ok(text.includes(marker));
        const pageObjects=pdf.context.enumerateIndirectObjects().filter(([,object])=>object instanceof PDFDict&&object.get(PDFName.of('Type'))?.toString()==='/Page');
        assert.equal(pageObjects.length,pdf.getPageCount(),'Excluded page objects leaked through internal destinations');
      }
      if(filename==='private.pdf'){assert.ok(text.includes(privateMarker));assert.ok(!text.includes(closingMarker));}
      if(filename==='original.pdf'){
        assert.ok(text.includes(privateMarker)&&text.includes(closingMarker));
        if(source)assert.equal(pdf.getPageCount(),source.getPageCount());
      }
    }
    const payload=JSON.parse(Buffer.from(files['payload.json']).toString());
    assert.equal(payload.kind,'editor-document-experimental');
    item.metadata=payload;report.cases.push(item);save();
  };
  await execute('setPages(false);await waitSaved()');console.log('Split source saved');
  if(!process.env.HIGHTEX_SPLIT_HIGHTEX_ONLY){
    await mount();await execute(`setSplitterFile(0,${JSON.stringify(Array.from(originalBytes))},'canonical.pdf')`);
    await fillSigned(1);await start();await inspect('pdf','EQH004','EQH005',original);await execute('unmountSplitter()');
  }
  await execute(`
    const category={id:1,name:'Split fixture',variant:'thesis',chapters:Array.from({length:5},(_,i)=>({chapter:String(i+1),title:'Bab '+(i+1)}))};
    window.hightex.categories=async()=>[structuredClone(category)];
    const rows=Array.from({length:5},(_,i)=>({id:'fixture.'+(i+1),content:[{type:'heading',attrs:{level:1,id:'split-chapter-'+(i+1)},content:[{type:'text',text:'Bab '+(i+1)}]},p('SPLITCHAPTER'+(i+1))]}));
    await db.chapters.bulkPut(rows);window.splitStored=JSON.stringify(await db.chapters.toArray());
    window.splitDocuments=JSON.stringify(await db.documents.toArray());
  `);
  editorPDFTest.connect(await execute('return location.href'));
  await mount();
  await execute(`document.querySelector('#splitter-fixture #main-hightex').click()`);
  await until(`document.querySelectorAll('#splitter-fixture input[type=file]').length===3`);
  await execute(`document.querySelector('#splitter-fixture [role=combobox]').click()`);
  await until(`document.querySelector('[role=option]')`);
  await execute(`document.querySelector('[role=option]').click()`);
  await fillSigned(0);await start();await inspect('hightex','SPLITCHAPTER4','SPLITCHAPTER5');
  assert.equal(await execute('return splitStored===JSON.stringify(await db.chapters.toArray())'),true,'Split export changed authored source');
  assert.equal(await execute('return splitDocuments===JSON.stringify(await db.documents.toArray())'),true,'Split export changed document/profile');
  report.errors=await execute('return errors');assert.deepEqual(report.errors,[]);report.complete=true;save();await execute('unmountSplitter()');
  console.log('PASS actual Splitter UI:',report.cases.map(item=>item.name).join(', '),artifacts);
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_PAGINATION_SPLIT='1';process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';require('./editor-pagination.cjs')}
