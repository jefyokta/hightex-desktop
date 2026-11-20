const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {PDFDocument,PDFName,PDFDict,PDFArray,PDFString} = require('pdf-lib');

function annotations(document) {
  return document.getPages().map(page => (page.node.Annots()?.asArray()??[]).map(ref=>{
    const annotation=document.context.lookup(ref,PDFDict);
    const rect=annotation.lookup(PDFName.of('Rect'),PDFArray).asArray().map(item=>Number(item.toString()));
    const destination=annotation.lookupMaybe(PDFName.of('Dest'),PDFArray);
    if(destination)return {rect,page:document.getPages().findIndex(item=>item.ref.toString()===destination.get(0).toString()),point:destination.asArray().slice(1).map(item=>item.toString())};
    const action=annotation.lookup(PDFName.of('A'),PDFDict);
    return {rect,uri:action.lookup(PDFName.of('URI'),PDFString).decodeText()};
  }));
}

exports.run = async ({execute,win,artifacts,editorPDFTest}) => {
  editorPDFTest.connect(win.webContents.getURL());
  const snapshot=await execute(`
    setPages(false);await waitSaved();
    const {chapterPages}=await import('/src/document-engine/renderers/chapter-pages.ts');
    const {captureDocumentContexts}=await import('/src/document-export/snapshot/capture-contexts.ts');
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
    const geometry=paginationGeometry();
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=75;
    const paint=canvas.getContext('2d');paint.fillStyle='#2a7396';paint.fillRect(0,0,160,75);paint.fillStyle='white';paint.font='18px serif';paint.fillText('Raster pixels',10,40);
    const image=canvas.toDataURL('image/png');
    const contexts=[],pages=[];
    let serial=0;
    for(const count of [16,2]){
      const paper=document.createElement('div'),root=document.createElement('div');
      paper.style.cssText='position:absolute;left:-10000px;top:0;width:'+geometry.width+'px;height:'+(count*geometry.stride)+'px;background:white;color:black';
      root.className='tiptap';root.style.cssText='position:relative;margin:0;padding:0';paper.append(root);
      for(let index=0;index<count;index++){
        const marker=++serial,block=document.createElement('section');
        block.style.cssText='position:absolute;top:'+(index*geometry.stride+40)+'px;left:40px;width:520px;font:16px/24px "Times New Roman";color:black';
        block.innerHTML='<h2 id="batch-'+marker+'" style="font: bold 20px/28px Times New Roman">BATCH-PAGE-'+marker+'</h2>'+ 
          '<p>Selectable text with <i>italic</i>, <b>bold</b>, and a hard<br>break.</p>'+ 
          '<ol start="'+marker+'"><li>Numbered item '+marker+'</li></ol>'+ 
          '<table style="border-collapse:collapse;width:100%"><thead><tr><th style="border:1px solid black">Header '+marker+'</th></tr></thead><tbody><tr><td style="border:1px solid black">Cell '+marker+'</td></tr></tbody></table>'+ 
          '<p><a href="#batch-18">Jump to final page</a> / <a href="https://example.com/page/'+marker+'">External link</a></p>'+
          '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="75"><rect width="160" height="75" fill="rgb(30,130,90)"/><text x="10" y="35" fill="white">Vector '+marker+'</text></svg>';
        const picture=document.createElement('img');picture.src=image;picture.width=160;picture.height=75;block.append(picture);
        root.append(block);
      }
      document.body.append(paper);contexts.push(paper);
      pages.push(...chapterPages({paper,root,pages:count,sources:[]},geometry));
    }
    const signal=new AbortController().signal;
    try{return await captureDocumentContexts(pages,{documentId:'fixture',title:'Native batch comparison',author:'Fixture',
      sourceHash:'a'.repeat(64),planHash:'b'.repeat(64),sections:[{id:'1',firstPage:1,pages:16,labels:Array.from({length:16},(_,index)=>String(index+1))},{id:'2',firstPage:17,pages:2,labels:['17','18']}]},
      new DocumentResources(signal),'',signal);
    }finally{contexts.forEach(node=>node.remove());pages.forEach(page=>page.element.remove())}
  `);
  const report={pages:18,contexts:2,runs:[]};
  const documents=[];
  for(const batch of [4,8,8,4]){
    const result=await editorPDFTest.generate(snapshot,batch);
    const file=path.join(artifacts,'native-batch-'+documents.length+'-'+batch+'.pdf');fs.writeFileSync(file,result.bytes);
    const pdf=await PDFDocument.load(result.bytes);documents.push(pdf);
    assert.equal(pdf.getPageCount(),18);
    const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
    text.split('\f').slice(0,18).forEach((page,index)=>assert.ok(page.includes('BATCH-PAGE-'+(index+1))));
    const directory=path.join(artifacts,'raster-'+(documents.length-1));fs.mkdirSync(directory);
    execFileSync('pdftoppm',['-png','-scale-to','900',file,path.join(directory,'page')]);
    report.runs.push({batch,ms:result.ms,calls:result.calls,bytes:result.bytes.length,text});
  }
  fs.writeFileSync(path.join(artifacts,'native-batches-runs.json'),JSON.stringify({...report,runs:report.runs.map(({text,...run})=>run)},null,2));
  for(let index=1;index<documents.length;index++){
    assert.deepEqual(documents[0].getPages().map(page=>page.getSize()),documents[index].getPages().map(page=>page.getSize()));
    assert.deepEqual(annotations(documents[0]),annotations(documents[index]));
    assert.equal(report.runs[0].text,report.runs[index].text);
  }
  const visual=JSON.parse(execFileSync('python3',['-c',`
import json
from pathlib import Path
from PIL import Image, ImageChops
root=Path(${JSON.stringify(artifacts)})
result=[]
for run in range(1,4):
 for left in sorted((root/'raster-0').glob('*.png')):
  right=root/('raster-'+str(run))/left.name
  a=Image.open(left).convert('RGB');b=Image.open(right).convert('RGB')
  result.append({'run':run,'page':left.name,'same':a.size==b.size and ImageChops.difference(a,b).getbbox() is None})
print(json.dumps(result))
`],{encoding:'utf8'}));
  report.visual=visual;report.geometry=true;report.links=true;report.text=true;
  report.runs.forEach(run=>delete run.text);
  fs.writeFileSync(path.join(artifacts,'native-batches.json'),JSON.stringify(report,null,2));
  assert.ok(visual.length===54&&visual.every(page=>page.same),'Raster difference: '+JSON.stringify(visual.filter(page=>!page.same)));
  console.log('PASS native batch comparison:',artifacts,JSON.stringify(report));
};
