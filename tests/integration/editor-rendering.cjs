// Real editor and archive-snapshot rendering, using the existing isolated host.
const assert = require("node:assert/strict");
const path = require("node:path");

exports.runRendering = async ({ execute, until }) => {
  await execute(`
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=32;
    const context=canvas.getContext('2d');context.fillStyle='#334155';context.fillRect(0,0,64,32);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp'));
    await db.images.update('fixture-image',{blob});
    window.renderSource={type:'doc',content:[editor.getJSON().content[0],
      {type:'paragraph',attrs:{id:'rendered-atoms'},content:[
        {type:'variable',attrs:{name:'title'}},{type:'text',text:' / '},
        {type:'cite',attrs:{cite:citeKey}},{type:'text',text:' / '},
        {type:'cite',attrs:{cite:citeKey,citeA:true}},{type:'text',text:' / '},
        {type:'mathInline',attrs:{latex:'x^2'}},
      ]},
      {type:'imageFigure',attrs:{id:'rendered-image',figureId:'rendered-figure'},content:[
        {type:'image',attrs:{src:'fixture-image',width:64}},
        {type:'figcaption',content:[{type:'text',text:'Resolved caption'}]},
      ]},
      {type:'imageFigure',attrs:{id:'rendered-image-second',figureId:'rendered-figure'},content:[
        {type:'image',attrs:{src:'fixture-image',width:64}},
        {type:'figcaption',content:[{type:'text',text:'Second resolved caption'}]},
      ]},
      {type:'paragraph',attrs:{id:'rendered-reference'},content:[{type:'refComponent',attrs:{ref:'imageFigure',link:'rendered-image'}}]},
      {type:'paragraph',attrs:{id:'rendered-reference-second'},content:[{type:'refComponent',attrs:{ref:'imageFigure',link:'rendered-image-second'}}]},
      {type:'blockMath',attrs:{id:'rendered-equation',latex:'E=mc^2'}},
      makeTable(4),p('After table.'),
    ]};await prepareComparison(renderSource);
    editor.commands.setContent(renderSource);await waitSaved();await prepareComparison(editor.getJSON());
    const {Exporter}=await import('/src/utils/htx/exporter.ts');
    const {readImportModel}=await import('/src/utils/htx/import-model.ts');
    const {renderChapterContent}=await import('/src/editor/chapter/render-content.ts');
    window.renderChapterContent=renderChapterContent;
    window.renderModel=readImportModel((await new Exporter('fixture').buildExport()).buffer);
    window.renderNodes=renderModel.chapters.find(chapter=>chapter.id==='1').content;
  `);
  await until(
    "document.querySelector('#rendered-atoms [data-variable]')?.textContent==='Pagination fixture'&&Array.from(document.querySelectorAll('#rendered-atoms cite')).length===2&&Array.from(document.querySelectorAll('#rendered-atoms cite')).every(cite=>cite.textContent&&!cite.textContent.includes('Loading'))&&document.querySelector('#rendered-atoms .katex')&&document.querySelector('#rendered-reference')?.textContent.includes('1.1')",
  );
  const result = await execute(`
    const {Document}=await import('/src/editor/document/index.ts');
    const {HighTexDB}=await import('/src/editor/storage/hightex-db.ts');
    const {Chapter}=await import('/src/editor/chapter/chapter.ts');
    const sourceBefore=JSON.stringify(editor.getJSON()),modelBefore=JSON.stringify(renderModel);
    const storedBefore=JSON.stringify(await db.chapters.get('fixture.1')),updatesBefore=updates;
    const activeDocument=Document.instance,activeChapter=Chapter.instance,current=Document.current;
    const freeze=value=>{if(value&&typeof value==='object'&&!ArrayBuffer.isView(value)){Object.values(value).forEach(freeze);Object.freeze(value)}};
    freeze(renderModel);
    const root=document.createElement('section');root.className='tiptap ProseMirror';
    const page=document.createElement('div');page.className='page ch';page.append(root);document.body.append(page);
    const legacyRender=legacyParserClass.prototype.render,getInstance=HighTexDB.getInstance;
    const originalRevoke=URL.revokeObjectURL,revoked=[];
    URL.revokeObjectURL=function(url){revoked.push(url);return originalRevoke.call(this,url)};
    let first,second;
    try {
      legacyParserClass.prototype.render=()=>{throw Error('Legacy parser used')};
      HighTexDB.getInstance=()=>{throw Error('Renderer accessed storage')};
      first=renderChapterContent(root,renderModel,renderNodes,'1');
      const firstImage=root.querySelector('img');await firstImage.decode();await document.fonts.ready;
      const editorCites=Array.from(document.querySelectorAll('#rendered-atoms cite'),cite=>cite.textContent).slice(0,2);
      const firstImageUrl=firstImage.src;
      const other=document.createElement('section');
      const otherModel=structuredClone(renderModel);otherModel.document.title='Independent <tag> & title';
      second=renderChapterContent(other,otherModel,otherModel.chapters.find(chapter=>chapter.id==='1').content,'1');
      const secondImage=other.querySelector('img');await secondImage.decode();
      const resolved={
        issues:first.issues,
        image:firstImage.naturalWidth===64&&firstImage.naturalHeight===32,
        variable:root.querySelector('[data-variable]').textContent==='Pagination fixture',
        citations:Array.from(root.querySelectorAll('cite'),cite=>cite.textContent),editorCites,
        math:root.querySelectorAll('.katex').length===2&&!root.querySelector('.katex-error'),
        reference:root.querySelector('[data-type=ref-component]').textContent===document.querySelector('#rendered-reference').textContent,
        caption:root.querySelector('#rendered-image figcaption').dataset.label==='Gambar 1.1',
        figureIdentity:Array.from(root.querySelectorAll('figure[data-type="imageFigure"]'),figure=>figure.id),
        secondCaption:root.querySelector('#rendered-image-second figcaption').dataset.label==='Gambar 1.2',
        secondReference:root.querySelector('#rendered-reference-second').textContent==='Gambar 1.2',
        sharedImageURL:root.querySelector('#rendered-image-second img').src===firstImageUrl,
        table:root.querySelectorAll('table tr').length===4&&root.querySelectorAll('table tr:first-child th').length===2,
        noUI:!root.querySelector('button,input,textarea,[contenteditable=true]'),
        independent:other.querySelector('[data-variable]').textContent==='Independent <tag> & title'&&!other.querySelector('tag')&&firstImageUrl!==secondImage.src,
      };
      first.dispose();first.dispose();
      await secondImage.decode();
      resolved.cleanupIsolated=revoked.filter(url=>url===firstImageUrl).length===1&&!revoked.includes(secondImage.src);
      const broken=structuredClone(renderModel);delete broken.images['fixture-image'];delete broken.references[citeKey];
      const brokenNodes=structuredClone(renderNodes);
      brokenNodes.push({type:'paragraph',content:[{type:'variable',attrs:{name:'missing-variable'}},{type:'refComponent',attrs:{ref:'imageFigure',link:'missing-target'}}]});
      brokenNodes.push({type:'paragraph',content:[{type:'mathInline',attrs:{latex:'\\\\unknownCommand'}}]});
      const brokenRoot=document.createElement('section');
      const incomplete=renderChapterContent(brokenRoot,broken,brokenNodes,'1');
      resolved.issueKinds=Array.from(new Set(incomplete.issues.map(issue=>issue.kind))).sort();
      await brokenRoot.querySelector('img').decode();resolved.missingImage=brokenRoot.querySelector('img').naturalWidth===400&&brokenRoot.querySelector('img').alt==='Gambar tidak tersedia';
      incomplete.dispose();
      const failingRoot=document.createElement('section');
      const originalCreate=URL.createObjectURL;let allocated,allocationCount=0;
      URL.createObjectURL=function(blob){if(++allocationCount===2)throw Error('Resource allocation failed');return allocated=originalCreate.call(this,blob)};
      try {
        const failingModel={...renderModel,images:{...renderModel.images,'allocation-second':renderModel.images['fixture-image']}};
        const secondAsset=structuredClone(renderNodes.find(node=>node.type==='imageFigure'));
        secondAsset.content[0].attrs.src='allocation-second';
        renderChapterContent(failingRoot,failingModel,[...renderNodes,secondAsset],'1');
        resolved.failureClean=false;
      }catch(error){resolved.failureClean=error.message==='Resource allocation failed'&&!failingRoot.childNodes.length&&revoked.filter(url=>url===allocated).length===1}
      finally{URL.createObjectURL=originalCreate}
      resolved.modelUnchanged=JSON.stringify(renderModel)===modelBefore;
      resolved.sourceUnchanged=JSON.stringify(editor.getJSON())===sourceBefore;
      resolved.storageUnchanged=JSON.stringify(await db.chapters.get('fixture.1'))===storedBefore;
      resolved.noUpdates=updates===updatesBefore;
      resolved.contextUnchanged=Document.instance===activeDocument&&Chapter.instance===activeChapter&&Document.current===current;
      return resolved;
    }finally {
      first?.dispose();second?.dispose();URL.revokeObjectURL=originalRevoke;
      HighTexDB.getInstance=getInstance;legacyParserClass.prototype.render=legacyRender;page.remove();
    }
  `);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.citations, result.editorCites);
  assert.deepEqual(result.figureIdentity, [
    "rendered-image",
    "rendered-image-second",
  ]);
  assert.deepEqual(result.issueKinds, [
    "citation",
    "image",
    "math",
    "reference",
    "variable",
  ]);
  for (const key of [
    "image",
    "variable",
    "math",
    "reference",
    "caption",
    "secondCaption",
    "secondReference",
    "sharedImageURL",
    "table",
    "noUI",
    "independent",
    "cleanupIsolated",
    "missingImage",
    "failureClean",
    "modelUnchanged",
    "sourceUnchanged",
    "storageUnchanged",
    "noUpdates",
    "contextUnchanged",
  ])
    assert.equal(result[key], true, key);
  console.log(
    "PASS: shared read-only chapter rendering resolves images, variables, both citation forms, math, captions and references; reports incomplete input; preserves source/storage/context; isolates concurrent resource cleanup and releases resources on failure without using the legacy parser or loading storage.",
  );
  const anchors = await execute(`
    const {EditorSectionRenderer}=await import('/src/document-engine/renderers/editor.ts');
    const {DocumentSections}=await import('/src/document-engine/adapters/current-category.tsx');
    const {Document}=await import('/src/editor/document/index.ts');
    const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
    const sourceBefore=JSON.stringify(editor.getJSON()),storedBefore=JSON.stringify(await db.chapters.get('fixture.1'));
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const renderer=new EditorSectionRenderer(paginationGeometry(),renderModel,new DocumentResources(new AbortController().signal));
    const definition={id:'identity-regression',kind:'editor',chapter:'1',title:'Identity regression',numbering:'arabic',className:'ch',nodes:renderNodes.filter(node=>node.type==='imageFigure'||node.attrs?.id==='rendered-reference'||node.attrs?.id==='rendered-reference-second')};
    const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Identity verification deadline')),20000);
    let rendered;
    try {
      rendered=await renderer.render(definition,{runId:'identity-run',signal:task.signal});
      const ids=rendered.pages.flatMap(page=>Array.from(page.content.querySelectorAll('figure[id]'),node=>node.id));
      const pages=rendered.pages.length;
      rendered.destroy();rendered=undefined;
      const duplicate={...definition,nodes:[
        {type:'paragraph',attrs:{id:'duplicated-source'},content:[{type:'text',text:'First target'}]},
        {type:'paragraph',attrs:{id:'duplicated-source'},content:[{type:'text',text:'Second target'}]},
      ]};
      rendered=await renderer.render(duplicate,{runId:'duplicate-run',signal:task.signal});
      const duplicateRoot=rendered.pages[0].projection.context;
      const duplicates={count:duplicateRoot.querySelectorAll('[id="duplicated-source"]').length,
        first:duplicateRoot.querySelector('[id="duplicated-source"]').textContent,
        secondRetained:duplicateRoot.textContent.includes('Second target')};
      rendered.destroy();rendered=undefined;
      const inputRecoveries=[];
      for(const entry of [
        {kind:'citation',key:'missing-native-record',nodes:[{type:'paragraph',content:[{type:'cite',attrs:{cite:'missing-native-record'}}]}]},
        {kind:'image',key:'',nodes:[{type:'image',attrs:{src:'',width:300}}]},
        {kind:'image',key:'data:image/png;base64,aW52YWxpZA==',nodes:[{type:'image',attrs:{src:'data:image/png;base64,aW52YWxpZA==',width:300}}]},
        {kind:'variable',key:'unknown-var',nodes:[{type:'paragraph',content:[{type:'variable',attrs:{name:'unknown-var'}}]}]},
        {kind:'math',key:'\\\\unknownCommand',nodes:[{type:'paragraph',content:[{type:'mathInline',attrs:{latex:'\\\\unknownCommand'}}]}]},
      ]){
        rendered=await renderer.render({...definition,nodes:entry.nodes},{runId:'input-run',signal:task.signal});
        const root=rendered.pages[0].projection.context;
        inputRecoveries.push({issues:rendered.issues,pages:rendered.pages.length,placeholder:entry.kind!=='image'||root.querySelector('img').alt==='Gambar tidak tersedia'});
        rendered.destroy();rendered=undefined;
      }
      const sections=new DocumentSections({document:await db.documents.get('fixture'),category:Document.instance.category,
        model:{...renderModel,chapters:[{id:'1',content:[{type:'paragraph',content:[{type:'cite',attrs:{cite:'missing-native-record'}}]}]}]}});
      const bibliography=sections.sections.find(section=>section.id==='bibliography');
      const preparationRecovery={issues:bibliography.issues,fallback:bibliography.html.includes('[missing-native-record]')};sections.destroy();
      return {ids,pages,duplicates,inputRecoveries,preparationRecovery,sourceUnchanged:sourceBefore===JSON.stringify(editor.getJSON()),storageUnchanged:storedBefore===JSON.stringify(await db.chapters.get('fixture.1'))};
    }finally{clearTimeout(timer);rendered?.destroy()}
  `);
  assert.deepEqual(anchors.ids, ["rendered-image", "rendered-image-second"]);
  assert.ok(anchors.pages >= 1);
  assert.deepEqual(anchors.duplicates, { count: 2, first: "First target", secondRetained: true });
  assert.equal(anchors.sourceUnchanged, true);
  assert.equal(anchors.storageUnchanged, true);
  for (const [index, issue] of [
    { kind: "citation", key: "missing-native-record" },
    { kind: "image", key: "" },
    { kind: "image", key: "data:image/png;base64,aW52YWxpZA==" },
    { kind: "variable", key: "unknown-var" },
    { kind: "math", key: "\\unknownCommand" },
  ].entries()) {
    assert.deepEqual(anchors.inputRecoveries[index].issues, [issue]);
    assert.ok(anchors.inputRecoveries[index].pages >= 1);
    assert.equal(anchors.inputRecoveries[index].placeholder, true);
  }
  assert.deepEqual(anchors.preparationRecovery, {
    issues: [{ kind: "citation", key: "missing-native-record" }], fallback: true,
  });
  console.log(
    "PASS: repeated legacy figureId preserves distinct source anchors through pagination; duplicate source IDs retain all content and keep their first reference owner; live editor and IDB remain unchanged.",
  );
  console.log(
    "PASS: missing citations/variables, invalid math and missing/corrupt images retain explicit fallbacks with input diagnostics; missing bibliography records no longer block preparation.",
  );
  await require("./editor-references.cjs").runReferences({ execute, until });
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_RENDERING = "1";
  require("./editor-pagination.cjs");
}
