// Actual editable NodeViews → canonical section renderer → experimental native PDF.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {nativeImage}=require('electron');
const {PDFDocument}=require('pdf-lib');
const {measureContent,compareContent,measureTableContent,compareTableContent}=require('./editor-pdf-geometry.cjs');
const {verifyPDFMarkers}=require('./editor-pdf-equivalence.cjs');
const {compactPDFSourceText}=require('./page-plan-pdf.cjs');

function nativeRaster(file,artifacts,name){
  const pages=new Map();
  return {get(page){
    if(!pages.has(page)){
      const prefix=path.join(artifacts,name+'-page-'+page);
      execFileSync('pdftoppm',['-f',String(page),'-l',String(page),'-r','96','-singlefile','-png',file,prefix],{timeout:15000});
      const image=nativeImage.createFromPath(prefix+'.png');pages.set(page,{...image.getSize(),data:image.toBitmap()});
    }
    return pages.get(page);
  }};
}

function nativeBorders(raster,rules,geometry,name){
  const pages=new Set();let checked=0;
  for(const rule of rules){
    if(rule.page<1||rule.y<geometry.margins.top-.75||rule.y>geometry.height-geometry.margins.bottom+.75)continue;
    pages.add(rule.page);
    const image=raster.get(rule.page);
    for(const ratio of [.2,.5,.8]){
      const x=Math.round(rule.x+rule.width*ratio),y=Math.round(rule.y+rule.height*ratio);let ink=false;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
        const px=x+dx,py=y+dy;if(px<0||px>=image.width||py<0||py>=image.height)continue;
        const offset=(py*image.width+px)*4;
        if((image.data[offset]+image.data[offset+1]+image.data[offset+2])/3<180)ink=true;
      }
      assert.ok(ink,'Native table border missing: '+JSON.stringify({name,rule,x,y}));checked++;
    }
  }
  return {pages:pages.size,points:checked,tolerancePixels:2};
}

