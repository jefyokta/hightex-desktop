const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.run = async ({execute,artifacts}) => {
  const result=await execute(`
    setPages(false);await waitSaved();
    const {abstractCompositionInput}=await import('/tests/helpers/abstract-composition-input.tsx');
    const {abstractCompositionDefinition}=await import('/src/document-engine/adapters/abstract-composition.tsx');
    const {SectionComposition}=await import('/src/document-engine/composition/section-composition.ts');
    const {ReadOnlyChapter}=await import('/src/editor/chapter/read-only-chapter.ts');
    const {measureEditor}=await import('/src/editor/pagination/measurement/measure-chapter.ts');
    const {FlowCache}=await import('/src/editor/pagination/flow/text-flow.ts');
    const {paginationGeometry,applyPageGeometry}=await import('/src/editor/pagination/options.ts');
    const {readDocumentSnapshot}=await import('/src/editor/storage/document-snapshot.ts');
    const {documentRenderModel}=await import('/src/editor/document/render-model.ts');
    const model=await documentRenderModel(await readDocumentSnapshot('fixture'));
    const before=JSON.stringify(editor.getJSON()),geometry=paginationGeometry(),reports=[];
    const task=new AbortController(),timer=setTimeout(()=>task.abort(Error('Generated flow deadline')),25000);
    const create=(definition,source)=>{
      const paper=document.createElement('div');paper.className='page static-chapter';paper.dataset.paginationSurface='';
      paper.style.cssText='position:absolute;left:-100000px;top:0';applyPageGeometry(paper,geometry);document.body.append(paper);
      const composition=new SectionComposition(document,definition);paper.append(composition.element);
      const chapter=new ReadOnlyChapter(composition.body,source,model);
      return {paper,composition,chapter,destroy:()=>{chapter.destroy();paper.remove()}};
    };
    const measure=(entry)=>{
      const origin=entry.paper.getBoundingClientRect(),bad=[],glyphs=[];
      for(const [slot,block] of entry.composition.blocks) {
        const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let text;
        while(text=walker.nextNode()) {
          if(text.parentElement.closest('[data-editor-page-break]'))continue;
          const range=document.createRange();range.selectNodeContents(text);
          for(const rect of range.getClientRects()) {
            if(!rect.width||!rect.height)continue;
            const y=rect.top-origin.top-geometry.margins.top,page=Math.floor(y/geometry.stride);
            if(y<page*geometry.stride-1||rect.bottom-origin.top-geometry.margins.top>page*geometry.stride+geometry.contentHeight+1)
              bad.push({slot,text:text.textContent.slice(0,40),y,bottom:rect.bottom-origin.top});
          }
          for(let offset=0;offset<text.length;offset++) {
            range.setStart(text,offset);range.setEnd(text,offset+1);const rect=range.getBoundingClientRect();
            glyphs.push({slot,text:text.data[offset],x:rect.left-origin.left,y:rect.top-origin.top});
          }
        }
      }
      return {bad,glyphs};
    };
    try {
      for(const variant of ['normal-id','keywords-id','prefix-en']) {
        const english=variant==='prefix-en',input=abstractCompositionInput(english),data=structuredClone(input.document);
        if(variant==='keywords-id')data.keywords.indonesian=Array.from({length:220},(_,i)=>'KUNCI'+i+' _dokumen_ penelitian panjang');
        if(english)data.altTitle='PREFIX-BEGIN '+('Long generated title preserving complete text. '.repeat(190))+' PREFIX-END';
        const definition=abstractCompositionDefinition(data,{id:1,name:'Fixture',variant:'thesis',chapters:[]},english?'abstract-en':'abstract',false);
        const source=input.schema.nodeFromJSON({type:'doc',content:[p(sentence.repeat(10)),p('BODY-END')]});
        const sourceBefore=JSON.stringify(source.toJSON()),entry=create(definition,source);let replay;
        try {
          await document.fonts.ready;
          const templateBefore=entry.composition.element.textContent;
          const cache=new FlowCache();let prior='',stable=false,plan;
          for(let pass=0;pass<4;pass++) {
            plan=await measureEditor(entry.chapter.view,cache,task.signal,geometry,entry.composition);
            entry.chapter.applyLayout(source,plan);entry.composition.apply({breaks:plan.breaks,generated:plan.generated});
            const signature=JSON.stringify(plan);if(signature===prior){stable=true;break}prior=signature;
          }
          const first=measure(entry),text=entry.composition.element.textContent.replaceAll('\\u2060','');
          replay=create(definition,source);replay.chapter.applyLayout(source,plan);
          const effects={breaks:plan.breaks,generated:structuredClone(plan.generated)};replay.composition.apply(effects);
          const widgets=replay.composition.element.querySelectorAll('[data-editor-page-break]').length;
          replay.composition.apply({breaks:plan.breaks,generated:structuredClone(plan.generated)});
          const second=measure(replay);
          const equivalent=first.glyphs.length===second.glyphs.length&&first.glyphs.every((glyph,i)=>{
            const other=second.glyphs[i];return glyph.text===other.text&&glyph.slot===other.slot&&Math.abs(glyph.x-other.x)<0.1&&Math.abs(glyph.y-other.y)<0.1;
          });
          const noDuplicateGaps=widgets===replay.composition.element.querySelectorAll('[data-editor-page-break]').length;
          replay.composition.apply(effects,{...definition,html:definition.html+'<!-- new metadata -->'});
          const stalePlanCleared=Array.from(replay.composition.blocks.values()).every(block=>!block.querySelector('[data-editor-page-break]'));
          replay.composition.apply({breaks:[],generated:[]});
          reports.push({variant,stable,pages:plan.pages,bad:first.bad.slice(0,5),replayBad:second.bad.slice(0,5),equivalent,
            completeText:text===templateBefore,sourceUnchanged:sourceBefore===JSON.stringify(source.toJSON()),
            inlineBreaks:plan.generated?.filter(item=>item.offset!==undefined).length??0,
            noDuplicateGaps,stalePlanCleared,cleared:replay.composition.element.querySelectorAll('[data-editor-page-break]').length===0,
            portable:!!structuredClone(plan)});
        } finally {replay?.destroy();entry.destroy()}
      }
      return {reports,editorUnchanged:before===JSON.stringify(editor.getJSON())};
    } finally {clearTimeout(timer)}
  `);
  fs.writeFileSync(path.join(artifacts,'generated-flow.json'),JSON.stringify(result,null,2));
  console.log('Generated flow:',artifacts,JSON.stringify(result));
  assert.equal(result.editorUnchanged,true);
  for(const report of result.reports) {
    for(const field of ['stable','equivalent','completeText','sourceUnchanged','noDuplicateGaps','stalePlanCleared','cleared','portable'])assert.equal(report[field],true,report.variant+' '+field);
    assert.deepEqual(report.bad,[],report.variant+' generated text bounds');assert.deepEqual(report.replayBad,[]);
    if(report.variant!=='normal-id')assert.ok(report.inlineBreaks>0,report.variant+' internal fragmentation');
  }
};

