// Bounded human-document smoke: real document and active-chapter capture, no app build.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { PDFDocument } = require('pdf-lib');
const { containsPDFSourceText } = require('./page-plan-pdf.cjs');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function comparePresentation(expected,actual){
  assert.equal(actual.length,expected.length,'Context count changed');
  let boxes=0,changed=0,maxDifference=0;
  for(let surface=0;surface<expected.length;surface++){
    assert.equal(actual[surface].length,expected[surface].length,'Context '+surface+' changed box/line count');
    for(let box=0;box<expected[surface].length;box++){
      boxes++;
      const difference=Math.max(...expected[surface][box].map((value,index)=>Math.abs(value-actual[surface][box][index])));
      if(difference)changed++;
      maxDifference=Math.max(maxDifference,difference);
      assert.ok(difference<=.75,'Context '+surface+', box '+box+' exceeds the existing 0.75 px presentation tolerance');
    }
  }
  return {contexts:actual.length,boxes,changed,maxDifference,tolerancePixels:.75};
}
exports.comparePresentation=comparePresentation;

exports.run = async ({ execute, until, artifacts, files, importArchive, editorPDFTest }) => {
  const report = { scope: 'Human archive copy, canonical capture from document-only and actual Bab 4 editor; no native PDF acceptance claim.' };
  const save = () => fs.writeFileSync(path.join(artifacts,'core-mvp.json'),JSON.stringify(report,null,2));
  try {
    const file = files.find(file => file.label==='doc-03');assert.ok(file,'Missing selected human reproduction');
    report.input={label:file.label,sha256:file.originalHash,...await importArchive(execute,file)};save();
    const capture = expression => execute(`
      const {documentPageSamples}=await import('/tests/helpers/document-page-samples.ts');
      const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('MVP human capture deadline')),45000);
      try {
        window.mvpSamples=[];
        const snapshot=await archiveCapture(${expression},task.signal,engine=>engine.events.on('rendered',()=>{
          window.mvpSamples=documentPageSamples(engine.documentPages).samples;
        }));
        window.mvpSnapshot=snapshot;
        const {documentLayoutCache}=await import('/src/editor/document/layout-cache.ts');
        return {pages:snapshot.pages,sections:snapshot.sections,sourceHash:snapshot.sourceHash,
          html:snapshot.html,
          projection:snapshot.projection,presentation:snapshot.presentation,cache:documentLayoutCache().stats,
          unchanged:archiveBefore===await archiveSavedSource(archiveContext.id)};
      } finally {clearTimeout(timer)}
    `);
    const start=Date.now(),documentOnly=await capture('archiveContext');
    fs.writeFileSync(path.join(artifacts,'document-context.html'),documentOnly.html);
    fs.writeFileSync(path.join(artifacts,'document-presentation.json'),JSON.stringify(documentOnly.presentation));
    report.document={pages:documentOnly.pages,sections:documentOnly.sections,sourceHash:documentOnly.sourceHash,
      projectionHash:digest(documentOnly.projection),presentationHash:digest(documentOnly.presentation),cache:documentOnly.cache,ms:Date.now()-start};
    assert.equal(documentOnly.unchanged,true,'Document capture changed stored source');save();
    await execute("await window.config.set({editor:{pagination:true}});window.mountApplication('/document/'+archiveContext.id+'/4')");
    await until("applicationEditor&&!applicationEditor.isDestroyed&&applicationChapter()===archiveContext.id+'.4'&&applicationLayout()&&(applicationLayout().error||!archivePaginationKey.getState(applicationEditor.state).pending)",30000);
    report.editor=await execute(`
      const state=archivePaginationKey.getState(applicationEditor.state);
      return {pages:state.layout.pages,error:state.error,failed:!!state.layout.error,immutable:!!state.result&&Object.isFrozen(state.result)};
    `);
    assert.equal(report.editor.failed,false,report.editor.error);assert.equal(report.editor.immutable,true);
    const active=await capture('applicationEditor');
    fs.writeFileSync(path.join(artifacts,'active4-context.html'),active.html);
    fs.writeFileSync(path.join(artifacts,'active4-presentation.json'),JSON.stringify(active.presentation));
    report.geometryDifferences=[];
    for(let surface=0;surface<documentOnly.presentation.length;surface++){
      const before=documentOnly.presentation[surface],after=active.presentation[surface];
      if(before.length!==after.length)report.geometryDifferences.push({surface,before:before.length,after:after.length});
      for(let box=0;box<Math.min(before.length,after.length);box++)
        if(before[box].some((value,index)=>value!==after[box][index])){
          if(report.geometryDifferences.length<30)report.geometryDifferences.push({surface,box,before:before[box],after:after[box]});
        }
    }
    report.active4={pages:active.pages,sections:active.sections,sourceHash:active.sourceHash,
      projectionHash:digest(active.projection),presentationHash:digest(active.presentation),cache:active.cache};
    save();
    assert.equal(active.unchanged,true,'Active-chapter capture changed stored source');
    assert.deepEqual(active.sections,documentOnly.sections,'Active Bab 4 changed section layout');
    assert.equal(active.sourceHash,documentOnly.sourceHash,'Active Bab 4 changed source revision');
    assert.equal(report.active4.projectionHash,report.document.projectionHash,'Active Bab 4 changed final page/target/link placement');
    report.presentation=comparePresentation(documentOnly.presentation,active.presentation);
    report.navigation=[];
    for(const chapter of ['1','attachment']){
      await execute(`window.navigate('/document/'+archiveContext.id+'/'+${JSON.stringify(chapter)})`);
      await until(`applicationEditor&&!applicationEditor.isDestroyed&&applicationChapter()===archiveContext.id+'.'+${JSON.stringify(chapter)}&&archivePaginationKey.getState(applicationEditor.state)?.result&&!archivePaginationKey.getState(applicationEditor.state).pending`,30000);
      const captured=await capture('applicationEditor');
      assert.equal(captured.unchanged,true,'Navigation changed stored source');
      assert.equal(captured.sourceHash,documentOnly.sourceHash,'Navigation changed the source revision');
      assert.deepEqual(captured.sections,documentOnly.sections,'Navigation changed page labels/layout');
      assert.equal(digest(captured.projection),report.document.projectionHash,'Navigation changed final destinations/links');
      report.navigation.push({chapter,pages:captured.pages,presentation:comparePresentation(documentOnly.presentation,captured.presentation)});save();
    }
    if(process.env.HIGHTEX_CORE_MVP_PRINT){
      report.native={stage:'printing'};save();
      await execute("await window.editorPDFExperimental.export(mvpSnapshot,crypto.randomUUID())");
      const output=editorPDFTest.outputs.at(-1),pdf=await PDFDocument.load(fs.readFileSync(output));
      assert.equal(pdf.getPageCount(),active.pages,'Native PDF changed the page count');
      const samples=await execute('return mvpSamples');assert.ok(samples.length>=50,'Too few editable source pages were sampled');
      const text=execFileSync('pdftotext',['-layout',output,'-'],{encoding:'utf8',maxBuffer:32*1024*1024}).split('\f');
      const raw=execFileSync('pdftotext',['-raw',output,'-'],{encoding:'utf8',maxBuffer:32*1024*1024}).split('\f');
      const missing=samples.filter(sample=>!containsPDFSourceText(sample.text,text[sample.page-1]??'',raw[sample.page-1]??''));
      fs.writeFileSync(path.join(artifacts,'native-source-samples.json'),JSON.stringify({samples,missing},null,2));
      report.native={pages:pdf.getPageCount(),samples:samples.length,missing:missing.length};save();
      assert.equal(missing.length,0,'Native PDF lost or reassigned sampled editable text');
      fs.copyFileSync(output,path.join(artifacts,'human-mvp.pdf'));
    }
    report.complete=true;save();console.log('PASS: human Bab 4 capture and cache equivalence. Artifacts:',artifacts);
  } catch(error) {report.failure={message:error.message,stack:error.stack};save();throw error;}
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';process.env.HIGHTEX_EDITOR_PDF_ARCHIVES='1';
  process.env.HIGHTEX_PAGINATION_DOCUMENTS??=path.resolve(__dirname,'../../hightex-files');
  process.env.HIGHTEX_CORE_MVP='1';process.env.HIGHTEX_PAGINATION_DOCUMENT_FILTER='doc-03';
  require('./editor-pagination.cjs');
}
