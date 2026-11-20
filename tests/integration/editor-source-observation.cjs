const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.run = async ({execute, artifacts}) => {
  const report = await execute(`
    setPages(false);await waitSaved();
    const {observeDocumentSources}=await import('/src/editor/storage/document-source-observer.ts');
    const controller=new AbortController(),kind='application/x-observer-fixture';
    const blob=value=>new Blob([new Uint8Array(16384).fill(value)],{type:kind});
    await db.images.bulkPut([
      {id:'observer-owned',documentId:'observer-case',blob:blob(1)},
      {id:'observer-foreign',documentId:'another-document',blob:blob(2)},
    ]);
    let buffer=[{type:'paragraph',content:[{type:'text',text:'initial'}]}];
    await db.chapters.put({id:'observer-case.1',content:buffer});
    let reads=0,changes=0;
    const original=Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer=function(){if(this.type===kind)reads++;return original.call(this)};
    const waitFor=async predicate=>{
      const end=performance.now()+2500;
      while(!predicate()){if(performance.now()>end)throw Error('Source observation did not settle');await new Promise(resolve=>setTimeout(resolve,10))}
    };
    const settle=()=>new Promise(resolve=>setTimeout(resolve,100));
    const observer=observeDocumentSources(['observer-case'],()=>changes++,controller.signal,
      {chapterBuffer:{id:'observer-case.1',content:()=>buffer}});
    try{
      await observer.ready;const initialReads=reads;
      for(let index=0;index<3;index++){
        buffer=[{type:'paragraph',content:[{type:'text',text:'autosave '+index}]}];
        await db.chapters.put({id:'observer-case.1',content:buffer});await settle();
      }
      const autosave={reads:reads-initialReads,changes};
      await db.chapters.put({id:'observer-case.1',content:[{type:'paragraph',content:[{type:'text',text:'external write'}]}]});
      await waitFor(()=>changes>autosave.changes);const external={reads:reads-initialReads,changes};
      let previous=changes;
      await db.images.update('observer-owned',{blob:blob(3)});
      await waitFor(()=>changes>previous);const replacement={reads,changes};
      buffer=[...buffer,{type:'image',attrs:{src:'observer-foreign'}}];
      previous=changes;
      await db.chapters.put({id:'observer-case.1',content:buffer});
      await waitFor(()=>changes>previous);await settle();const referenced={reads,changes};
      previous=changes;
      await db.images.update('observer-foreign',{blob:blob(4)});
      await waitFor(()=>changes>previous);const foreignReplacement={reads,changes};
      previous=changes;
      await db.images.delete('observer-foreign');
      await waitFor(()=>changes>previous);const deletion={reads,changes};
      controller.abort();const stoppedChanges=changes,stoppedReads=reads;
      await db.images.update('observer-owned',{blob:blob(5)});await settle();
      const stopped=changes===stoppedChanges&&reads===stoppedReads;
      const unconditionalController=new AbortController();let unconditionalChanges=0;
      const unconditional=observeDocumentSources(['observer-case'],()=>unconditionalChanges++,unconditionalController.signal,{compareContent:false});
      try{
        await unconditional.ready;const startReads=reads;
        await db.images.update('observer-owned',{blob:blob(5)});
        await waitFor(()=>unconditionalChanges>0);
        return {initialReads,autosave,external,replacement,referenced,foreignReplacement,deletion,stopped,
          unconditional:{changes:unconditionalChanges,reads:reads-startReads}};
      }finally{unconditional.stop()}

    }finally{
      observer.stop();Blob.prototype.arrayBuffer=original;
      await db.chapters.delete('observer-case.1');await db.images.bulkDelete(['observer-owned','observer-foreign']);
    }
  `);
  fs.writeFileSync(path.join(artifacts,'source-observation.json'),JSON.stringify(report,null,2));
  assert.equal(report.initialReads,1);
  assert.deepEqual(report.autosave,{reads:0,changes:0});
  assert.equal(report.external.reads,0);
  assert.ok(report.replacement.reads>report.initialReads);
  assert.ok(report.foreignReplacement.changes>report.referenced.changes);
  assert.ok(report.deletion.changes>report.foreignReplacement.changes);
  assert.equal(report.stopped,true);
  assert.ok(report.unconditional.changes>0);assert.equal(report.unconditional.reads,0);
  console.log('PASS source observation:',artifacts,JSON.stringify(report));
};
