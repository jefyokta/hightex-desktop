const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument, PDFName } = require('pdf-lib');
const { execFileSync } = require('node:child_process');
const { measureContent, compareContent } = require('./editor-pdf-geometry.cjs');
const { compactPDFSourceText } = require('./page-plan-pdf.cjs');
const { verifyPDFMarkers } = require('./editor-pdf-equivalence.cjs');

function selectWordSamples(glyphs) {
  const candidates = [];
  for (const word of ['Introduction', 'Penelitian', 'Ligatures', 'PROOFLINK'])
    for (let index = 0; index <= glyphs.length - word.length; index++) {
      const selected = glyphs.slice(index, index + word.length), first = selected[0];
      if (selected.map(glyph => glyph.character).join('') === word && selected.every(glyph => glyph.page === first.page && Math.abs(glyph.y - first.y) < 0.5))
        candidates.push({ text: word, page: first.page, x: first.x, y: first.y });
    }
  return [...new Set(candidates.map(candidate => candidate.page))].flatMap(page => {
    const words = candidates.filter(candidate => candidate.page === page).sort((a, b) => a.y - b.y || a.x - b.x);
    return [...new Set([words[0], words[Math.floor(words.length / 2)], words.at(-1)])];
  });
}
exports.selectWordSamples = selectWordSamples;

