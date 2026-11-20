const assert = require('node:assert/strict');

exports.verifyReferenceRecount = async ({execute,until}) => {
  await execute(`
    setPages(false);
    const input=editor.getJSON(), firstTable=makeTable(2);
    firstTable.attrs={id:'recount-first-table',figureId:'recount-first-table-figure'};
    const firstImage={type:'imageFigure',attrs:{id:'recount-first-image',figureId:'recount-first-image-figure'},content:[{type:'image',attrs:{src:'fixture-image',width:140}},{type:'figcaption',content:[{type:'text',text:'Gambar pendahulu'}]}]};
    input.content.splice(1,0,firstTable,firstImage,{type:'blockMath',attrs:{id:'recount-first-equation',latex:'a=b'}});
    const poison=node=>{
      if(node.type==='refComponent')node.attrs.label='NOMOR SALAH 999';
      node.content?.forEach(poison);
    };input.content.forEach(poison);
    input.content.push({type:'paragraph',attrs:{id:'recount-image-reference'},content:[{type:'refComponent',attrs:{ref:'imageFigure',link:'equivalence-image',label:'Gambar 999'}}]});
    editor.commands.setContent(input);await waitSaved();await prepareComparison(editor.getJSON());
    const {getEditorChapter}=await import('/src/editor/event/index.ts');
    const {Manager}=await import('/src/editor/manager/index.ts');
    const chapter=getEditorChapter(editor), cached=await db.chapterGraphs.get(chapter.getId());
    for(const kind of ['images','tables','equations'])for(const item of cached.data[kind]){item.numbering='999';item.pos=999}
    await db.chapterGraphs.put(cached);
    chapter.graph.data=cached.data;
    window.recountBefore=JSON.stringify(editor.getJSON());
    await chapter.graph.warm();
    Manager.app.dispatch('chapter:update',{chapter});
    window.recountLabels=()=>Array.from(editor.view.dom.querySelectorAll('[data-type="ref-component"][data-link]'),node=>node.textContent);
    setPages(true);
  `);
  const expected=['Tabel 1.2','Persamaan 2','Gambar 1.2'];
  await until(`layoutReady()&&!layout().error&&JSON.stringify(recountLabels())===${JSON.stringify(JSON.stringify(expected))}`);
  const result=await execute(`
    const cached=await db.chapterGraphs.get('fixture.1');
    const {readDocumentSnapshot}=await import('/src/editor/storage/document-snapshot.ts');
    const {documentRenderModel}=await import('/src/editor/document/render-model.ts');
    const {renderChapterContent}=await import('/src/editor/chapter/render-content.ts');
    const model=await documentRenderModel(await readDocumentSnapshot('fixture'));
    const paper=document.createElement('div'),root=document.createElement('div');paper.className='page';root.className='tiptap';paper.style.cssText='position:absolute;left:-100000px;top:0';paper.append(root);document.body.append(paper);
    const rendered=renderChapterContent(root,model,[{type:'paragraph',content:[{type:'refComponent',attrs:{ref:'imageFigure',link:'deleted-image',label:'Gambar 1'}},{type:'refComponent',attrs:{ref:'figureTable',link:'deleted-table',label:'Tabel 1'}}]}],'1');
    let fallbacks;
    try{fallbacks=Array.from(root.querySelectorAll('a[data-type=ref-component]'),node=>({text:node.textContent,status:node.dataset.status,color:getComputedStyle(node).color}))}finally{rendered.dispose();paper.remove()}
    return {labels:recountLabels(),sourceUnchanged:recountBefore===JSON.stringify(editor.getJSON()),cachedNumbers:cached.data.tables.map(item=>item.numbering),serializedLabelRetained:JSON.stringify(editor.getJSON()).includes('NOMOR SALAH 999'),fallbacks};
  `);
  assert.deepEqual(result.labels,expected);
  assert.equal(result.sourceUnchanged,true);
  assert.equal(result.serializedLabelRetained,true,'Recount must not rewrite authored source');
  assert.ok(result.cachedNumbers.every(number=>number==='999'),'Warm should recount without rewriting cache');
  assert.deepEqual(result.fallbacks,[
    {text:'Gambar ?',status:'missing',color:'rgb(220, 38, 38)'},
    {text:'Tabel ?',status:'missing',color:'rgb(220, 38, 38)'},
  ]);
  return result;
};
