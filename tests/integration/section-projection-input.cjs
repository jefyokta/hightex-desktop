const assert = require('node:assert/strict');
const { measureContent } = require('./editor-pdf-geometry.cjs');

async function prepareProjectionInput(context, viewport = false) {
  const { execute } = context;
  const profile = process.env.HIGHTEX_BOUNDED_PROFILE ?? 'mixed';
  assert(['mixed','typography','growth','abstract-id','abstract-en'].includes(profile),'Unknown projection workload');
  return execute(`
    const {SharedChapterPresentation}=await import('/tests/helpers/shared-chapter-presentation.ts');
    const {sharedPresentationInput}=await import('/tests/helpers/shared-presentation-input.ts');
    const {chapterSnapshotSource}=await import('/src/editor/chapter/snapshot-source.ts');
    const {readDocumentSnapshot}=await import('/src/editor/storage/document-snapshot.ts');
    const {documentRenderModel,documentRenderFingerprint}=await import('/src/editor/document/render-model.ts');
    const {ContinuousProjection}=await import('/tests/helpers/continuous-projection.ts');
    const {SectionViewport}=await import('/src/document-engine/projection/section-viewport.ts');
    const {sectionPrintHTML}=await import('/tests/helpers/section-print-html.ts');
    const {SectionLayoutSession}=await import('/src/document-engine/layout/layout-session.ts');
    const {sectionSourceMap,documentSourceTargets}=await import('/src/document-engine/projection/source-map.ts');
    const {sectionLayoutDecisions}=await import('/src/document-engine/layout/layout-decisions.ts');
    const {sectionLayoutEffects}=await import('/src/document-engine/layout/layout-effects.ts');
    const {sha256Text}=await import('/src/utils/sha256.ts');
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const {archiveSha256}=await import('/src/utils/htx/import-model.ts');
    await waitSaved();setPages(false);
    const before=JSON.stringify({source:editor.getJSON(),stored:await db.chapters.get('fixture.1'),selection:editor.state.selection.toJSON(),history:historyDepth()});
    const model=await documentRenderModel(await readDocumentSnapshot('fixture'));
    const {typographyInput,insertTypographyBoundary}=await import('/tests/helpers/typography-input.ts');
    const profile=${JSON.stringify(profile)};
    const keywordBoundary=${process.env.HIGHTEX_ABSTRACT_BOUNDARY==='1'};
    const chapterKey=profile==='abstract-en'?'abstract-en':profile==='abstract-id'?'abstract':'1';
    let composition,presentationOptions={},schema=editor.state.schema;
    const isAbstract=profile.startsWith('abstract-');
    if(isAbstract){
      const input=window.abstractCompositionInput(profile==='abstract-en');composition=input.composition;
      model.document={...model.document,title:input.document.title,altTitle:input.document.altTitle,keywords:input.document.keywords};
      model.config=input.document.config;model.profile=input.document.profile;
      schema=input.schema;
      presentationOptions={composition,className:'introduction'};
    }
    const content=isAbstract?Array.from({length:12},(_,i)=>p('EQA'+String(i).padStart(3,'0')+' '+sentence.repeat(4))):profile==='typography'?typographyInput(sentence).content:sharedPresentationInput(structuredClone(editor.getJSON().content),model);
    if(profile==='growth')for(let i=0;i<60;i++)content.push(p('EQG'+String(i).padStart(3,'0')+' '+sentence.repeat(8)));
    const currentChapter=model.chapters.find(chapter=>chapter.id==='1');currentChapter.content=content;currentChapter.id=chapterKey;
    let source=chapterSnapshotSource(schema,content,'fixture.'+chapterKey);const geometry=paginationGeometry();
    const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Continuous projection deadline')),35000);
    let presentation,projection,frame;
    const observerErrors=[],session=new SectionLayoutSession(error=>observerErrors.push(String(error)));
    const styles=new DocumentResources(task.signal);const css=await styles.styles();
    const resourceKeys=await Promise.all(Object.entries(model.images).sort(([left],[right])=>left.localeCompare(right)).map(async([id,asset])=>[id,asset.mime,await archiveSha256(asset.bytes)]));
    const dependencyIdentity={documentId:'fixture',sectionId:'fixture.'+chapterKey,optionsHash:await sha256Text(JSON.stringify(geometry)),presentationHash:await sha256Text(css),resourcesHash:await sha256Text(JSON.stringify(resourceKeys))};
    const sourceIdentity=async()=>({...dependencyIdentity,sourceHash:await sha256Text(JSON.stringify([await documentRenderFingerprint(model),source.toJSON(),composition]))});
    let job=session.begin(await sourceIdentity(),task.signal);
    const firstJob=job;
    try {
      presentation=new SharedChapterPresentation(source,model,geometry,presentationOptions);
      let {plan}=await presentation.${viewport ? 'measureSnapshot' : 'layout'}(job.signal),boundary;
      if(keywordBoundary&&presentation.snapshotComposition){
        const shell=presentation.snapshotComposition,keyword=Array.from(shell.blocks.values()).find(node=>node.textContent.includes('EQK001'));
        if(!keyword)throw Error('Missing keyword block for boundary proof');
        const paper=presentation.snapshotPaper.getBoundingClientRect(),bounds=keyword.getBoundingClientRect();
        const page=Math.floor((bounds.top-paper.top-geometry.margins.top)/geometry.stride);
        const limit=paper.top+geometry.margins.top+page*geometry.stride+geometry.contentHeight;
        const probe=presentation.snapshot.view.dom.cloneNode(false),line=document.createElement('p');line.textContent='EQA100';probe.append(line);shell.body.append(probe);
        const style=getComputedStyle(line),step=line.getBoundingClientRect().height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0);probe.remove();
        const count=Math.max(1,Math.floor((limit-bounds.bottom)/step)+1);
        if(!Number.isFinite(count)||count>100)throw Error('Keyword boundary fixture exceeds its bounded budget');
        const revised=[...source.toJSON().content,...Array.from({length:count},(_,i)=>p('EQA'+String(100+i).padStart(3,'0')+' Pengujian batas kata kunci.'))];
        source=chapterSnapshotSource(schema,revised,'fixture.'+chapterKey);currentChapter.content=source.toJSON().content;
        session.invalidate('source');job=session.begin(await sourceIdentity(),task.signal);
        presentation.destroy();presentation=new SharedChapterPresentation(source,model,geometry,presentationOptions);
        ({plan}=await presentation.measureSnapshot(job.signal));boundary={keyword:true,addedParagraphs:count};
        if(!plan.generated?.some(item=>item.slot===keyword.dataset.sectionCompositionBlock))throw Error('Keyword boundary did not exercise a generated page break');
      }
      if(profile==='typography'){
        const cut=plan.breaks.find(cut=>cut.kind==='line');if(!cut)throw Error('Typography requires a source page cut');
        boundary={originalCut:cut.from,insertedAt:cut.from-1};
        source=insertTypographyBoundary(source,boundary.insertedAt);
        model.chapters.find(chapter=>chapter.id==='1').content=source.toJSON().content;
        session.invalidate('source');
        job=session.begin(await sourceIdentity(),task.signal);
        presentation.destroy();presentation=new SharedChapterPresentation(source,model,geometry);({plan}=await presentation.${viewport ? 'measureSnapshot' : 'layout'}(job.signal));
      }
      const surfaces=()=>[{root:presentation.composition?.element??presentation.editable.dom,paper:presentation.paper},...Array.from(presentation.paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper:presentation.paper}))];
      let live;
      let output,html,viewportLifecycle;
      if(${viewport}){
        frame=new SectionViewport(presentation.snapshotPaper,geometry,plan.pages);output=frame.context;
        const counts=[];
        for(let page=1;page<=plan.pages;page++){frame.select(page);counts.push(frame.element.querySelectorAll('*').length)}
        frame.select(1);let invalidRejected=0;
        for(const invalid of [0,plan.pages+1])try{frame.select(invalid)}catch(error){if(error instanceof RangeError)invalidRejected++}
        viewportLifecycle={counts,invalidRejected,sourceStillMounted:presentation.paper.isConnected};
        html=await sectionPrintHTML(frame,job.signal,{css,assertCurrent:()=>styles.assertCurrent()});
      }else{
        projection=new ContinuousProjection(presentation.editable,geometry,plan.pages);output=projection.output;
        output.style.position='absolute';output.style.left='-100000px';document.body.append(output);
        html=await projection.html(task.signal);
      }
      const clone=(${measureContent.toString()})([{root:output,paper:output}],geometry);
      const sourceTargets=documentSourceTargets(model.chapters.map(chapter=>({id:'fixture.'+chapter.id,content:chapter.id===chapterKey?source.toJSON().content:chapter.content})));
      const mapped=sectionSourceMap(${viewport ? 'presentation.snapshot.view' : 'presentation.editable'},job.identity,geometry,sourceTargets);
      const anchors=mapped.targets,links=mapped.links;
      let revisionState,chosenResult,compositionState;
      if(${viewport}){
        const decisions=sectionLayoutDecisions(source,job.identity,plan.decisions??[]);
        const effects=sectionLayoutEffects(plan),portableFurniture=Array.from(frame.context.querySelectorAll('.editor-pagination-furniture'));
        if((effects.furniture?.length??0)!==portableFurniture.length)throw Error('Published furniture does not match canonical section');
        const portableEffects={...effects,furniture:effects.furniture?.map((item,index)=>({...item,html:portableFurniture[index].innerHTML}))};
        const ready=session.publish(job,{identity:job.identity,sourceSize:source.content.size,pages:plan.pages,geometry,html,...mapped,decisions,effects:portableEffects,composition});
        const selected=ready;chosenResult=selected;
        const editorBefore=presentation.editable.state;
        presentation.applyResult(selected);
        if(presentation.editable.state!==editorBefore)throw Error('Applying a result changed editor state/history/selection');
        if(presentation.composition){
          const blocks=Array.from(presentation.composition.blocks,([slot,node])=>({slot,text:node.textContent}));
          compositionState={blocks,generatedEffects:ready.effects.generated,
            controls:presentation.composition.element.querySelectorAll('button,input').length,
            sourceContainsKeywords:source.textContent.includes('EQK001')};
        }
        session.invalidate('source');let rejectsStale=false;
        try{session.publish(job,ready)}catch{rejectsStale=true}
        revisionState={identity:ready.identity,sources:ready.sources,targets:ready.targets,links:ready.links,decisions:ready.decisions,effects:ready.effects,resultFrozen:Object.isFrozen(ready),firstJobAborted:firstJob.signal.aborted,rejectsStale,savedResultStable:selected===ready&&ready.html===html,editorAppliedPublishedResult:true,history:presentation.probeHistory(),observerErrors};
      }
      live=(${measureContent.toString()})(surfaces(),geometry);
      const target=presentation.editable.dom.querySelector('#shared-tall-target')?.getBoundingClientRect(),origin=presentation.paper.getBoundingClientRect();
      const externalLinks=Array.from(presentation.paper.querySelectorAll('a[href^="http"]')).flatMap(node=>Array.from(node.getClientRects()).map(box=>({uri:node.href,page:Math.floor((box.top-origin.top)/geometry.stride)+1,x:box.left-origin.left,y:(box.top-origin.top)%geometry.stride,width:box.width,height:box.height})));
      const printInput=chosenResult?{html:chosenResult.html,pages:chosenResult.pages,geometry:chosenResult.geometry,anchors:chosenResult.targets,links:chosenResult.links}:{html,pages:plan.pages,geometry,anchors,links};
      return {...printInput,live,clone,externalLinks,profile,boundary,viewportLifecycle,revisionState,composition,compositionState,
        nodes:{source:presentation.paper.querySelectorAll('*').length,projection:output.querySelectorAll('*').length},
        targetPage:target?Math.floor((target.top-origin.top)/geometry.stride)+1:null,
        sourceUnchanged:before===JSON.stringify({source:editor.getJSON(),stored:await db.chapters.get('fixture.1'),selection:editor.state.selection.toJSON(),history:historyDepth()})};
    } finally {session.dispose();frame?.dispose();projection?.destroy();presentation?.destroy();clearTimeout(timer)}
  `);
}
exports.prepareProjectionInput = prepareProjectionInput;
