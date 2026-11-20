const assert = require("node:assert/strict");
const { writeFileSync } = require("node:fs");
const path = require("node:path");

exports.run = async ({ execute, until, win, artifacts }) => {
  await execute(`
    window.contentImages=()=>Array.from(editor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)')).filter(image=>!image.closest('[data-editor-ui]'));
    await db.images.put({id:'corrupt-image',documentId:'fixture',blob:new Blob(['broken'],{type:'image/png'})});
    window.fallbackNodes=[editor.getJSON().content[0],
      {type:'imageFigure',attrs:{id:'same-figure'},content:[{type:'image',attrs:{src:'missing-image',width:0}},{type:'figcaption',content:[{type:'text',text:'Missing image'}]}]},
      {type:'imageFigure',attrs:{id:'same-figure'},content:[{type:'image',attrs:{src:'corrupt-image',width:'bad'}},{type:'figcaption',content:[{type:'text',text:'Corrupt image'}]}]},
      {type:'paragraph',content:[{type:'cite',attrs:{cite:'missing-cite'}},{type:'text',text:' / '},{type:'refComponent',attrs:{ref:'figureTable',link:'missing-table',label:'999'}}]},
      {type:'paragraph',content:[{type:'text',text:'Broken link',marks:[{type:'link',attrs:{href:'#%zz'}}]}]},
      {type:'paragraph',content:[{type:'refComponent',attrs:{ref:'imageFigure',link:'same-figure',label:'999'}}]},
    ];
    editor.commands.setContent({type:'doc',content:fallbackNodes});
    await waitSaved();
    setPages(true);
  `);
  try {
    await until(`layoutReady()&&!layout().error&&contentImages().length===2&&contentImages().every(image=>image.complete&&image.naturalWidth===400)`, 10000);
  } catch (error) {
    const state = await execute(`return {source:editor.getJSON(),images:Array.from(editor.view.dom.querySelectorAll('img'),image=>({src:image.src,complete:image.complete,width:image.naturalWidth})),html:editor.view.dom.innerHTML}`);
    writeFileSync(path.join(artifacts, "content-fallback-failure.json"), JSON.stringify(state, null, 2));
    console.error("Fallback state:", JSON.stringify(state.images), artifacts);
    throw error;
  }
  const navigation=await execute(`
    const {paginationKey}=await import('/src/editor/pagination/state.ts');
    const {focusEditorDiagnostic}=await import('/src/scanner/navigation.ts');
    const issue=paginationKey.getState(editor.state).result.issues.find(issue=>issue.source);
    const selection=editor.state.selection.toJSON();
    const diagnostic={pluginId:'pagination',code:'image',severity:'warning',message:'Recovered content',chapterId:issue.source.chapterId,source:issue.source};
    const fresh=await focusEditorDiagnostic(editor,diagnostic),focused=JSON.stringify(editor.state.selection.toJSON());
    const stale=await focusEditorDiagnostic(editor,{...diagnostic,source:{...issue.source,sourceRevision:'0'.repeat(64)}});
    const staleSelection=focused===JSON.stringify(editor.state.selection.toJSON());
    editor.commands.setTextSelection({from:selection.anchor,to:selection.head});
    return {fresh,stale,staleSelection};
  `);
  const assets=[];
  for(const height of [50,100]){
    await execute(`await db.images.put({id:'missing-image',documentId:'fixture',blob:new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="100" height="${height}"><rect width="100" height="${height}" fill="blue"/></svg>'],{type:'image/svg+xml'})})`);
    await until(`layoutReady()&&!layout().error&&contentImages()[0].naturalWidth===100&&contentImages()[0].naturalHeight===${height}`,10000);
    const change=await execute(`
      const {prepareEditorExport}=await import('/src/document-export/source/prepare-editor.ts');
      const {EditorSectionRenderer}=await import('/src/document-engine/renderers/editor.ts');
      const input=await prepareEditorExport(editor,new AbortController().signal),renderer=new EditorSectionRenderer(input.baseGeometry,input.model,input.resources);
      let rendered;
      try{
        rendered=await renderer.render({id:'1',kind:'editor',chapter:'1',title:'Changed image',numbering:'arabic',className:'ch',nodes:input.model.chapters.find(item=>item.id==='1').content},{runId:'changed-image',signal:new AbortController().signal});
        const image=rendered.pages[0].projection.context.querySelector('img'),live=contentImages()[0];
        return {width:image.getBoundingClientRect().width,height:image.getBoundingClientRect().height,
          liveWidth:live.getBoundingClientRect().width,liveHeight:live.getBoundingClientRect().height};
      }finally{rendered?.destroy();renderer.destroy()}
    `);
    assert.ok(Math.abs(change.width-change.liveWidth)<.1&&Math.abs(change.height-change.liveHeight)<.1,'Changed asset differs between editor and canonical');assets.push(change);
  }
  await execute("await db.images.delete('missing-image')");
  await until('layoutReady()&&!layout().error&&contentImages().every(image=>image.naturalWidth===400)',10000);
  const point = await execute(`const box=editor.view.dom.querySelector('img').getBoundingClientRect();window.beforeHover=[box.width,box.height];return {x:Math.round(box.left+20),y:Math.round(box.top+20)}`);
  win.webContents.sendInputEvent({ type: "mouseMove", ...point });
  const report = await execute(`
    const {Document}=await import('/src/editor/document/index.ts');
    const {prepareEditorExport}=await import('/src/document-export/source/prepare-editor.ts');
    const {DocumentEngine}=await import('/src/document-engine/index.ts');
    const {EditorSectionRenderer}=await import('/src/document-engine/renderers/editor.ts');
    const {SectionLayoutCache}=await import('/src/document-engine/layout/layout-cache.ts');
    const {captureDocumentContexts}=await import('/src/document-export/snapshot/capture-contexts.ts');
    const {installPDFSnapshot}=await import('/src/document-export/print/install-snapshot.ts');
    const {MISSING_IMAGE_SOURCE}=await import('/src/editor/extensions/image/fallback.ts');
    const {DocumentSections}=await import('/src/document-engine/adapters/current-category.tsx');
    const source=JSON.stringify(editor.getJSON()),stored=JSON.stringify(await db.chapters.get('fixture.1'));
    const hovered=editor.view.dom.querySelector('img').getBoundingClientRect();
    const hoverStable=JSON.stringify(beforeHover)===JSON.stringify([hovered.width,hovered.height]);
    const activeImages=contentImages().map(image=>({src:image.src,width:image.getBoundingClientRect().width,height:image.getBoundingClientRect().height}));
    const input=await prepareEditorExport(editor,new AbortController().signal),cache=new SectionLayoutCache();
    const ids=[];let allNodesHaveIds=true;
    editor.state.doc.descendants(node=>{if(!node.isText){allNodesHaveIds&&=Boolean(node.attrs.id);ids.push(node.attrs.id)}});
    const editorUniqueIds=allNodesHaveIds&&ids.length===new Set(ids).size;
    const originalWidths=[];editor.state.doc.descendants(node=>{if(node.type.name==='image')originalWidths.push(node.attrs.width)});
    const model={...input.model,chapters:input.model.chapters.map(chapter=>chapter.id==='1'?{...chapter,content:fallbackNodes}:chapter)};
    const bibliographyModel={...input.model,
      references:{valid:'@article{ok, author={Doe, Jane}, title={Valid Recovery Entry}, year={2024}, journal={Journal}}',invalid:'@book{broken'},
      chapters:[{id:'1',content:[{type:'paragraph',content:[{type:'cite',attrs:{cite:'valid|invalid|missing'}}]}]}]};
    const bibliographyBefore=JSON.stringify(bibliographyModel);
    const category=new DocumentSections({document:input.data,category:input.category,model:bibliographyModel});
    let bibliography;
    try {
      const section=category.sections.find(section=>section.id==='bibliography');
      const dom=document.createElement('div');dom.innerHTML=section.html;
      bibliography={issues:section.issues,validCount:dom.querySelectorAll('.csl-entry').length,
        validText:dom.textContent.includes('Valid Recovery Entry'),
        missing:dom.textContent.includes('[missing]'),invalid:dom.textContent.includes('[invalid]'),
        sourceUnchanged:JSON.stringify(bibliographyModel)===bibliographyBefore};
    } finally {category.destroy()}
    const definition={id:'1',kind:'editor',chapter:'1',title:'Fallback',numbering:'arabic',className:'ch',nodes:fallbackNodes};
    const warnings=[];let snapshot,canonicalImages;
    for(let pass=0;pass<2;pass++) {
      const renderer=new EditorSectionRenderer(input.baseGeometry,model,input.resources,cache);
      const engine=new DocumentEngine({editor:renderer,template:{render:async()=>{throw Error('Unexpected template')}}});
      engine.events.on('diagnostic',({error})=>{warnings.push({pass,level:error.level,code:error.code})});
      const target=document.createElement('div');document.body.append(target);
      try {
        await engine.render(target,[definition],'fixture',new AbortController().signal);
        const root=engine.documentPages[0].projection.context;
        canonicalImages=Array.from(root.querySelectorAll('img'),image=>({src:image.src,width:image.getBoundingClientRect().width,height:image.getBoundingClientRect().height}));
        if(pass===1) snapshot=await captureDocumentContexts(engine.documentPages,{documentId:'fixture',sourceHash:input.sourceHash,planHash:'a'.repeat(64),sections:[...engine.sections],title:'Fallback',author:''},input.resources,input.appearance,new AbortController().signal);
      } finally {engine.destroy();target.remove()}
    }
    const sourceUnchanged=source===JSON.stringify(editor.getJSON())&&stored===JSON.stringify(await db.chapters.get('fixture.1'));
    const host=document.createElement('div');document.body.append(host);
    const dispose=await installPDFSnapshot(host,snapshot,new AbortController().signal);
    try {return {hoverStable,sourceUnchanged,activeImages,canonicalImages,warnings,cache:cache.stats,bibliography,editorUniqueIds,originalWidths,
      duplicateTargetCount:snapshot.projection.targets.filter(target=>target.id==='same-figure').length,
      firstReference:Array.from(host.querySelectorAll('[data-type="ref-component"]')).find(link=>link.getAttribute('data-link')==='same-figure')?.textContent,
      firstReferenceHref:host.querySelector('[data-link="same-figure"]')?.getAttribute('href'),
      printImages:Array.from(host.querySelectorAll('img'),image=>({src:image.src,width:image.getBoundingClientRect().width,height:image.getBoundingClientRect().height})),
      sharedPlaceholder:activeImages.every(image=>image.src===MISSING_IMAGE_SOURCE),fallbackReference:host.textContent.includes('Tabel ?')&&!host.textContent.includes('999'),
      inertBrokenLinks:Array.from(host.querySelectorAll('a')).filter(link=>link.getAttribute('data-link')!=='same-figure').every(link=>link.getAttribute('href')==='#')};
    } finally {dispose();host.remove()}
  `);
  writeFileSync(path.join(artifacts, "content-fallback.json"), JSON.stringify(report, null, 2));
  report.navigation=navigation;
  report.assets=assets;
  assert.equal(report.hoverStable, true);
  assert.equal(report.sourceUnchanged, true);
  assert.equal(report.sharedPlaceholder, true);
  assert.equal(report.fallbackReference, true);
  assert.equal(report.inertBrokenLinks, true);
  assert.equal(report.cache.hits, 1);
  assert.equal(report.editorUniqueIds, true);
  assert.deepEqual(report.originalWidths, [0, "bad"]);
  assert.equal(report.duplicateTargetCount, 1);
  assert.equal(report.firstReference, "Gambar 1.1");
  assert.equal(report.firstReferenceHref, "#same-figure");
  assert.deepEqual(report.bibliography, {
    issues: [{kind:"citation",key:"missing"},{kind:"citation",key:"invalid"}],
    validCount: 1, validText: true, missing: true, invalid: true, sourceUnchanged: true,
  });
  assert.ok(report.warnings.every(issue => issue.level === "warning"));
  for (const pass of [0, 1]) assert.ok(report.warnings.filter(issue => issue.pass === pass).length >= 5);
  for (const images of [report.canonicalImages, report.printImages])
    for (const [index, image] of images.entries()) {
      assert.equal(image.src, report.activeImages[index].src);
      assert.ok(Math.abs(image.width - report.activeImages[index].width) <= 0.1);
      assert.ok(Math.abs(image.height - report.activeImages[index].height) <= 0.1);
    }
  assert.deepEqual(report.navigation,{fresh:true,stale:false,staleSelection:true});
  writeFileSync(path.join(artifacts, "content-fallback.json"), JSON.stringify(report, null, 2));
  console.log("PASS: shared image fallback/hover/cache remain stable; mixed valid, malformed and missing bibliography records preserve valid entries and isolate placeholders; source/IDB unchanged.");
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_CONTENT_FALLBACK = "1";
  process.env.HIGHTEX_EDITOR_RENDERING = "1";
  require("./editor-pagination.cjs");
}
