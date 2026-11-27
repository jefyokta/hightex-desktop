// Whole-document equality across actual navigation, UI viewport and theme, with one native PDF per archive.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
exports.verify=async({execute,until,win,artifacts,label})=>{
  const report={cases:[]};const save=()=>fs.writeFileSync(path.join(artifacts,label+'-contexts.json'),JSON.stringify(report,null,2));
  const source=await execute(`
    window.corpusCold=archiveSnapshot;
    return {sourceHash:corpusCold.sourceHash,sections:corpusCold.sections,projection:corpusCold.projection,presentation:corpusCold.presentation};
  `);
  report.baseline={pages:source.sections.reduce((total,item)=>total+item.pages,0),sourceHash:source.sourceHash,projection:digest(source.projection),presentation:digest(source.presentation)};save();
  const chapters=await execute(`
    window.editor.sourceFile=async()=>undefined;window.application={isDev:false};
    const normal=archiveContext.chapters.filter(chapter=>chapter.query.isNormalChapter()).map(chapter=>chapter.getChapter());
    window.corpusContextState=()=>applicationEditor&&!applicationEditor.isDestroyed&&archivePaginationKey.getState(applicationEditor.state);
    return [...new Set([normal[0],normal.at(-1),'attachment'].filter(Boolean))];
  `);
  const initial=chapters[0];
  try{
    await execute(`mountApplication('/document/'+archiveContext.id+'/${initial}')`);
    for(const [index,chapter]of chapters.entries()){
      if(index)await execute(`window.navigate('/document/'+archiveContext.id+'/${chapter}')`);
      await until(`window.applicationEditor&&!applicationEditor.isDestroyed&&applicationChapter()===archiveContext.id+'.${chapter}'&&corpusContextState()?.result&&!corpusContextState().pending&&corpusContextState().numbering&&!corpusContextState().numbering.pending`,180000);
      await compare('active-'+chapter);
    }
    win.setSize(760,950);
    await execute(`document.documentElement.classList.add('dark');window.dispatchEvent(new Event('resize'))`);
    await until('corpusContextState()?.result&&!corpusContextState().pending&&corpusContextState().numbering&&!corpusContextState().numbering.pending',180000);
    await compare('narrow-dark-'+chapters.at(-1));
    report.complete=true;save();return report;
  }catch(error){
    report.complete=false;report.error=error.message;report.stack=error.stack;
    const diagnostic=await execute(`
      const {getEditorChapter}=await import('/src/editor/event/index.ts');
      const {readExportDocument}=await import('/src/document-export/source/document-snapshot.ts');
      const {chapterSnapshotSource}=await import('/src/editor/chapter/snapshot-source.ts');
      const chapter=getEditorChapter(applicationEditor),source=applicationEditor.state.doc;
      if(!chapter)return {editorReady:false};
      const {model}=await readExportDocument(chapter.getDocumentId(),new AbortController().signal,chapter.getVersion()??undefined);
      const key=chapter.getId().slice(chapter.getDocumentId().length+1),stored=model.chapters.find(item=>item.id===key),content=chapter.sourceContent(stored?.content);
      if(stored?.content[0]?.type!=='heading'&&source.firstChild?.type.name==='heading'&&source.firstChild.textContent===chapter.title)content[0]=source.firstChild.toJSON();
      const expected=chapterSnapshotSource(source.type.schema,content,chapter.getId(),source);
      return {chapter:key,storedNodes:stored?.content.length??0,equal:source.eq(expected),actual:source.toJSON(),expected:expected.toJSON(),sourceUnchanged:archiveBefore===await archiveSavedSource(archiveContext.id)};
    `).catch(cause=>({diagnosticError:cause.message}));
    fs.writeFileSync(path.join(artifacts,label+'-source-difference.json'),JSON.stringify(diagnostic,null,2));
    save();return report;
  }finally{
    win.setSize(1100,950);
    await execute(`
      document.documentElement.classList.remove('dark');archiveSnapshot=corpusCold;
      window.corpusEditorDOM=applicationEditor?.view.dom;window.mountChapterFixture(archiveFixture);
    `);
    await until('window.ready&&window.editor&&!editor.isDestroyed&&editor.view.dom!==corpusEditorDOM');
    await execute('corpusCold=undefined');
  }
  async function compare(name){
    console.log('Corpus context:',label,name);
    const value=await execute(`
      const task=new AbortController(),timer=setTimeout(()=>task.abort(Error('Corpus context capture deadline')),180000);
      try{
        const snapshot=await archiveCapture(applicationEditor,task.signal);
        return {sourceHash:snapshot.sourceHash,sections:snapshot.sections,projection:snapshot.projection,presentation:snapshot.presentation,sourceUnchanged:archiveBefore===await archiveSavedSource(archiveContext.id)};
      }finally{clearTimeout(timer)}
    `);
    const item={name,sourceHash:value.sourceHash,sourceUnchanged:value.sourceUnchanged,sectionsEqual:JSON.stringify(value.sections)===JSON.stringify(source.sections),projectionEqual:digest(value.projection)===digest(source.projection),presentationEqual:digest(value.presentation)===digest(source.presentation)};
    report.cases.push(item);save();
    if(!item.presentationEqual||!item.projectionEqual){
      const changes=[];
      for(let context=0;context<Math.max(source.presentation.length,value.presentation.length);context++){
        const a=source.presentation[context]??[],b=value.presentation[context]??[];
        for(let box=0;box<Math.max(a.length,b.length);box++)if(JSON.stringify(a[box])!==JSON.stringify(b[box])){
          if(changes.length<24)changes.push({context,box,cold:a[box],active:b[box]});
        }
      }
      fs.writeFileSync(path.join(artifacts,label+'-'+name+'-difference.json'),JSON.stringify({changes,coldProjection:source.projection,activeProjection:value.projection},null,2));
    }
    assert.equal(item.sourceUnchanged,true,'Context capture/navigation wrote source');
    assert.equal(value.sourceHash,source.sourceHash,'Active navigation changed the captured revision');
    assert.equal(item.sectionsEqual,true,'Page breaks/labels depend on active chapter/theme/viewport');
    assert.equal(item.projectionEqual,true,'Destinations/links depend on active chapter/theme/viewport');
    assert.equal(item.presentationEqual,true,'Content X/Y extents depend on active chapter/theme/viewport');
  }
};
