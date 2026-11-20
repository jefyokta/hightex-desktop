// Cold/reused compiler equivalence and lease ownership, without printing or app builds.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { measureContent, compareContent, measureTableContent, compareTableContent } = require('./editor-pdf-geometry.cjs');

exports.run = async ({execute,artifacts}) => {
  const cycles=Number(process.env.HIGHTEX_LAYOUT_REUSE_CYCLES??20);
  assert.ok(Number.isInteger(cycles)&&cycles>=0&&cycles<=20,'Invalid bounded cycle count');
  const result = await execute(`
    const {ChapterLayoutCompiler}=await import('/src/document-engine/layout/chapter-compiler.ts');
    const {readDocumentSnapshot}=await import('/src/editor/storage/document-snapshot.ts');
    const {documentRenderModel}=await import('/src/editor/document/render-model.ts');
    const {chapterSnapshotSource}=await import('/src/editor/chapter/snapshot-source.ts');
    const {chapterRenderContext}=await import('/src/editor/chapter/render-context.ts');
    const {ChapterImageResources}=await import('/src/editor/chapter/image-resources.ts');
    const {chapterLayoutResources}=await import('/src/editor/chapter/layout-dependencies.ts');
    const {documentSourceTargets}=await import('/src/document-engine/projection/source-map.ts');
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const {sharedPresentationInput}=await import('/tests/helpers/shared-presentation-input.ts');
    const {abstractCompositionInput}=await import('/tests/helpers/abstract-composition-input.tsx');
    setPages(false);await waitSaved();
    const baseline=JSON.stringify(editor.getJSON()),stored=JSON.stringify(await db.chapters.toArray());
    const base=await documentRenderModel(await readDocumentSnapshot('fixture'));
    const nodes=sharedPresentationInput([editor.getJSON().content[0],p(sentence.repeat(35))],base);
    const images=new ChapterImageResources(base.images),compiler=new ChapterLayoutCompiler();
    const task=new AbortController(),timer=setTimeout(()=>task.abort(Error('Layout reuse fixture deadline')),30000);
    const presentationHash=await new DocumentResources(task.signal).layoutFingerprint();
    const input=async(source,composition,chapter='1')=>{
      const model={...base,chapters:[{id:chapter,content:source.toJSON().content}]};
      const context=chapterRenderContext(model),sourceTargets=documentSourceTargets([{id:'fixture.'+chapter,content:source.toJSON().content}]);
      return {source,model,sectionId:'fixture.'+chapter,className:chapter==='1'?'ch':'static-chapter',
        geometry:paginationGeometry(),composition,images,context,sourceTargets,presentationHash,
        resourcesHash:await chapterLayoutResources(source,model,context,sourceTargets,images)};
    };
    const measure=compiled=>(${measureContent.toString()})([{root:compiled.root,paper:compiled.paper},
      ...Array.from(compiled.paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper:compiled.paper}))],compiled.result.geometry);
    // Native TableView updates may reorder CSS declarations without changing them.
    // Keep every declaration/value/priority and markup; compare layout separately below.
    const normalizedHTML=html=>{
      const template=document.createElement('template');template.innerHTML=html;
      for(const node of template.content.querySelectorAll('[style]')){
        const declarations=Array.from(node.style).sort().map(property=>[property,node.style.getPropertyValue(property),node.style.getPropertyPriority(property)]);
        node.style.cssText='';for(const [property,value,priority]of declarations)node.style.setProperty(property,value,priority);
      }
      return template.innerHTML;
    };
    const portable=result=>({identity:result.identity,effects:{...result.effects,
      furniture:result.effects.furniture?.map(item=>({...item,html:normalizedHTML(item.html)}))},sources:result.sources,
      targets:result.targets,links:result.links,crossSectionTargets:result.crossSectionTargets,issues:result.issues});
    const reports=[];let previousPaper;
    const compare=async(name,source,composition,chapter)=>{
      const args=await input(source,composition,chapter),warm=await compiler.compile(args,task.signal),coldCompiler=new ChapterLayoutCompiler();
      let cold;
      try{
        cold=await coldCompiler.compile(args,task.signal);
        const report={name,pages:warm.result.pages,reused:previousPaper===warm.paper,
          expected:portable(cold.result),actual:portable(warm.result),cold:measure(cold),warm:measure(warm),
          coldTables:(${measureTableContent.toString()})(cold.paper,cold.result.geometry),
          warmTables:(${measureTableContent.toString()})(warm.paper,warm.result.geometry)};
        reports.push(report);previousPaper=warm.paper;
      }finally{warm.destroy();cold?.destroy();coldCompiler.dispose()}
    };
    try{
      let source=chapterSnapshotSource(editor.state.schema,nodes,'fixture.1');
      await compare('initial',source);
      let pos;source.descendants((node,from)=>{if(pos===undefined&&node.type.name==='paragraph')pos=from+1});
      source=nativeEditor.EditorState.create({doc:source}).tr.insertText(sentence.repeat(8),pos).doc;
      await compare('text edit',source);
      let cell;source.descendants((node,from)=>{if(cell===undefined&&node.type.name==='tableCell')cell=from+2});
      source=nativeEditor.EditorState.create({doc:source}).tr.insertText(sentence.repeat(5),cell).doc;
      await compare('table cell edit',source);
      let column;source.descendants((node,from)=>{if(column===undefined&&node.type.name==='tableHeader')column={node,from}});
      source=nativeEditor.EditorState.create({doc:source}).tr.setNodeMarkup(column.from,undefined,{...column.node.attrs,colwidth:[160]}).doc;
      await compare('table column resize',source);
      let image;source.descendants((node,from)=>{if(image===undefined&&node.type.name==='image')image={node,from}});
      source=nativeEditor.EditorState.create({doc:source}).tr.setNodeMarkup(image.from,undefined,{...image.node.attrs,width:310}).doc;
      await compare('image width edit',source);
      const {textFlowInput}=await import('/tests/helpers/text-flow-input.ts');
      source=chapterSnapshotSource(editor.state.schema,[nodes[0],...textFlowInput('rules')],'fixture.1');
      await compare('typography and break rules',source);
      const lineCut=reports.at(-1).actual.effects.breaks.find(item=>item.kind==='line');
      if(!lineCut)throw Error('Missing typography cut');
      const boundarySource=source;
      for(const offset of [-1,0,1]){
        const edited=nativeEditor.EditorState.create({doc:boundarySource}).tr.insert(lineCut.from+offset,source.type.schema.nodes.hardBreak.create()).doc;
        source=chapterSnapshotSource(editor.state.schema,edited.toJSON().content,'fixture.1');
        await compare('hard break at cut '+offset,source);
      }
      // Restore an image source before the existing image-cancellation branch.
      source=chapterSnapshotSource(editor.state.schema,nodes,'fixture.1');
      await compare('restore image source',source);
      const cancelled=new AbortController(),reason=new DOMException('Reuse cancellation','AbortError');
      let cancellation=false;
      const cancelledInput=await input(source);
      try{
        await compiler.compile({...cancelledInput,images:{data:async key=>{cancelled.abort(reason);return images.data(key)}}},cancelled.signal);
      }catch(error){cancellation=error===reason}
      const cancelledSurfaceReleased=!previousPaper.isConnected;
      await compare('after cancel',source);
      const args=await input(source),first=await compiler.compile(args,task.signal),before=first.paper.outerHTML;
      const second=await compiler.compile(args,task.signal);
      const leases={independent:first.paper!==second.paper,unchanged:before===first.paper.outerHTML};
      first.destroy();second.destroy();
      const abstract=abstractCompositionInput(false);
      source=chapterSnapshotSource(abstract.schema,[p(sentence.repeat(35))],'fixture.abstract');
      await compare('abstract initial',source,abstract.composition,'abstract');
      source=nativeEditor.EditorState.create({doc:source}).tr.insertText(sentence.repeat(4),1).doc;
      await compare('abstract edit',source,abstract.composition,'abstract');
      const held=await compiler.compile(await input(source,abstract.composition,'abstract'),task.signal);
      compiler.clearSurface();held.destroy();
      const disabledReleased=!previousPaper.isConnected;
      const lifecycle=[];
      for(let cycle=0;cycle<${cycles};cycle++){
        const cycleTask=new AbortController();
        let outcome='completed';
        try{
          const args=await input(source,abstract.composition,'abstract');
          // Cancel this branch during input hashing, before publication.
          if(cycle%2){
            const pending=compiler.compile(args,cycleTask.signal);queueMicrotask(()=>cycleTask.abort(reason));await pending;
          }else{const compiled=await compiler.compile(args,cycleTask.signal);compiled.destroy()}
        }catch(error){if(error!==reason)throw error;outcome='cancelled'}
        lifecycle.push({cycle,outcome,surfaces:document.querySelectorAll('[data-pagination-surface]').length,
          measuring:document.querySelectorAll('[data-pagination-measure]').length});
      }
      compiler.dispose();images.dispose();
      return {reports,leases,cancellation,cancelledSurfaceReleased,disabledReleased,lifecycle,cleanup:document.querySelectorAll('[data-pagination-surface],[data-pagination-measure]').length,
        unchanged:baseline===JSON.stringify(editor.getJSON())&&stored===JSON.stringify(await db.chapters.toArray()),errors:window.errors};
    }finally{clearTimeout(timer);compiler.dispose();images.dispose()}
  `);
  fs.writeFileSync(path.join(artifacts,'layout-reuse.json'),JSON.stringify(result));
  for(const report of result.reports){
    assert.deepEqual(report.actual,report.expected,report.name+' portable result changed');
    report.geometry=compareContent(report.cold,report.warm,.75);
    report.tables=compareTableContent(report.coldTables,report.warmTables);
    if(['text edit','table cell edit','table column resize','image width edit','abstract edit'].includes(report.name))assert.equal(report.reused,true,report.name+' rebuilt the measuring surface');
    delete report.expected;delete report.actual;delete report.cold;delete report.warm;
    delete report.coldTables;delete report.warmTables;
  }
  assert.deepEqual(result.leases,{independent:true,unchanged:true});
  assert.equal(result.cancellation,true);assert.equal(result.cancelledSurfaceReleased,true);
  assert.equal(result.lifecycle.filter(cycle=>cycle.outcome==='completed').length,Math.ceil(cycles/2));
  assert.equal(result.lifecycle.filter(cycle=>cycle.outcome==='cancelled').length,Math.floor(cycles/2));
  assert.ok(result.lifecycle.every(cycle=>cycle.surfaces<=1&&cycle.measuring===0));
  assert.equal(result.disabledReleased,true);assert.equal(result.cleanup,0);assert.equal(result.unchanged,true);assert.deepEqual(result.errors,[]);
  fs.writeFileSync(path.join(artifacts,'layout-reuse-summary.json'),JSON.stringify(result,null,2));
  console.log('PASS canonical layout reuse:',artifacts,JSON.stringify(result));
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  process.env.HIGHTEX_LAYOUT_REUSE='1';require('./editor-pagination.cjs');
}
