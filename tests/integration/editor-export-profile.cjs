// Opt-in timing of one local archive, using isolated storage and the real export owners.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {PDFDocument} = require('pdf-lib');
const {execFileSync} = require('node:child_process');
exports.run = async ({execute,win,artifacts,files,importArchive,editorPDFTest}) => {
  assert.equal(files.length,1,'Select exactly one archive for bounded profiling');
  const report={label:files[0].label,stages:[],native:null};
  const save=()=>fs.writeFileSync(path.join(artifacts,'export-profile.json'),JSON.stringify(report,null,2));
  save();
  await execute('setPages(false);await waitSaved()');
  await importArchive(execute,files[0]);
  console.log('Archive profile: imported',files[0].label,artifacts);
  report.capture=await execute(`
    window.exportProfile=[];
    const {DocumentRenderSession}=await import('/src/document-export/document-render.ts');
    const {ChapterLayoutCompiler}=await import('/src/document-engine/layout/chapter-compiler.ts');
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const {TemplateSectionRenderer}=await import('/src/document-engine/renderers/template.ts');
    for(const [owner,name,tag] of [
      [DocumentRenderSession.prototype,'render','document.render'],
      [ChapterLayoutCompiler.prototype,'compile','chapter.compile'],
      [ChapterLayoutCompiler.prototype,'paginate','chapter.paginate'],
      [TemplateSectionRenderer.prototype,'render','template.render'],
      [DocumentResources.prototype,'prepare','resources.prepare'],
      [DocumentResources.prototype,'styles','resources.styles'],
      [DocumentResources.prototype,'layoutFingerprint','resources.fingerprint'],
    ]){
      const original=owner[name];owner[name]=async function(...args){
        const record={name:tag,section:args[0]?.sectionId??args[0]?.id,start:performance.now()};exportProfile.push(record);
        try{return await original.apply(this,args)}finally{record.ms=performance.now()-record.start}
      };
    }
    const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Profile capture deadline')),120000);
    const started=performance.now();
    try{
      window.archiveSnapshot=await archiveCapture(archiveContext,task.signal,engine=>{
        engine.events.on('section.before',event=>exportProfile.push({name:'section.before',section:event.section.id,start:performance.now()}));
        engine.events.on('section.after',event=>exportProfile.push({name:'section.after',section:event.sectionId,pages:event.pages,start:performance.now()}));
      });
      return {ms:performance.now()-started,pages:archiveSnapshot.pages,htmlBytes:archiveSnapshot.html.length,sections:archiveSnapshot.sections,
        sourceUnchanged:archiveBefore===await archiveSavedSource(archiveContext.id),timings:exportProfile};
    }finally{clearTimeout(timer)}
  `);
  save();
  console.log('Archive profile: capture',report.capture.ms,'ms',report.capture.pages,'pages');
  assert.equal(report.capture.sourceUnchanged,true);
  assert.ok(report.capture.pages<150,'Fixture exceeds the selected archive budget');
  if(process.env.HIGHTEX_EXPORT_PROFILE_CAPTURE_ONLY)return;
  editorPDFTest.connect(win.webContents.getURL());
  const snapshot=await execute('return archiveSnapshot');
  const result=await editorPDFTest.generate(snapshot,4);
  const file=path.join(artifacts,'profile.pdf');fs.writeFileSync(file,result.bytes);
  const pdf=await PDFDocument.load(result.bytes);
  report.native={ms:result.ms,calls:result.calls,pages:pdf.getPageCount(),bytes:result.bytes.length};
  assert.equal(pdf.getPageCount(),snapshot.pages);
  fs.writeFileSync(path.join(artifacts,'profile-text.txt'),execFileSync('pdftotext',['-layout',file,'-'],{maxBuffer:32*1024*1024}));
  if(process.env.HIGHTEX_COMPARE_LEGACY){
    const input=await execute('return {id:archiveContext.id,profile:await window.profile.get(),picture:await window.profile.picture(),categories:await window.hightex.categories(),config:window.config.get()}');
    console.log('Archive profile: legacy start');
    report.legacy=await editorPDFTest.legacyProfile(win.webContents.getURL(),input);
    report.sourceUnchangedAfterLegacy=await execute('return archiveBefore===await archiveSavedSource(archiveContext.id)');
    assert.equal(report.sourceUnchangedAfterLegacy,true);
  }
  save();
  console.log('PASS archive export profile:',artifacts,JSON.stringify({captureMs:report.capture.ms,...report.native}));
};