exports.runLive = async ({execute,until,artifacts}) => {
  await execute(`
    setPages(false);await waitSaved();
    const {Document}=await import('/src/editor/document/index.ts');
    const abstract=Document.instance.chapters.find(chapter=>chapter.getChapter()==='abstract');
    await db.chapters.put({id:'fixture.abstract',content:[
      {type:'heading',attrs:{level:1,id:'abstract-heading'},content:[{type:'text',text:'ABSTRAK'}]},p(sentence.repeat(8))]});
    window.mountChapterFixture(abstract);
  `);
  await until('window.ready&&editor&&!editor.isDestroyed');
  await execute(`
    setPages(false);
    const {SectionComposition}=await import('/src/document-engine/composition/section-composition.ts');
    const {abstractCompositionDefinition}=await import('/src/document-engine/adapters/abstract-composition.tsx');
    window.generatedLive={source:JSON.stringify(editor.getJSON()),selection:JSON.stringify(editor.state.selection.toJSON()),history:JSON.stringify(historyDepth()),
      stored:JSON.stringify((await db.chapters.get('fixture.abstract')).content)};
    generatedLive.mount=async count=>{
      const data=await db.documents.get('fixture');
      data.keywords={...data.keywords,indonesian:Array.from({length:count},(_,i)=>'KUNCI'+i+' _dokumen_ penelitian panjang')};
      await db.documents.put(data);
      const definition=abstractCompositionDefinition(data,{id:1,name:'Fixture',variant:'thesis',chapters:[]},'abstract',true);
      const body=editor.view.dom.parentElement,page=editor.view.dom.closest('.page');
      const next=new SectionComposition(document,definition);next.body.append(body);
      generatedLive.shell?.element.remove();page.prepend(next.element);generatedLive.shell=next;
      editor.view.dom.dispatchEvent(new Event('section-composition-change'));
      return definition.html;
    };
    generatedLive.longHTML=await generatedLive.mount(220);setPages(true);
  `);
  await until('layoutReady()&&!layout().error&&layout().generated?.some(item=>item.offset!==undefined)');
  const result = await execute(`
    const result={pages:layout().pages,inlineBreaks:layout().generated.filter(item=>item.offset!==undefined).length};
    generatedLive.shortHTML=await generatedLive.mount(2);return result;
  `);
  // A metadata observer may already have queued a second job; bind to the new shell.
  await until(`layoutReady()&&!layout().error&&(await import('/src/editor/pagination/state.ts')).paginationKey.getState(editor.state).result?.composition?.html===generatedLive.shortHTML`);
  Object.assign(result,await execute(`
    await waitSaved();
    const state=(await import('/src/editor/pagination/state.ts')).paginationKey.getState(editor.state);
    const result={source:generatedLive.source===JSON.stringify(editor.getJSON()),
      selection:generatedLive.selection===JSON.stringify(editor.state.selection.toJSON()),
      history:generatedLive.history===JSON.stringify(historyDepth()),
      readyMatches:state.layoutComposition.html===generatedLive.shortHTML,
      storageUnchanged:generatedLive.stored===JSON.stringify((await db.chapters.get('fixture.abstract')).content),
      errors:window.errors};
    editor.destroy();return result;
  `));
  fs.writeFileSync(path.join(artifacts,'generated-live.json'),JSON.stringify(result,null,2));
  console.log('Live generated metadata:',artifacts,JSON.stringify(result));
  for(const key of ['source','selection','history','readyMatches','storageUnchanged'])assert.equal(result[key],true,key);
  assert.deepEqual(result.errors,[]);
};
