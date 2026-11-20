const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { measureContent, compareContent } = require('./editor-pdf-geometry.cjs');

exports.recordHardBreakFragments = async ({ execute, until, editorPDFTest, artifacts }) => {
  await execute(`
    setPages(false);
    const text=value=>({type:'text',text:value}),br=()=>({type:'hardBreak'});
    const paragraph=content=>({type:'paragraph',content});
    const item=content=>({type:'listItem',content});
    const list=content=>({type:'orderedList',attrs:{start:3},content});
    const input={type:'doc',content:[
      {type:'heading',attrs:{level:1},content:[text('Introduction')]},
      list([item([paragraph([text('BRCASE pendek sebelum pindah baris'),br(),text(sentence.repeat(100))])])]),
      list([item([p('Induk nested'),list([item([paragraph([br(),text('BRNEST awal'),br(),br(),text(sentence.repeat(5)),br()])])])])]),
      list([item([paragraph([text('BRCONTROL satu baris'),br(),text('Baris akhir pendek')]),p('Paragraf sesudah BR')])]),
    ]};
    await prepareComparison(input);editor.commands.setContent(input);await waitSaved();await prepareComparison(editor.getJSON());
    setPages(true);await document.fonts.ready;
  `);
  await until('layoutReady()&&!layout().error');
  const report = await recordCurrentFragments({ execute, editorPDFTest, artifacts }, 'hard-break-fragments', ['internal BR before long wrapped continuation across pages', 'nested list', 'leading BR', 'consecutive BR', 'trailing BR', 'short unsplit control', 'following paragraph']);
  const baseline=await execute('return {source:editor.getJSON(),cuts:layout().breaks}');
  const cut=baseline.cuts.find(cut=>cut.kind==='line');
  assert(cut, 'The BR fixture must have a measured paragraph cut');
  report.boundaryCases=[];
  for(const offset of [-1,0,1]) {
    const position=cut.from+offset;
    await execute(`
      setPages(false);editor.commands.setContent(${JSON.stringify(baseline.source)});
      editor.commands.insertContentAt(${position},{type:'hardBreak'});
      await waitSaved();await prepareComparison(editor.getJSON());setPages(true);
    `);
    await until('layoutReady()&&!layout().error');
    const result=await recordCurrentFragments({execute,editorPDFTest,artifacts},'hard-break-cut-'+(offset<0?'before':offset>0?'after':'at'),['authored BR '+offset+' from measured page cut']);
    report.boundaryCases.push({originalCut:cut.from,insertedAt:position,offset,...result});
  }
  return report;
};

async function recordCurrentFragments({ execute, editorPDFTest, artifacts }, name, cases) {
  const before = await execute(`return {
    source:editor.getJSON(),stored:await db.chapters.get('fixture.1'),selection:editor.state.selection.toJSON(),history:historyDepth(),
    plan:layout(),geometry:paginationGeometry(),
    live:(${measureContent.toString()})([{root:editor.view.dom,paper:editor.view.dom.closest('.page')}],paginationGeometry())
  }`);
  const report = { cases, pages: before.plan.pages };
  let printed;
  editorPDFTest.inspectPrint(async win => {
    printed = await win.webContents.executeJavaScript(`(${measureContent.toString()})(Array.from(document.querySelectorAll('.editor-page-fragment'),(paper,index)=>({root:paper.querySelector('.tiptap'),paper,page:index+1})))`);
  });
  try {
    const captured = await execute(`
      const {captureEditorChapterPDF}=await import('/tests/helpers/editor-chapter-pdf.ts');
      const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('BR reproduction deadline')),25000);
      try {window.redesignBRSnapshot=await captureEditorChapterPDF(editor,task.signal);return {ok:true}} catch(error) {return {ok:false,message:error.message,details:error.details}} finally {clearTimeout(timer)}
    `);
    report.capture = captured;
    if (captured.ok) {
      fs.writeFileSync(path.join(artifacts, name + '.html'), await execute('return redesignBRSnapshot.html'));
      await execute('await window.editorPDFExperimental.export(redesignBRSnapshot,crypto.randomUUID())');
      fs.copyFileSync(editorPDFTest.outputs.at(-1), path.join(artifacts, name + '.pdf'));
      try { report.visual = { equivalent: true, ...compareContent(before.live, printed, 0.75) }; }
      catch(error) { report.visual = { equivalent: false, message: error.message }; }
    }
    const after = await execute('return {source:editor.getJSON(),stored:await db.chapters.get("fixture.1"),selection:editor.state.selection.toJSON(),history:historyDepth()}');
    report.sourceUnchanged = ['source', 'stored', 'selection', 'history'].every(key => JSON.stringify(before[key]) === JSON.stringify(after[key]));
    fs.writeFileSync(path.join(artifacts, name + '.json'), JSON.stringify({ report, before, printed }, null, 2));
    assert.equal(report.sourceUnchanged, true, 'BR capture changed source, selection, history or storage');
    return report;
  } finally {
    editorPDFTest.inspectPrint(undefined);
  }
}
