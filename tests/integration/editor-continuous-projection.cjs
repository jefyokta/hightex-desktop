const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow, app } = require('electron');
const { PDFDocument } = require('pdf-lib');
const { execFileSync } = require('node:child_process');
const { prepareEquivalence, verifyPDFMarkers } = require('./editor-pdf-equivalence.cjs');
const { measureContent, compareContent } = require('./editor-pdf-geometry.cjs');
const { pdfLinkDestinations } = require('./editor-page-fragments.cjs');
const { compactPDFSourceText } = require('./page-plan-pdf.cjs');

const { prepareProjectionInput } = require('./section-projection-input.cjs');


exports.run = async context => {
  const { artifacts } = context;
  const report = { scope:'One canonical DOM, native stride slicing and page-box cropping; isolated feasibility, not feature acceptance.' };
  const save=()=>fs.writeFileSync(path.join(artifacts,'continuous-projection.json'),JSON.stringify(report,null,2));
  let printWindow;
  try {
    await prepareEquivalence(context);
    const compiled=await prepareProjectionInput(context);
    report.pages=compiled.pages;report.nodes=compiled.nodes;report.sourceUnchanged=compiled.sourceUnchanged;
    report.cloneGeometry=compareContent(compiled.live,compiled.clone,0.75);
    assert.equal(compiled.sourceUnchanged,true);
    assert.ok(compiled.nodes.projection<=compiled.nodes.source+2,'Projection multiplied the section DOM');
    const htmlPath=path.join(artifacts,'continuous-projection.html');
    fs.writeFileSync(htmlPath,compiled.html);
    fs.writeFileSync(path.join(artifacts,'continuous-source-metrics.json'),JSON.stringify(compiled.live,null,2));
    printWindow=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false}});
    await printWindow.loadFile(htmlPath);
    await printWindow.webContents.executeJavaScript(`(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images,image=>image.decode()))})()`);
    const inWindow=await printWindow.webContents.executeJavaScript(`(${measureContent.toString()})([{root:document.querySelector('[data-continuous-projection]'),paper:document.querySelector('[data-continuous-projection]')}],${JSON.stringify(compiled.geometry)})`);
    report.windowGeometry=compareContent(compiled.live,inWindow,0.75);save();
    const start=Date.now();
    const bytes=await printWindow.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,margins:{top:0,bottom:0,left:0,right:0}});
    report.nativePrintMs=Date.now()-start;
    fs.writeFileSync(path.join(artifacts,'continuous-uncropped.pdf'),bytes);
    const pdf=await PDFDocument.load(bytes);
    report.nativePages=pdf.getPageCount();
    assert.equal(pdf.getPageCount(),compiled.pages,'Native fragmentation changed the page plan');
    const width=compiled.geometry.width*.75,height=compiled.geometry.height*.75,gap=compiled.geometry.gap*.75;
    for(const page of pdf.getPages()) { page.setMediaBox(0,gap,width,height);page.setCropBox(0,gap,width,height); }
    const final=await pdf.save(),file=path.join(artifacts,'continuous-projection.pdf');fs.writeFileSync(file,final);
    report.nativeWordBounds=verifyPDFMarkers(file,compiled.live.words);
    report.linkPages=await pdfLinkDestinations(final);
    assert.equal(report.linkPages.length,3);assert.ok(report.linkPages.includes(compiled.targetPage));
    const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
    report.tableMarkers=Array.from({length:6},(_,index)=>({marker:'EQM00'+index,count:compactPDFSourceText(text).split('EQM00'+index).length-1}));
    assert.ok(report.tableMarkers.every(marker=>marker.count===1),'Clipping changed merged table text multiplicity');
    report.rendererMemory=app.getAppMetrics().find(metric=>metric.pid===printWindow.webContents.getOSProcessId())?.memory;
    report.complete=true;save();console.log('PASS: single-flow projection proof. Artifacts:',artifacts);
  } catch(error) {report.failure={message:error.message,stack:error.stack};save();throw error;}
  finally {if(printWindow&&!printWindow.isDestroyed())printWindow.destroy()}
};

if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';process.env.HIGHTEX_EDITOR_EQUIVALENCE='1';process.env.HIGHTEX_CONTINUOUS_PROJECTION='1';
  require('./editor-pagination.cjs');
}
