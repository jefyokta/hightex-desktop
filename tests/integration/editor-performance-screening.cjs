const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { performance } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const { PDFDocument } = require('pdf-lib');
const { installInputMetrics, disposeInputMetrics, inputBatch, settled } = require('./editor-input-metrics.cjs');

exports.run = async context => {
  const {execute,until,win,artifacts,editorPDFTest}=context;
  const report={scope:'Bounded chapter input screening and frozen whole-document native export; no approved numeric performance gate.',
    hardware:{cpu:os.cpus()[0].model,cores:os.cpus().length,ram:os.totalmem(),os:os.release()},
    protocol:{samples:6,modes:['baseline','off','on'],exports:2,baseline:'Same editor without pagination plugin; software-rendered Chromium, trusted targeted keys. Two RAFs are a paint opportunity proxy, not physical display latency.'},cases:[]};
  const save=()=>fs.writeFileSync(path.join(artifacts,'performance-screening.json'),JSON.stringify(report,null,2));
  editorPDFTest.connect(win.webContents.getURL());
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:true});
  try {
    await installInputMetrics(execute);
    await execute(`
      benchmark.install=async mode=>{
        if(benchmarkKey.getState(editor.state))editor.commands.setEditorPagination(false);
        if(mode==='baseline')editor.unregisterPlugin(benchmarkKey);
        else if(!benchmarkKey.getState(editor.state))editor.registerPlugin(benchmark.plugin);
        benchmark.mode=mode;editor.commands.setContent(benchmark.input);await waitSaved();
        editor.view.focus();editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize+1);
        if(mode==='on')editor.commands.setEditorPagination(true);
      };
    `);
    for(const variant of ['paragraphs','mixed']) {
      const entry={variant,runs:[]};report.cases.push(entry);
      Object.assign(entry,await execute(`
        if(!benchmarkKey.getState(editor.state))editor.registerPlugin(benchmark.plugin);
        setPages(false);
        const content=[{type:'heading',attrs:{level:1,id:'performance-heading'},content:[{type:'text',text:'Pengukuran '+${JSON.stringify(variant)}}]},
          ...Array.from({length:20},(_,i)=>({type:'paragraph',attrs:{id:'performance-p-'+i},content:[{type:'text',text:'Paragraf '+i+' '+sentence.repeat(3)}]}))];
        ${variant==='mixed'?`
          content.splice(8,0,{type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'LIST-PERFORMANCE'},{type:'hardBreak'},{type:'text',text:sentence.repeat(4)}]}]}]},
            makeTable(30),{type:'imageFigure',attrs:{id:'performance-image'},content:[{type:'image',attrs:{src:'fixture-image',width:300}},
              {type:'figcaption',content:[{type:'text',text:'Gambar performance'}]}]});
        `:''}
        content.push(p('PERFORMANCE-END'));editor.commands.setContent({type:'doc',content});await waitSaved();
        benchmark.input=editor.getJSON();benchmark.coldStart=performance.now();setPages(true);
        return {characters:editor.state.doc.textContent.length};
      `));
      await settled(context,25000);
      Object.assign(entry,await execute('return {pages:layout().pages,coldReadyMs:performance.now()-benchmark.coldStart}'));save();
      for(const mode of report.protocol.modes){
        await execute(`await benchmark.install(${JSON.stringify(mode)})`);await settled(context,25000);
        entry.runs.push({mode,...await inputBatch(context,'paced',6)});save();
      }
    }
    await execute("await benchmark.install('on')");await settled(context,25000);
    const captured=await execute(`
      const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
      const before=JSON.stringify(editor.getJSON()),task=new AbortController(),timer=setTimeout(()=>task.abort(Error('Performance capture deadline')),45000);
      const start=performance.now();
      try {
        window.performanceSnapshot=await captureDocumentPDF(editor,task.signal);
        return {ms:performance.now()-start,pages:performanceSnapshot.pages,version:performanceSnapshot.version,
          fingerprint:performanceSnapshot.fingerprint,sourceUnchanged:before===JSON.stringify(editor.getJSON())};
      }finally{clearTimeout(timer)}
    `);
    assert.equal(captured.version,3);assert.equal(captured.sourceUnchanged,true);
    report.capture=captured;report.exports=[];save();
    for(let round=0;round<2;round++){
      const start=performance.now();
      await execute('await window.editorPDFExperimental.export(performanceSnapshot,crypto.randomUUID())');
      const ms=performance.now()-start,file=editorPDFTest.outputs.at(-1),bytes=fs.readFileSync(file),pdf=await PDFDocument.load(bytes);
      const metadata=JSON.parse(pdf.getSubject());
      assert.equal(metadata.fingerprint,captured.fingerprint);assert.equal(pdf.getPageCount(),captured.pages);
      assert.ok(execFileSync('pdftotext',['-raw',file,'-'],{encoding:'utf8'}).includes('PERFORMANCE-END'));
      report.exports.push({round:round+1,ms,bytes:bytes.length,pages:pdf.getPageCount(),sameSnapshot:true});save();
    }
    report.errors=await execute('return errors');assert.deepEqual(report.errors,[]);
    report.complete=true;save();console.log('PASS bounded performance screening:',artifacts);
  }catch(error){report.failure={message:error.message,stack:error.stack};save();throw error}
  finally{
    await disposeInputMetrics(execute);
    await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:false});
    win.webContents.debugger.detach();
  }
};
