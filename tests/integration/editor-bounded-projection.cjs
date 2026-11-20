const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow, app } = require('electron');
const { execFileSync } = require('node:child_process');
const { PDFDocument } = require('pdf-lib');
const { prepareEquivalence, verifyPDFMarkers } = require('./editor-pdf-equivalence.cjs');
const { prepareProjectionInput } = require('./section-projection-input.cjs');
const { measureContent, compareContent } = require('./editor-pdf-geometry.cjs');
const { compactPDFSourceText } = require('./page-plan-pdf.cjs');
const { pdfLinkDestinations,pdfExternalLinks } = require('./editor-page-fragments.cjs');
const { ViewportPDFAssembly } = require('./viewport-pdf-assembly.cjs');
const { selectWordSamples } = require('./editor-line-projection.cjs');

exports.run=async context=>{
  const {artifacts}=context,report={scope:'Bounded single-viewport projection and native PDF assembly, isolated contract proof.'};
  const save=()=>fs.writeFileSync(path.join(artifacts,'bounded-projection.json'),JSON.stringify(report,null,2));
  let win;
  try {
    await prepareEquivalence(context);
    const input=await prepareProjectionInput(context,true);
    report.pages=input.pages;report.sourceUnchanged=input.sourceUnchanged;report.nodes=input.nodes;report.profile=input.profile;report.boundary=input.boundary;
    report.revision={identity:input.revisionState.identity,sourceLocators:input.revisionState.sources.length,
      resultFrozen:input.revisionState.resultFrozen,rejectsStale:input.revisionState.rejectsStale,savedResultStable:input.revisionState.savedResultStable,
      editorAppliedPublishedResult:input.revisionState.editorAppliedPublishedResult,history:input.revisionState.history};
    assert.equal(input.revisionState.editorAppliedPublishedResult,true);
    assert.equal(input.revisionState.history.inserted,true);assert.equal(input.revisionState.history.undone,true);
    assert.equal(input.revisionState.history.sourceRestored,true);assert.equal(input.revisionState.history.selectionRestored,true);
    assert.equal(input.revisionState.resultFrozen,true);assert.equal(input.revisionState.rejectsStale,true);
    assert.equal(input.revisionState.savedResultStable,true);assert.deepEqual(input.revisionState.observerErrors,[]);
    if(input.profile==='typography')assert.equal(input.revisionState.firstJobAborted,true);
    const decisions=input.revisionState.decisions;
    report.decisions={total:decisions.length,breaks:decisions.filter(item=>item.kind==='break').length,
      fits:decisions.filter(item=>item.kind==='fit').length,repeats:decisions.filter(item=>item.kind==='table-continuation').length,
      reasons:[...new Set(decisions.flatMap(item=>item.reasons??[]))]};
    assert.ok(report.decisions.breaks>0,'Page decisions lost their source provenance');
    for(const decision of decisions){
      assert.equal(decision.source.sourceRevision,input.revisionState.identity.sourceHash);
      assert.equal(decision.source.chapterId,input.revisionState.identity.sectionId);
    }
    const isAbstract=input.profile.startsWith('abstract-');
    if(isAbstract){
      report.composition=input.compositionState;
      assert.equal(report.composition.controls,0);assert.equal(report.composition.sourceContainsKeywords,false);
      const {margins}=input.geometry;
      for(const glyph of input.live.glyphs){
        assert.ok(glyph.page>=1&&glyph.page<=input.pages,'Composite content has no recorded page');
        assert.ok(glyph.y>=margins.top-.75&&glyph.y+glyph.height<=input.geometry.height-margins.bottom+.75,'Composite glyph is outside the content area');
      }
    }
    if(input.profile!=='typography'&&!isAbstract){
      const fitted=decisions.find(item=>item.kind==='fit'&&item.source.assetId==='shared-tall-image');
      assert.ok(fitted,'Tall image fitting has no source locator');
      assert.equal(fitted.source.figureId,'shared-tall-figure');
      assert.ok(decisions.some(item=>item.kind==='table-continuation'&&item.source.nodeId==='shared-merged-table'));
      assert.ok(decisions.some(item=>item.kind==='break'&&item.container),'Cell continuation has no container locator');
    }
    report.viewportLifecycle=input.viewportLifecycle;
    assert.equal(new Set(input.viewportLifecycle.counts).size,1);assert.equal(input.viewportLifecycle.invalidRejected,2);
    report.clone=compareContent(input.live,input.clone,.75);assert.equal(input.sourceUnchanged,true);
    const file=path.join(artifacts,'bounded-projection.html');fs.writeFileSync(file,input.html);
    fs.writeFileSync(path.join(artifacts,'bounded-source.json'),JSON.stringify(input,null,2));
    win=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false}});
    await win.loadFile(file);
    await win.webContents.executeJavaScript(`(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images,image=>image.decode()))})()`);
    const geometry=await win.webContents.executeJavaScript(`(${measureContent.toString()})([{root:document.querySelector('[data-section-context]'),paper:document.querySelector('[data-section-context]')}],${JSON.stringify(input.geometry)})`);
    fs.writeFileSync(path.join(artifacts,'bounded-print-metrics.json'),JSON.stringify(geometry,null,2));
    report.window=compareContent(input.live,geometry,.75);
    report.windowSizes=[];
    for(const [width,height] of [[320,480],[1440,1000]]){
      win.setContentSize(width,height);
      const resized=await win.webContents.executeJavaScript(`(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return (${measureContent.toString()})([{root:document.querySelector('[data-section-context]'),paper:document.querySelector('[data-section-context]')}],${JSON.stringify(input.geometry)})})()`);
      report.windowSizes.push({width,height,...compareContent(input.live,resized,.75)});
    }
    const assembly=await ViewportPDFAssembly.create(),samples=[],memory=[];const start=Date.now();
    for(let index=0;index<input.pages;index++) {
      const nodes=await win.webContents.executeJavaScript(`document.querySelector('[data-section-context]').style.top=${JSON.stringify(-index*input.geometry.stride+'px')};document.querySelectorAll('*').length`);
      samples.push(nodes);
      const bytes=await win.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,margins:{top:0,bottom:0,left:0,right:0}});
      await assembly.append(bytes);
      memory.push(app.getAppMetrics().find(metric=>metric.pid===win.webContents.getOSProcessId())?.memory);
    }
    const assembled=await assembly.finish(input.anchors,input.links);
    const bytes=await assembled.save();
    report.printAndAssemblyMs=Date.now()-start;report.nodesPerViewport=samples;report.memory=memory;
    assert.equal(new Set(samples).size,1,'Viewport DOM grew with page count');
    const output=path.join(artifacts,'bounded-projection.pdf');fs.writeFileSync(output,bytes);
    const pdf=await PDFDocument.load(bytes);report.nativePages=pdf.getPageCount();assert.equal(pdf.getPageCount(),input.pages);
    const markers=input.profile==='typography'?selectWordSamples(input.live.glyphs):input.live.words;
    report.wordBounds=verifyPDFMarkers(output,markers);
    report.links=await pdfLinkDestinations(bytes);
    const targets=new Map(input.anchors.map(target=>[target.id,target.page]));
    assert.deepEqual(report.links,[...input.links].sort((a,b)=>a.page-b.page).map(link=>targets.get(link.target)));
    report.externalLinks=await pdfExternalLinks(bytes);
    assert.equal(report.externalLinks.length,input.externalLinks.length);
    for(const link of input.externalLinks){
      const found=report.externalLinks.find(actual=>actual.uri===link.uri&&actual.page===link.page);
      assert.ok(found,'Native external link was lost');
      const expected=[link.x*.75,(input.geometry.height-link.y-link.height)*.75,(link.x+link.width)*.75,(input.geometry.height-link.y)*.75];
      assert.ok(found.rect.every((coordinate,index)=>Math.abs(coordinate-expected[index])<=2),'Native link rectangle differs from its source');
    }
    const text=execFileSync('pdftotext',['-layout',output,'-'],{encoding:'utf8'});
    if(input.profile==='typography'||isAbstract){
      const characterSet=value=>[...compactPDFSourceText(value).replace(/\p{Bidi_Control}/gu,'')].sort().join('');
      const visible=input.live.glyphs.map(glyph=>glyph.paintedCharacter??glyph.character).join('')+(isAbstract?'':'BAB1');
      report.exactCharacterMultiplicity=characterSet(text)===characterSet(visible);assert.equal(report.exactCharacterMultiplicity,true);
      if(isAbstract){
        report.abstractMarkers=['EQP001','EQP002','2200000001','EQK001','EQK002','EQK003',...Array.from({length:12},(_,i)=>'EQA'+String(i).padStart(3,'0'))].map(marker=>({marker,count:compactPDFSourceText(text).split(marker).length-1}));
        assert.ok(report.abstractMarkers.every(item=>item.count===1),'Abstract prefix/body/keywords lost or duplicated');
        assert.ok(compactPDFSourceText(text).includes(input.profile==='abstract-en'?'Keywords:':'KataKunci:'));
        assert.equal(input.live.images.length,0);
      }
    }else{
      report.mergedMarkers=Array.from({length:6},(_,i)=>compactPDFSourceText(text).split('EQM00'+i).length-1);
      assert.ok(report.mergedMarkers.every(count=>count===1),'Merged table text multiplicity changed');
      report.tallCaptionCount=compactPDFSourceText(text).split('Gambartinggiwajibmuatsatuhalamandengancaption').length-1;
      assert.equal(report.tallCaptionCount,1);
    }
    report.complete=true;save();console.log('PASS: bounded viewport projection. Artifacts:',artifacts);
  } catch(error) {report.failure={message:error.message,stack:error.stack};save();throw error;}
  finally {if(win&&!win.isDestroyed())win.destroy();report.printWindowDestroyed=!win||win.isDestroyed();save()}
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';process.env.HIGHTEX_EDITOR_EQUIVALENCE='1';process.env.HIGHTEX_BOUNDED_PROJECTION='1';require('./editor-pagination.cjs');
}