exports.run=async({execute,until,artifacts,editorPDFTest},options={})=>{
  const report={cases:[],scope:'Editable editor versus canonical renderer/print host and native PDF geometry/text/border samples.'};
  const save=()=>fs.writeFileSync(path.join(artifacts,options.reportName??'table-pdf.json'),JSON.stringify(report,null,2));
  let printed;
  const cases=options.cases??process.env.HIGHTEX_TABLE_PDF_CASES?.split(',')??['merged','adjacent-nested','nested-header','caption','image'];
  const modes=options.modes??process.env.HIGHTEX_TABLE_PDF_MODES?.split(',')??['both','header','caption','none'];
  editorPDFTest.connect(await execute('return location.href'));
  try{
    await execute(`
      await db.images.put({id:'tall-fixture-image',documentId:'fixture',createdAt:0,
        blob:new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="100" height="2000"><rect width="100" height="2000" fill="blue"/></svg>'],{type:'image/svg+xml'})});
    `);
    for(const variant of cases)for(const mode of variant.startsWith('image')?['both']:modes){
      const entry={variant,mode};report.cases.push(entry);save();printed=undefined;
      await execute(`
        setPages(false);
        const inputs=await import(${JSON.stringify(options.inputModule??'/tests/helpers/complex-table-input.ts')});
        const nodes=inputs[${JSON.stringify(options.inputFunction??'captionFlowInput')}](${JSON.stringify(variant)});let serial=0;
        const mark=node=>{
          if(['paragraph','figcaption'].includes(node.type)&&node.content?.some(child=>child.type==='text')){
            const firstText=node.content.findIndex(child=>child.type==='text');
            node.content.splice(firstText,0,{type:'text',text:'EQT'+String(serial++).padStart(3,'0')+' '});
          }
          node.content?.forEach(mark);
        };nodes.forEach(mark);
        editor.commands.configureEditorPagination({repeatTableHeader:${mode==='both'||mode==='header'},repeatTableCaption:${mode==='both'||mode==='caption'},documentNumbering:false});
        editor.commands.setContent({type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:${JSON.stringify(variant==='image-only'?'EQT999 Matrix native':'Matrix native')}}]},...nodes]});
        await waitSaved();setPages(true);
      `);
      await until('layoutReady()&&!layout().error',20000);
      if(options.cutOffsets?.[variant]!==undefined){
        entry.boundary=await execute(`
          const cut=layout().breaks.find(item=>item.kind==='line');
          if(!cut)throw Error('Missing measured text cut in fixture');
          const position=cut.from+${options.cutOffsets[variant]};
          setPages(false);editor.commands.insertContentAt(position,{type:'hardBreak'});await waitSaved();setPages(true);
          return {originalCut:cut.from,position,offset:${options.cutOffsets[variant]}};
        `);
        await until('layoutReady()&&!layout().error',20000);
      }
      const input=await execute(`
        const {paginationKey}=await import('/src/editor/pagination/state.ts');
        const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
        const {paginationSection}=await import('/src/editor/pagination/section-context.ts');
        const {prepareEditorExport}=await import('/src/document-export/source/prepare-editor.ts');
        const {EditorSectionRenderer}=await import('/src/document-engine/renderers/editor.ts');
        const {documentLayoutCache}=await import('/src/editor/document/layout-cache.ts');
        const {getEditorChapter}=await import('/src/editor/event/index.ts');
        const {captureDocumentContexts}=await import('/src/document-export/snapshot/capture-contexts.ts');
        const task=new AbortController(),timer=setTimeout(()=>task.abort(Error('Table capture deadline')),30000);
        let renderer,rendered;
        try{
          const input=await prepareEditorExport(editor,task.signal),chapter=getEditorChapter(editor),paper=editor.view.dom.closest('.page');
          const geometry=paginationGeometry(paginationKey.getState(editor.state).options,paginationSection(paper));
          const source=JSON.stringify(editor.getJSON());window.tablePDFStored=JSON.stringify(await db.chapters.get('fixture.1'));
          const blocks=[];editor.state.doc.forEach((node,from)=>blocks.push({type:node.type.name,id:node.attrs.id,
            from,to:from+node.nodeSize,empty:node.content.size===0,text:node.textContent.slice(0,80)}));
          const live=(${measureContent.toString()})([{root:editor.view.dom,paper},...Array.from(paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper}))],geometry);
          const tables=(${measureTableContent.toString()})(paper,geometry);
          const quoted=value=>Array.from(value.matchAll(/"(?:[^"\\\\]|\\\\.)*"/g),match=>JSON.parse(match[0])).join('');
          const generated='BAB1'+${JSON.stringify(typeof options.generatedText==='object'?options.generatedText[variant]??'':options.generatedText??'')}+Array.from(paper.querySelectorAll('figcaption'),node=>quoted(getComputedStyle(node,'::before').content)+quoted(getComputedStyle(node,'::after').content)).join('');
          renderer=new EditorSectionRenderer(input.baseGeometry,input.model,input.resources,documentLayoutCache());
          rendered=await renderer.render({id:'1',kind:'editor',chapter:'1',title:'Matrix native',numbering:'arabic',className:chapter.getHtmlClass(),counter:chapter.getNumber(),
            nodes:input.model.chapters.find(item=>item.id==='1').content},{runId:'table-native',signal:task.signal});
          const canonical=rendered.pages[0].projection.context;
          const resolved=(${measureContent.toString()})([{root:canonical.querySelector('.tiptap'),paper:canonical},...Array.from(canonical.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper:canonical}))],geometry);
          const resolvedTables=(${measureTableContent.toString()})(canonical,geometry);
          window.tablePDFSnapshot=await captureDocumentContexts(rendered.pages,{documentId:'fixture',title:'Table native',author:'Fixture',sourceHash:input.sourceHash,planHash:'a'.repeat(64),
            sections:[{id:'1',firstPage:1,pages:rendered.pages.length,labels:Array(rendered.pages.length).fill('')}]},input.resources,input.appearance,task.signal);
          const published=paginationKey.getState(editor.state).result;
          return {live,tables,resolved,resolvedTables,generated,pages:rendered.pages.length,geometry:geometry,
            provenance:{blocks,decisions:published?.decisions,images:live.images},
            sourceUnchanged:source===JSON.stringify(editor.getJSON()),issues:rendered.issues};
        }finally{clearTimeout(timer);rendered?.destroy();renderer?.destroy()}
      `);
      const { geometry } = input;
      entry.editorToCanonical=compareContent(input.live,input.resolved);
      entry.tableGeometry=compareTableContent(input.tables,input.resolvedTables);entry.pages=input.pages;
      entry.issues=input.issues;
      entry.provenance=input.provenance;
      save();
      for(const reason of options.requiredBreakReasons?.[variant]??[])
        assert.ok(input.provenance.decisions.some(item=>item.reasons?.includes(reason)),'Fixture did not exercise '+reason);
      assert.equal(input.sourceUnchanged,true);save();
      // Geometry travels in the fixture closure, never in the product snapshot contract.
      editorPDFTest.inspectPrint(async win=>{
        if(printed)return;
        printed=await win.webContents.executeJavaScript(`(()=>{
          const paper=document.querySelector('[data-section-context]'),geometry=${JSON.stringify(geometry)};
          return {content:(${measureContent.toString()})([{root:paper.querySelector('.tiptap'),paper},...Array.from(paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper}))],geometry),
            tables:(${measureTableContent.toString()})(paper,geometry)};
        })()`);
      });
      await execute('await window.editorPDFExperimental.export(tablePDFSnapshot,crypto.randomUUID())');
      assert.equal(await execute("return tablePDFStored===JSON.stringify(await db.chapters.get('fixture.1'))"),true,'Native export wrote chapter source');
      entry.editorToPrint=compareContent(input.live,printed.content);entry.printTables=compareTableContent(input.tables,printed.tables);
      const file=editorPDFTest.outputs.at(-1);assert.equal((await PDFDocument.load(fs.readFileSync(file))).getPageCount(),input.pages);
      entry.nativeWords=verifyPDFMarkers(file,input.live.words);
      const text=execFileSync('pdftotext',['-raw',file,'-'],{encoding:'utf8',maxBuffer:16*1024*1024});
      const characters=value=>[...compactPDFSourceText(value)].sort().join('');
      const expectedText=input.live.glyphs.map(g=>g.paintedCharacter??g.character).join('')+input.generated;
      entry.exactCharacterMultiplicity=characters(text)===characters(expectedText);
      if(!entry.exactCharacterMultiplicity){
        const counts=value=>{const result=new Map();for(const char of compactPDFSourceText(value))result.set(char,(result.get(char)??0)+1);return result};
        const expected=counts(expectedText),actual=counts(text);
        entry.characterDifferences=[...new Set([...expected.keys(),...actual.keys()])]
          .filter(char=>expected.get(char)!==actual.get(char))
          .map(char=>({char,expected:expected.get(char)??0,actual:actual.get(char)??0}));save();
      }
      assert.equal(entry.exactCharacterMultiplicity,true,variant+' '+mode+' native text multiplicity');
      const raster=nativeRaster(file,artifacts,variant+'-'+mode);
      entry.nativeBorders=nativeBorders(raster,input.tables.rules,geometry,variant+'-'+mode);
      if(variant.startsWith('image')){
        for(const image of input.live.images){
          const page=raster.get(image.page),x=Math.round(image.x+image.width/2),y=Math.round(image.y+image.height/2),offset=(y*page.width+x)*4;
          assert.ok(page.data[offset]>200&&page.data[offset+1]<50&&page.data[offset+2]<50,'Native image lost its blue content');
          assert.ok(image.height<=geometry.contentHeight+.75,'Image exceeds one content page');
        }
        entry.nativeImageSamples=input.live.images.length;
      }
      fs.copyFileSync(file,path.join(artifacts,variant+'-'+mode+'.pdf'));entry.passed=true;save();
      console.log('PASS section native:',variant,mode,input.pages,'pages');
    }
    report.rendererErrors=await execute('return window.errors');assert.deepEqual(report.rendererErrors,[]);
    report.complete=true;save();console.log('Section/PDF evidence:',artifacts);
  }catch(error){report.failure={message:error.message,stack:error.stack};save();throw error}
  finally{editorPDFTest.inspectPrint(undefined)}
};
