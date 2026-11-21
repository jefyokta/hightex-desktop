const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {PDFDocument} = require('pdf-lib');
const {annotations} = require('./editor-native-batches.cjs');

exports.replay = async ({win,artifacts,editorPDFTest}) => {
  editorPDFTest.connect(win.webContents.getURL());
  const frozen = process.env.HIGHTEX_NAMED_BATCH_REPLAY;
  const baseline = process.env.HIGHTEX_NAMED_BATCH_BASELINE ?? path.join(path.dirname(frozen),'baseline.pdf');
  const snapshot = JSON.parse(fs.readFileSync(frozen,'utf8'));
  console.log('Named batch replay:',artifacts,'pages',snapshot.pages);
  const result = await editorPDFTest.generateNamedBatches(snapshot);
  const file = path.join(artifacts,result.invalidDiagnosticOutput?'diagnostic-no-leader.pdf':'named-batch.pdf');fs.writeFileSync(file,result.bytes);
  if(process.env.HIGHTEX_PDF_NATIVE_TRACE||process.env.HIGHTEX_PDF_PROCESS_PROFILE){console.log('Native print diagnostic captured:',artifacts);return;}
  const expected = await PDFDocument.load(fs.readFileSync(baseline));
  const actual = await PDFDocument.load(result.bytes);
  const text = pdf => execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8',maxBuffer:32*1024*1024});
  const before = text(baseline), after = text(file);
  fs.writeFileSync(path.join(artifacts,'named-batch-text.txt'),after);
  const pages = before.split('\f'), nextPages = after.split('\f');
  const report = {
    fingerprint:snapshot.fingerprint,sameFrozenSnapshot:true,baseline,
    timing:{ms:result.ms,hostMs:result.hostMs,projectionMs:result.projectionMs,printMs:result.printMs,assemblyMs:result.assemblyMs},
    calls:result.calls,nativePages:result.nativePages,physicalPages:actual.getPageCount(),bytes:result.bytes.length,
    textIdentical:before===after,
    textDifferentPages:pages.flatMap((value,index)=>value.replace(/\s/g,'')===nextPages[index]?.replace(/\s/g,'')?[]:[index+1]),
    geometryDifferentPages:expected.getPages().flatMap((page,index)=>JSON.stringify(page.getSize())===JSON.stringify(actual.getPage(index)?.getSize())?[]:[{page:index+1,before:page.getSize(),after:actual.getPage(index)?.getSize()}]),
    linksIdentical:JSON.stringify(annotations(expected))===JSON.stringify(annotations(actual)),
    linkCounts:{before:annotations(expected).flat().length,after:annotations(actual).flat().length},
  };
  const save = () => fs.writeFileSync(path.join(artifacts,'named-batch-audit.json'),JSON.stringify(report,null,2));
  save();console.log('Named batch structural audit:',JSON.stringify(report));
  const baselineRaster = process.env.HIGHTEX_NAMED_BATCH_BASELINE_RASTER ?? path.join(artifacts,'baseline-raster');
  if(!process.env.HIGHTEX_NAMED_BATCH_BASELINE_RASTER){
    fs.mkdirSync(baselineRaster,{recursive:true});
    execFileSync('pdftoppm',['-png','-r','96',baseline,path.join(baselineRaster,'page')],{timeout:60000});
  }
  const raster = path.join(artifacts,'candidate-raster');fs.mkdirSync(raster);
  execFileSync('pdftoppm',['-png','-r','96',file,path.join(raster,'page')],{timeout:60000});
  report.visual = JSON.parse(execFileSync('python3',['-c',`
import json
from pathlib import Path
from PIL import Image, ImageChops
left=Path(${JSON.stringify(baselineRaster)});right=Path(${JSON.stringify(raster)})
result=[]
for p in sorted(left.glob('*.png')):
 a=Image.open(p).convert('RGB');b=Image.open(right/p.name).convert('RGB')
 result.append({'page':p.name,'same':a.size==b.size and ImageChops.difference(a,b).getbbox() is None})
print(json.dumps({'dpi':96,'pages':len(result),'different':[p for p in result if not p['same']]}))
  `],{encoding:'utf8'}));
  save();console.log('Named batch raster audit:',JSON.stringify(report.visual));
  assert.equal(actual.getPageCount(),snapshot.pages);
  assert.equal(report.textDifferentPages.length,0);
  assert.equal(report.geometryDifferentPages.length,0);
  assert.equal(report.linksIdentical,true);
  assert.equal(report.visual.pages,snapshot.pages);
  // Raster differences remain visible diagnostics. Acceptance concerns page breaks
  // and content geometry; numeric edge antialiasing is reviewed separately.
  console.log('Structural checks passed; see coordinate/image/raster diagnostics:',artifacts);
};