exports.run = async ({ execute, until, artifacts, editorPDFTest }) => {
  const contextMode = process.env.HIGHTEX_PROJECTION_MODE === 'context';
  const name = contextMode ? 'context-projection' : 'line-projection';
  const measurement = surfaces => `(() => {
    const surfaces = ${surfaces};
    const result = (${measureContent.toString()})(surfaces);
    ${contextMode ? `
      const viewports = new Map(surfaces.map(surface => [surface.page, surface.paper.getBoundingClientRect()]));
      result.unclippedGlyphs = result.glyphs.length;
      result.glyphs = result.glyphs.filter(glyph => {
        const viewport = viewports.get(glyph.page);
        return glyph.y >= 0 && glyph.y + glyph.height <= viewport.height &&
          glyph.x >= 0 && glyph.x + glyph.width <= viewport.width;
      });
    ` : ''}
    return result;
  })()`;
  const report = { mode: name, scope: 'Representation feasibility only; not shared content authority, editing integration, memory scalability or feature acceptance.' };
  const save = () => fs.writeFileSync(path.join(artifacts, name + '.json'), JSON.stringify(report, null, 2));
  let printed;
  editorPDFTest.inspectPrint(async win => {
    printed = await win.webContents.executeJavaScript(measurement("Array.from(document.querySelectorAll('.editor-page-fragment'),(paper,index)=>({root:paper.querySelector('.tiptap'),paper,page:index+1}))"));
  });
  try {
    await execute(`
      setPages(false);
      const {typographyInput}=await import('/tests/helpers/typography-input.ts');
      const input=typographyInput(sentence);
      await prepareComparison(input);editor.commands.setContent(input);await waitSaved();await prepareComparison(editor.getJSON());setPages(true);await document.fonts.ready;
    `);
    await until('layoutReady()&&!layout().error');
    if (process.env.HIGHTEX_PROJECTION_BOUNDARY === 'before') {
      report.boundary = await execute(`
        const point=layout().breaks.find(cut=>cut.kind==='line');
        if(!point)throw Error('Missing measured cut');
        editor.commands.insertContentAt(point.from-1,{type:'hardBreak'});
        await waitSaved();await prepareComparison(editor.getJSON());return {originalCut:point.from,insertedAt:point.from-1};
      `);
      await until('layoutReady()&&!layout().error');
    }
    const result = await execute(`
      const {waitForEditorExport}=await import('/src/document-export/source/editor-readiness.ts');
      const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Projection proof deadline')),20000);
      try{
        await waitForEditorExport(editor,task.signal);
        const {measureTextLines,LineProjection,ContextProjection}=await import('/tests/helpers/line-projection.ts');
        const {captureMaterializedPages}=await import('/tests/helpers/capture-materialized-pages.ts');
const {sha256Text}=await import('/src/utils/sha256.ts');
        const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
        const baseline={source:JSON.stringify(editor.getJSON()),stored:JSON.stringify(await db.chapters.get('fixture.1')),history:JSON.stringify(historyDepth()),selection:JSON.stringify(editor.state.selection.toJSON())};
        const geometry=paginationGeometry(),lines=measureTextLines(editor.view,geometry);
        const live=(${measureContent.toString()})([{root:editor.view.dom,paper:editor.view.dom.closest('.page')}],geometry);
        const projection=${contextMode ? 'new ContextProjection(editor.view,geometry,layout().pages)' : 'new LineProjection(lines,geometry)'};
        try{
          const projected=${measurement("Array.from(projection.output.children,(paper,index)=>({root:paper.querySelector('.tiptap'),paper,page:index+1}))")};
          window.lineProofSnapshot=await captureMaterializedPages(projection.output,{version:1,documentId:'fixture',chapterId:'fixture.1',sourceHash:await sha256Text(baseline.source),planHash:await sha256Text(JSON.stringify(lines)),title:'Line representation proof',author:'Fixture'},new DocumentResources(task.signal),document.documentElement.className,task.signal);
          return {lines,live,projected,sourceUnchanged:baseline.source===JSON.stringify(editor.getJSON())&&baseline.stored===JSON.stringify(await db.chapters.get('fixture.1'))&&baseline.history===JSON.stringify(historyDepth())&&baseline.selection===JSON.stringify(editor.state.selection.toJSON())};
        }finally{projection.destroy()}
      }finally{clearTimeout(timer)}
    `);
    report.lines = result.lines;report.sourceUnchanged = result.sourceUnchanged;
    fs.writeFileSync(path.join(artifacts, name + '-metrics.json'), JSON.stringify(result, null, 2));
    assert.equal(result.sourceUnchanged, true);
    try { report.dom = { equivalent: true, ...compareContent(result.live, result.projected, 0.75) }; }
    catch(error) { report.dom = { equivalent: false, message: error.message }; }
    save();
    await execute('await window.editorPDFExperimental.export(lineProofSnapshot,crypto.randomUUID())');
    const output = editorPDFTest.outputs.at(-1);
    fs.copyFileSync(output, path.join(artifacts, name + '.pdf'));
    fs.writeFileSync(path.join(artifacts, name + '.html'), await execute('return lineProofSnapshot.html'));
    try { report.nativeDOM = { equivalent: true, ...compareContent(result.live, printed, 0.75) }; }
    catch(error) { report.nativeDOM = { equivalent: false, message: error.message }; }
    fs.writeFileSync(path.join(artifacts, name + '-native-metrics.json'), JSON.stringify(printed, null, 2));
    const pdf = await PDFDocument.load(fs.readFileSync(output));
    report.externalLinks = pdf.getPages().flatMap(page => page.node.Annots()?.asArray().flatMap(ref => {
      const annotation = pdf.context.lookup(ref), action = annotation.get(PDFName.of('A'));
      return action ? [pdf.context.lookup(action).get(PDFName.of('URI'))?.decodeText()] : [];
    }) ?? []);
    const extracted=execFileSync('pdftotext', ['-raw', output, '-'], { encoding: 'utf8' });
    report.extractedTextHasLink=extracted.includes('PROOFLINK');
    report.repeatedSourcePhraseCount=(compactPDFSourceText(extracted).match(/Penelitianinimenjelaskan/g)??[]).length;
    report.expectedSourcePhraseCount=104;
    const characters=text=>[...compactPDFSourceText(text).replace(/\p{Bidi_Control}/gu,'')].sort().join('');
    // This fixture is chapter 1. Its authored text excludes the generated ::before label.
    report.expectedGeneratedText='BAB 1';
    report.generatedHeadingCount=(extracted.match(/BAB\s+1/g)??[]).length;
    report.nativeTextMultiplicityMatches=characters(extracted)===characters(await execute('return editor.state.doc.textContent')+report.expectedGeneratedText);
    report.pdfWordBounds=verifyPDFMarkers(output,selectWordSamples(result.live.glyphs));
    report.rawExtractionStartsWithHeading=extracted.trimStart().startsWith('BAB 1');
    report.layoutExtractionStartsWithHeading=execFileSync('pdftotext',['-layout',output,'-'],{encoding:'utf8'}).trimStart().startsWith('BAB 1');
    report.representationProved = report.dom.equivalent && report.nativeDOM.equivalent && report.extractedTextHasLink && report.externalLinks.length===1 && report.externalLinks[0]==='https://example.com/representation-proof' && report.repeatedSourcePhraseCount===report.expectedSourcePhraseCount && report.nativeTextMultiplicityMatches && report.generatedHeadingCount===1 && report.layoutExtractionStartsWithHeading;
    save();
    console.log('RECORDED: '+name+' feasibility:', report.representationProved, 'Artifacts:', artifacts);
    if(contextMode)assert.equal(report.representationProved,true,'Context projection failed its bounded feasibility contract');
    else assert.equal(report.nativeDOM.equivalent,false,'Known independent-line counterexample changed; review the representation oracle');
  } finally {editorPDFTest.inspectPrint(undefined);save()}
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE = '1';
  process.env.HIGHTEX_EDITOR_EQUIVALENCE = '1';
  process.env.HIGHTEX_LINE_PROJECTION_PROOF = '1';
  require('./editor-pagination.cjs');
}
