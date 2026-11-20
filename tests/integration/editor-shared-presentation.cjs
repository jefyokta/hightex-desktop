const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { prepareEquivalence, verifyPDFMarkers } = require('./editor-pdf-equivalence.cjs');
const { measureContent, compareContent } = require('./editor-pdf-geometry.cjs');
const { pdfLinkDestinations } = require('./editor-page-fragments.cjs');

const surfaces = "Array.from(document.querySelectorAll('.editor-page-fragment'),(paper,index)=>({root:paper.querySelector('.page'),paper,page:index+1}))";

exports.run = async context => {
  const { execute, until, artifacts, editorPDFTest } = context;
  const report = { scope: 'Shared schema content DOM and resolved resources in isolated editable/snapshot views; not the application editor or full acceptance.' };
  const save = () => fs.writeFileSync(path.join(artifacts, 'shared-presentation.json'), JSON.stringify(report, null, 2));
  let native;
  editorPDFTest.inspectPrint(async win => {
    native = await win.webContents.executeJavaScript(`(()=>{
      const surfaces=${surfaces},result=(${measureContent.toString()})(surfaces);
      const pages=new Map(surfaces.map(surface=>[surface.page,surface.paper.getBoundingClientRect()]));
      result.unclippedGlyphs=result.glyphs.length;
      result.glyphs=result.glyphs.filter(glyph=>{const page=pages.get(glyph.page);return glyph.y>=0&&glyph.y+glyph.height<=page.height&&glyph.x>=0&&glyph.x+glyph.width<=page.width});
      result.images=result.images.filter(image=>{const page=pages.get(image.page);return image.y>=0&&image.y+image.height<=page.height&&image.x>=0&&image.x+image.width<=page.width});
      result.labels=surfaces.flatMap(({root,paper})=>Array.from(root.querySelectorAll('[data-label]')).flatMap(label=>{
        const box=label.getBoundingClientRect(),page=paper.getBoundingClientRect(),style=getComputedStyle(label,'::before');
        if(style.content==='none'||box.top<page.top||box.bottom>page.bottom)return [];
        return [{label:label.dataset.label,before:style.content,font:[style.fontFamily,style.fontSize,style.fontWeight,style.fontStyle].join('|')}];
      }));return result;
    })()`);
  });
  try {
    await prepareEquivalence(context);
    const result = await execute(`
      const {SharedChapterPresentation,auditPresentationLifecycle}=await import('/tests/helpers/shared-chapter-presentation.ts');
      const {chapterSnapshotSource}=await import('/src/editor/chapter/snapshot-source.ts');
      const {readDocumentSnapshot}=await import('/src/editor/storage/document-snapshot.ts');
      const {documentRenderModel}=await import('/src/editor/document/render-model.ts');
      const {captureMaterializedPages}=await import('/tests/helpers/capture-materialized-pages.ts');
const {sha256Text}=await import('/src/utils/sha256.ts');
      const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
      const {ContextProjection}=await import('/tests/helpers/line-projection.ts');
      const {PageImageSnapshot}=await import('/src/editor/pagination/measurement/image-snapshot.ts');
      const {sharedPresentationInput}=await import('/tests/helpers/shared-presentation-input.ts');
      await waitSaved();setPages(false);
      const baseline={source:JSON.stringify(editor.getJSON()),stored:JSON.stringify(await db.chapters.get('fixture.1')),history:JSON.stringify(historyDepth()),selection:JSON.stringify(editor.state.selection.toJSON())};
      const model=await documentRenderModel(await readDocumentSnapshot('fixture'));
      const content=sharedPresentationInput(structuredClone(editor.getJSON().content),model);
      model.chapters.find(chapter=>chapter.id==='1').content=content;
      const source=chapterSnapshotSource(editor.state.schema,content,'fixture.1');
      const createURL=URL.createObjectURL,revokeURL=URL.revokeObjectURL,created=[],revoked=[];
      URL.createObjectURL=blob=>{const url=createURL.call(URL,blob);created.push(url);return url};
      URL.revokeObjectURL=url=>{revoked.push(url);revokeURL.call(URL,url)};
      const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Shared presentation proof deadline')),45000);
      let proof,projection;
      try {
        proof=new SharedChapterPresentation(source,model,paginationGeometry());
        const layoutStart=performance.now();
        const layout=await proof.layout(task.signal);
        const layoutMs=performance.now()-layoutStart;
        const measure=view=>{const paper=view.dom.closest('.page');return (${measureContent.toString()})([{root:view.dom,paper},...Array.from(paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper}))],paginationGeometry())};
        const editable=measure(proof.editable),snapshot=measure(proof.snapshot.view);
        const widths=new PageImageSnapshot(proof.editable).images.map(image=>image.getBoundingClientRect().width);
        projection=new ContextProjection(proof.editable,paginationGeometry(),layout.plan.pages);
        const nodeCounts={editable:proof.editable.dom.querySelectorAll('*').length,snapshot:proof.snapshot.view.dom.querySelectorAll('*').length,projection:projection.output.querySelectorAll('*').length};
        window.sharedPresentationSnapshot=await captureMaterializedPages(projection.output,{version:1,documentId:'fixture',chapterId:'fixture.1',sourceHash:await sha256Text(JSON.stringify(source.toJSON())),planHash:await sha256Text(JSON.stringify(layout.plan)),title:'Shared presentation proof',author:'Fixture'},new DocumentResources(task.signal),document.documentElement.className,task.signal);
        const history=proof.probeHistory();
        const target=proof.editable.dom.querySelector('#shared-tall-target'),targetBox=target.getBoundingClientRect(),origin=proof.paper.getBoundingClientRect();
        const targetPage=Math.floor((targetBox.top-origin.top)/paginationGeometry().stride)+1;
        const ids=Array.from(projection.output.querySelectorAll('[id]'),node=>node.id);
        const sourceStable=source.eq(proof.editable.state.doc)&&JSON.stringify(model.chapters.find(chapter=>chapter.id==='1').content)===JSON.stringify(content);
        const result={layout,layoutMs,nodeCounts,editable,snapshot,widths,history,sourceStable,targetPage,targetHeight:targetBox.height,maxContentHeight:paginationGeometry().contentHeight,duplicateAnchorCount:ids.length-new Set(ids).size,createdURLs:created.length,pages:layout.plan.pages,sourceUnchanged:baseline.source===JSON.stringify(editor.getJSON())&&baseline.stored===JSON.stringify(await db.chapters.get('fixture.1'))&&baseline.history===JSON.stringify(historyDepth())&&baseline.selection===JSON.stringify(editor.state.selection.toJSON())};
        const views=[proof.editable,proof.snapshot.view];
        projection.destroy();projection=undefined;proof.destroy();proof=undefined;
        const revokedURLs=revoked.length,resourcesReleased=created.every(url=>revoked.filter(value=>value===url).length===1);
        const lifecycle=await auditPresentationLifecycle(source,model,paginationGeometry());
        return {...result,lifecycle:{...lifecycle,createdURLs:created.length-result.createdURLs,revokedURLs:revoked.length-revokedURLs,allReleased:created.every(url=>revoked.filter(value=>value===url).length===1)},viewsDestroyed:views.every(view=>view.isDestroyed),revokedURLs,resourcesReleased};
      }finally{projection?.destroy();proof?.destroy();URL.createObjectURL=createURL;URL.revokeObjectURL=revokeURL;clearTimeout(timer)}
    `);
    fs.writeFileSync(path.join(artifacts, 'shared-presentation-metrics.json'), JSON.stringify(result, null, 2));
    report.pages=result.pages;report.sourceUnchanged=result.sourceUnchanged;report.sourceStable=result.sourceStable;
    report.history=result.history;report.resources={created:result.createdURLs,revoked:result.revokedURLs,released:result.resourcesReleased};
    report.layoutMs=result.layoutMs;report.nodeCounts=result.nodeCounts;report.viewsDestroyed=result.viewsDestroyed;
    report.lifecycle=result.lifecycle;
    report.independentPlansEqual=JSON.stringify(result.layout.plan)===JSON.stringify(result.layout.independent);
    report.contentDOM=compareContent(result.editable,result.snapshot,0.75);
    report.widths=result.widths;
    assert.equal(result.sourceUnchanged,true);assert.equal(result.sourceStable,true);
    assert.equal(result.history.sourceRestored,true);assert.equal(result.history.undone,true);
    assert.equal(result.resourcesReleased,true);assert.equal(result.createdURLs,2,'Each shared asset should have one owned URL');
    assert.equal(result.viewsDestroyed,true);
    assert.equal(result.lifecycle.completed,10);assert.equal(result.lifecycle.cancelled,10);assert.equal(result.lifecycle.destroyed,20);
    assert.equal(result.lifecycle.surfacesBefore,result.lifecycle.surfacesAfter);
    assert.equal(result.lifecycle.allReleased,true);assert.equal(result.lifecycle.createdURLs,40);assert.equal(result.lifecycle.revokedURLs,40);
    assert.equal(report.independentPlansEqual,true,'Editable and snapshot consumers chose different plans');
    assert.equal(Math.abs(result.widths[0]-result.widths[1])<0.1,true,'Numeric and string widths differ');
    save();
    await execute('await window.editorPDFExperimental.export(sharedPresentationSnapshot,crypto.randomUUID())');
    const pdf=editorPDFTest.outputs.at(-1);
    fs.copyFileSync(pdf,path.join(artifacts,'shared-presentation.pdf'));
    fs.writeFileSync(path.join(artifacts,'shared-presentation.html'),await execute('return sharedPresentationSnapshot.html'));
    report.nativeDOM=compareContent(result.editable,native,0.75);
    report.nativeWordBounds=verifyPDFMarkers(pdf,result.editable.words);
    const extracted=execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8'});
    report.stringCaptionPrinted=extracted.includes('Gambar width string dari sumber lama');
    report.target={page:result.targetPage,height:result.targetHeight};
    assert.ok(result.targetHeight<=result.maxContentHeight+0.75,'Tall figure exceeds its one-page content height');
    report.duplicateAnchorCount=result.duplicateAnchorCount;
    report.internalLinkPages=await pdfLinkDestinations(fs.readFileSync(pdf));
    assert.equal(report.internalLinkPages.includes(result.targetPage),true,'Tall-image reference points to another page');
    assert.equal(report.internalLinkPages.length,3,'Internal links were lost or duplicated by clipping');
    assert.equal(result.duplicateAnchorCount,0,'Context viewports retained duplicate target IDs');
    assert.equal(report.stringCaptionPrinted,true);
    report.rendererErrors=await execute('return window.errors');
    report.complete=true;save();
    console.log('PASS: bounded shared content DOM/resources proof. Artifacts:',artifacts);
  } catch(error) { report.failure={message:error.message,stack:error.stack};save();throw error; }
  finally {editorPDFTest.inspectPrint(undefined)}
};

if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';process.env.HIGHTEX_EDITOR_EQUIVALENCE='1';process.env.HIGHTEX_SHARED_PRESENTATION_PROOF='1';
  require('./editor-pagination.cjs');
}
