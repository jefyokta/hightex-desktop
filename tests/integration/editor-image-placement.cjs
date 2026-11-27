// Local archive diagnosis; production export must not execute these image audits.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PDFDocument}=require('pdf-lib');
exports.run=async({execute,until,win,artifacts,files,importArchive,editorPDFTest})=>{
  assert.equal(files.length,1);
  console.log('Image placement artifacts:',artifacts);
  await importArchive(execute,files[0],process.env.HIGHTEX_IMAGE_RAW_SOURCE ? {forEditing:false,mode:'overwrite'} : {});
  if(process.env.HIGHTEX_IMAGE_WORKSPACE){
    await execute(`
      const {ChapterLayoutCompiler}=await import('/src/document-engine/layout/chapter-compiler.ts');
      const {PageImageSnapshot}=await import('/src/editor/pagination/measurement/image-snapshot.ts');
      const {sectionSourceMap}=await import('/src/document-engine/projection/source-map.ts');
      window.workspaceLayoutTrace=[];
      const paginate=ChapterLayoutCompiler.prototype.paginate;
      ChapterLayoutCompiler.prototype.paginate=async function(chapter,input,...rest){
        const plan=await paginate.call(this,chapter,input,...rest),paper=chapter.view.dom.closest('.page').getBoundingClientRect(),g=input.geometry;
        const map=sectionSourceMap(chapter.view,{documentId:input.model.document.id,sectionId:input.sectionId,sourceHash:'fixture'},g,input.sourceTargets,plan.anchors);
        const imageBounds=new PageImageSnapshot(chapter.view).entries.map(({image,from,to},index)=>{const r=image.getBoundingClientRect(),page=Math.floor((r.top-paper.top)/g.stride);return {index:index+1,from,to,y:r.top-paper.top,height:r.height,overflow:Math.max(0,r.bottom-paper.top-(page*g.stride+g.margins.top+g.contentHeight))}});
        workspaceLayoutTrace.push({section:input.sectionId,images:imageBounds,pages:plan.pages,badTargets:map.targets.filter(target=>target.x<0||target.y<0||target.y>g.height||target.x>g.width).map(target=>{const el=[...chapter.view.dom.querySelectorAll('[id]')].find(node=>node.id===target.id);return {...target,html:el?.outerHTML.slice(0,1500)}}),styleTags:[...document.querySelectorAll('style')].map(node=>({id:node.id,tiptap:node.hasAttribute('data-tiptap-style')}))});return plan;
      };
      window.workspaceSourceBefore=await archiveSavedSource(archiveContext.id);
      const {workspacePDFRow}=await import('/tests/helpers/workspace-pdf-row.tsx');
      mountCustomFixture(workspacePDFRow(await db.documents.get(archiveContext.id)));
    `);
    await until("document.querySelector('[data-tour=document-actions]')");
    win.show();win.focus();win.webContents.focus();
    const point=await execute(`const box=document.querySelector('[data-tour=document-actions]').getBoundingClientRect();return {x:Math.round(box.left+box.width/2),y:Math.round(box.top+box.height/2)}`);
    win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});
    win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});
    await until("document.querySelector('[role=menuitem]')");
    await execute(`const {t}=await import('/src/utils/lang.ts');const action=[...document.querySelectorAll('[role=menuitem]')].find(node=>node.textContent.trim()===t('dashboard.export_pdf'));if(!action)throw Error('Missing workspace PDF action');action.click()`);
    await until("document.querySelector('[data-editor-pdf-completed=saved],[data-editor-pdf-error]')",180000);
    const status=await execute(`return {error:document.querySelector('[data-editor-pdf-error]')?.textContent,sourceUnchanged:workspaceSourceBefore===await archiveSavedSource(archiveContext.id),errors,trace:workspaceLayoutTrace}`);
    fs.writeFileSync(path.join(artifacts,'workspace-image-export.json'),JSON.stringify(status,null,2));
    assert.equal(status.error,undefined);assert.equal(status.sourceUnchanged,true);assert.deepEqual(status.errors,[]);
    assert(status.trace.length>0,'No independent section observations recorded');
    assert(status.trace.every(section=>section.styleTags.every(style=>!style.tiptap)),'Workspace proof retained an injected Tiptap style');
    assert.equal(status.trace.flatMap(section=>section.badTargets).length,0,'Workspace destinations enter page gaps');
    assert.equal(status.trace.flatMap(section=>section.images).filter(image=>image.overflow>1).length,0,'Workspace images cross page boundaries');
    const file=editorPDFTest.outputs.at(-1),pdf=await PDFDocument.load(fs.readFileSync(file));
    fs.copyFileSync(file,path.join(artifacts,'workspace-image-export.pdf'));
    status.pages=pdf.getPageCount();status.complete=true;
    fs.writeFileSync(path.join(artifacts,'workspace-image-export.json'),JSON.stringify(status,null,2));
    console.log('PASS actual workspace PDF menu:',artifacts,status.pages,'pages');return;
  }
  if(process.env.HIGHTEX_IMAGE_BOUNDARY){
    const value=await execute(`
      const {prepareDocumentExport}=await import('/src/document-export/source/prepare-document.ts');
      const {EditorSectionRenderer}=await import('/src/document-engine/renderers/editor.ts');
      const task=new AbortController(),input=await prepareDocumentExport(archiveContext.id,task.signal),cases=[];
      for(const lines of [0,8]){
        const model=structuredClone(input.model),nodes=model.chapters.find(chapter=>chapter.id==='4').content;
        const paragraph=nodes[28].content[2].content[0];
        for(let index=0;index<lines;index++)paragraph.content.push({type:'hardBreak'},{type:'text',text:'BOUNDARY LINE '+index});
        const renderer=new EditorSectionRenderer(input.baseGeometry,model,input.resources);
        let rendered;
        try{
          rendered=await renderer.render({id:'4',kind:'editor',chapter:'4',title:'ANALISA DAN PERANCANGAN',numbering:'arabic',className:'ch',counter:3,nodes},{runId:'image-boundary',signal:task.signal});
          const paper=rendered.pages[0].projection.context,origin=paper.getBoundingClientRect(),geometry=rendered.pages[0].projection.geometry;
          const images=Array.from(paper.querySelectorAll('.tiptap img[data-image-id]')).map((image,index)=>{const box=image.getBoundingClientRect(),page=Math.floor((box.top-origin.top)/geometry.stride);return {index:index+1,page:page+1,top:box.top-origin.top,bottom:box.bottom-origin.top,height:box.height,overflow:Math.max(0,box.bottom-origin.top-(page*geometry.stride+input.baseGeometry.margins.top+input.baseGeometry.contentHeight))}});
          cases.push({lines,pages:rendered.pages.length,images,decisions:rendered.identity.decisions,effects:rendered.identity.effects});
        }finally{rendered?.destroy();renderer.destroy()}
      }
      return {cases,sourceUnchanged:archiveBefore===await archiveSavedSource(archiveContext.id)};
    `);
    fs.writeFileSync(path.join(artifacts,'image-boundary.json'),JSON.stringify(value,null,2));
    console.log(JSON.stringify(value.cases.map(item=>({lines:item.lines,pages:item.pages,target:item.images[4],overflows:item.images.filter(image=>image.overflow>1)}))));
    assert.equal(value.sourceUnchanged,true);return;
  }
  const value=await execute(`
    const {ChapterLayoutCompiler}=await import('/src/document-engine/layout/chapter-compiler.ts');
    const {PageImageSnapshot}=await import('/src/editor/pagination/measurement/image-snapshot.ts');
    const original=ChapterLayoutCompiler.prototype.paginate;window.imagePlacementTrace=[];
    ChapterLayoutCompiler.prototype.paginate=async function(chapter,input,...rest){
      const plan=await original.call(this,chapter,input,...rest),paper=chapter.view.dom.closest('.page').getBoundingClientRect();
      const images=new PageImageSnapshot(chapter.view).entries.map(({image,from,to},index)=>{
        const box=image.getBoundingClientRect(),g=input.geometry,page=Math.floor((box.top-paper.top)/g.stride),top=paper.top+page*g.stride+g.margins.top,bottom=top+g.contentHeight;
        return {index:index+1,from,to,id:chapter.source.nodeAt(from).attrs.id,asset:chapter.source.nodeAt(from).attrs.src,page:page+1,x:box.left-paper.left,y:box.top-paper.top,width:box.width,height:box.height,overflow:Math.max(0,box.bottom-bottom),ancestors:[...function*(n){while(n&&n!==chapter.view.dom){yield {tag:n.tagName,id:n.id,class:n.className,style:n.getAttribute('style')};n=n.parentElement}}(image)]};
      });
      imagePlacementTrace.push({section:input.sectionId,pages:plan.pages,geometry:input.geometry,images,breaks:plan.breaks,decisions:plan.decisions});return plan;
    };
    const task=new AbortController(),timer=setTimeout(()=>task.abort(Error('Image capture deadline')),120000);
    try{
      const snapshot=window.archiveSnapshot=await archiveCapture(archiveContext.id,task.signal);
      return {ok:true,pages:snapshot.pages,trace:imagePlacementTrace,sourceUnchanged:archiveBefore===await archiveSavedSource(archiveContext.id)};
    }catch(error){return {ok:false,message:error.message,stack:error.stack,trace:imagePlacementTrace,sourceUnchanged:archiveBefore===await archiveSavedSource(archiveContext.id)}}
    finally{clearTimeout(timer);ChapterLayoutCompiler.prototype.paginate=original}
  `);
  fs.writeFileSync(path.join(artifacts,'image-placement.json'),JSON.stringify(value,null,2));
  console.log(JSON.stringify({ok:value.ok,pages:value.pages,error:value.message,images:value.trace.flatMap(item=>item.images).length,overflows:value.trace.flatMap(item=>item.images.filter(image=>image.overflow>1).map(image=>({section:item.section,...image}))),sourceUnchanged:value.sourceUnchanged}));
  if(!process.env.HIGHTEX_IMAGE_PRINT)return;
  assert.equal(value.ok,true);assert.equal(value.sourceUnchanged,true);
  assert.equal(value.trace.flatMap(item=>item.images).filter(image=>image.overflow>1).length,0,'Fixture image audit found bottom overflow');
  await execute(`
    const {editorPDFIdentity}=await import('/shared/editor-pdf-contract.ts');
    const {sha256Text}=await import('/src/utils/sha256.ts');
    // Audit reference coordinates are not a second layout authority in native export.
    archiveSnapshot.presentation[0][0][1]+=66.4;
    archiveSnapshot.fingerprint=await sha256Text(editorPDFIdentity(archiveSnapshot));
    await window.editorPDFExperimental.export(archiveSnapshot,crypto.randomUUID());
  `);
  const file=editorPDFTest.outputs.at(-1),pdf=await PDFDocument.load(fs.readFileSync(file));
  assert.equal(pdf.getPageCount(),value.pages);
  assert.equal(await execute('return archiveBefore===await archiveSavedSource(archiveContext.id)'),true);
  value.native={pages:pdf.getPageCount(),auditReferenceDelta:66.4,unchangedContent:true};
  fs.copyFileSync(file,path.join(artifacts,'image-placement.pdf'));
  fs.writeFileSync(path.join(artifacts,'image-placement.json'),JSON.stringify(value,null,2));
  console.log('PASS workspace document export without a runtime image/geometry test gate:',artifacts);
};
