const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.run = async ({execute, until, artifacts}) => {
  await execute(`
    setPages(false);editor.commands.configureEditorPagination({documentNumbering:false});
    editor.commands.setContent({type:'doc',content:[
      {type:'heading',attrs:{level:1},content:[{type:'text',text:'Introduction'}]},
      p(sentence.repeat(6)),p('FLOW-END'),
    ]});await waitSaved();setPages(true);
  `);
  await until('layoutReady()&&!layout().error');
  const original = await execute(`return {source:JSON.stringify(editor.getJSON()),layout:JSON.stringify(layout()),selection:editor.state.selection.toJSON()}`);
  await execute('setPages(false);setPages(true)');
  await until('layoutReady()&&!layout().error');
  const restored = await execute(`return {source:JSON.stringify(editor.getJSON()),layout:JSON.stringify(layout()),selection:editor.state.selection.toJSON()}`);
  assert.deepEqual(restored,original);
  await execute(`
    window.flowPaginationKey=(await import('/src/editor/pagination/state.ts')).paginationKey;
    const {ChapterLayoutCompiler}=await import('/src/document-engine/layout/chapter-compiler.ts');
    window.flowTrace={published:[],held:0};
    editor.on('transaction',({transaction})=>{
      const compiled=transaction.getMeta(flowPaginationKey)?.compiled;
      if(compiled)flowTrace.published.push({current:compiled.source===editor.state.doc,text:compiled.source.textContent});
    });
    const compile=ChapterLayoutCompiler.prototype.compile;
    window.holdNextLayout=false;
    ChapterLayoutCompiler.prototype.compile=async function(...args){
      const hold=holdNextLayout;holdNextLayout=false;
      const result=await compile.apply(this,args);
      if(hold){flowTrace.held++;await new Promise(resolve=>window.releaseLayout=resolve)}
      return result;
    };
    holdNextLayout=true;
    editor.commands.insertContentAt(editor.state.doc.content.size-1,' FIRST');
  `);
  await until('flowTrace.held===1');
  await execute(`editor.commands.insertContentAt(editor.state.doc.content.size-1,' LATEST');releaseLayout()`);
  await until('layoutReady()&&!layout().error&&flowTrace.published.some(item=>item.text.includes("LATEST"))');
  const stale = await execute('return structuredClone(flowTrace)');
  assert.ok(stale.published.every(item=>item.current));
  await execute(`holdNextLayout=true;editor.commands.insertContentAt(editor.state.doc.content.size-1,' CANCELLED')`);
  await until('flowTrace.held===2');
  const beforeCancel = await execute('return flowTrace.published.length');
  await execute(`setPages(false);releaseLayout();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);await waitSaved()`);
  const cancellation = await execute(`return {published:flowTrace.published.length,enabled:flowPaginationKey.getState(editor.state).enabled,stored:JSON.stringify((await db.chapters.get('fixture.1')).content)===JSON.stringify(editor.getJSON().content)}`);
  assert.equal(cancellation.published,beforeCancel);assert.equal(cancellation.enabled,false);assert.equal(cancellation.stored,true);
  const report={unchangedToggle: true,stalePublications:stale.published.filter(item=>!item.current).length,
    latestPublished:true,cancelledPublication:false,stored:cancellation.stored};
  fs.writeFileSync(path.join(artifacts,'pagination-flow.json'),JSON.stringify(report,null,2));
  console.log('PASS pagination orchestration:',artifacts,JSON.stringify(report));
};
