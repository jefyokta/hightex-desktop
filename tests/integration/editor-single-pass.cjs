const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {PDFDocument}=require('pdf-lib');

exports.run=async({execute,win,artifacts,editorPDFTest})=>{
 editorPDFTest.connect(win.webContents.getURL());
 const snapshot=await execute(`
  setPages(false);await waitSaved();
  const {captureDocumentContexts}=await import('/src/document-export/snapshot/capture-contexts.ts');
  const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
  const {chapterPages}=await import('/src/document-engine/renderers/chapter-pages.ts');
  const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
  const geometry=paginationGeometry(),paper=document.createElement('div'),root=document.createElement('div');
  paper.style.cssText='position:absolute;left:-10000px;top:0;width:'+geometry.width+'px;height:'+(geometry.stride*3)+'px;background:white;color:black';
  root.className='tiptap';root.style.position='relative';paper.append(root);
  for(let index=0;index<3;index++){
   const paragraph=document.createElement('p');paragraph.id='single-page-'+index;
   paragraph.textContent='SINGLE-PAGE-'+(index+1)+' Text with canonical position.';
   paragraph.style.cssText='position:absolute;margin:0;left:100px;top:'+(index*geometry.stride+100)+'px;font:16px/24px Times New Roman';root.append(paragraph);
  }
  const flow=document.createElement('p');flow.style.cssText='position:absolute;margin:0;left:100px;top:'+(geometry.stride-50)+'px;font:16px/24px Times New Roman';
  flow.innerHTML='FLOW-BEFORE<br><span style="display:block;height:60px"></span>FLOW-AFTER';root.append(flow);
  document.body.append(paper);
  const pages=chapterPages({paper,root,pages:3,sources:[]},geometry);
  try{return await captureDocumentContexts(pages,{documentId:'fixture',title:'Single pass probe',author:'Fixture',sourceHash:'a'.repeat(64),planHash:'b'.repeat(64),sections:[{id:'1',firstPage:1,pages:3,labels:['1','2','3']}]},new DocumentResources(new AbortController().signal),'',new AbortController().signal)}
  finally{pages.forEach(page=>page.element.remove());paper.remove()}
 `);
 const baseline=await editorPDFTest.generate(snapshot,4);
 fs.writeFileSync(path.join(artifacts,'single-baseline.pdf'),baseline.bytes);
 const next=await editorPDFTest.generateSinglePass(snapshot);
 fs.writeFileSync(path.join(artifacts,'single-pass.pdf'),next.bytes);
 const pdf=await PDFDocument.load(next.bytes);
 const baselineText=execFileSync('pdftotext',['-layout',path.join(artifacts,'single-baseline.pdf'),'-'],{encoding:'utf8'});
 const nextText=execFileSync('pdftotext',['-layout',path.join(artifacts,'single-pass.pdf'),'-'],{encoding:'utf8'});
 const report={baseline:{ms:baseline.ms,calls:baseline.calls},next:{ms:next.ms,calls:next.calls,nativePages:next.nativePages,pages:pdf.getPageCount()},text:baselineText===nextText};
 fs.writeFileSync(path.join(artifacts,'single-pass.json'),JSON.stringify(report,null,2));
 assert.equal(next.nativePages,3);assert.equal(pdf.getPageCount(),3);assert.equal(report.text,true);
 console.log('PASS single-pass probe:',artifacts,JSON.stringify(report));
};
