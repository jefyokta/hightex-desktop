const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.runIndexPresentation = async ({execute,artifacts,win}) => {
  const report=await execute(`
    setPages(false);await waitSaved();
    const {DocumentIndex}=await import('/src/document-engine/indexes/document-index.tsx');
    const {outlineTitle}=await import('/src/document-engine/indexes/outline-title.ts');
    const {editorSectionOutline}=await import('/src/document-engine/renderers/editor-outline.ts');
    const {TemplateSectionRenderer}=await import('/src/document-engine/renderers/template.ts');
    const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
    await import('/src/css/document-template.css');await import('/src/css/toc.css');
    const heading=document.createElement('h1');heading.id='rich-heading';
    heading.innerHTML='Judul <strong>tebal <em>italic</em></strong> <u>garis</u> <s>coret</s> <code>kode</code> <a id="nested-link" href="#other" style="font-weight:bold;font-style:italic;text-decoration:underline">tautan</a><span data-editor-ui>CONTROL</span>';
    const source=heading.outerHTML,title=outlineTitle(heading);
    const abstract=document.createElement('div');abstract.innerHTML='<h1 id="abstract-heading">Abstract</h1>';
    const abstractEntry=editorSectionOutline({headingNumbers:new Map(),captionLabels:new Map()},{kind:'editor',id:'abstract-en',chapter:'abstract-en',title:'Abstract',className:'abstract-en',numbering:'roman',nodes:[]},abstract)[0];
    const index=new DocumentIndex();
    index.collect([abstractEntry,{id:'rich-heading',...title,group:'content',number:'1',level:1,kind:'heading'},
      {id:'long-title',text:'Long title',titleHTML:'Judul panjang '+ 'isi penelitian yang tetap terbaca '.repeat(12),group:'content',number:'1.1',level:2,kind:'heading'},
      {id:'appendix',text:'Lampiran mixed Case',titleHTML:'Lampiran <em>mixed Case</em>',group:'appendix',number:'Lampiran A',level:1,kind:'heading'}]);
    const results=[],task=new AbortController();
    window.indexPresentationSurfaces=[];
    for(const margin of [30,55]) {
      const section={id:'toc',kind:'template',numbering:'roman',title:'DAFTAR ISI',index:'toc',html:''};
      section.html=index.html(section,new Map([['abstract-heading','ix'],['rich-heading','1'],['long-title','8'],['appendix','A - 1']]));
      const renderer=new TemplateSectionRenderer(paginationGeometry({margins:{left:margin,right:margin}}),{data:async url=>url});
      const rendered=await renderer.render(section,{runId:'index-presentation',signal:task.signal});
      const paper=rendered.pages[0].element;
      if(margin===30){paper.style.cssText+=';position:absolute;left:0;top:0';document.body.append(paper);indexPresentationSurfaces.push(rendered)}
      const content=rendered.pages[0].content;
      results.push({margin,pages:rendered.pages.length,rows:Array.from(content.querySelectorAll('.toc-row'),row=>{
        const text=row.querySelector('.toc-text'),dots=row.querySelector('.toc-dots'),inner=row.querySelector('.toc-inner'),page=row.querySelector('.toc-page');
        const dot=dots.getBoundingClientRect(),box=inner.getBoundingClientRect(),number=page.getBoundingClientRect();
        return {id:row.dataset.headingId,html:text.innerHTML,weight:getComputedStyle(text).fontWeight,background:getComputedStyle(dots).backgroundImage,
          aligned:Math.abs(dot.right-box.right)<1,noOverlap:dot.right<=number.left+0.5,sameLine:dot.top<number.bottom&&dot.bottom>number.top};
      })});
      if(margin!==30)rendered.destroy();
    }
    return {title,abstract:abstractEntry.titleHTML,sourceUnchanged:source===heading.outerHTML,results};
  `);
  fs.writeFileSync(path.join(artifacts,'index-presentation.json'),JSON.stringify(report,null,2));
  await execute('window.scrollTo(0,0)');
  fs.writeFileSync(path.join(artifacts,'index-presentation.png'),(await win.webContents.capturePage()).toPNG());
  assert.equal(report.sourceUnchanged,true);
  assert.ok(!/<(?:strong|b|u|s|code|a|span)\b/.test(report.title.titleHTML));
  assert.ok(report.title.titleHTML.includes('<em>italic</em>'));
  assert.ok(report.title.titleHTML.includes('<em>tautan</em>'));
  assert.equal(report.abstract,'<em>Abstract</em>');
  for(const result of report.results)for(const row of result.rows){
    assert.equal(row.weight,'400');assert.equal(row.aligned,true,JSON.stringify(row));assert.equal(row.noOverlap,true,JSON.stringify(row));assert.equal(row.sameLine,true,JSON.stringify(row));
    assert.ok(row.background.includes(row.id==='long-title'?'0.65px':'1px'));
  }
  await execute('for(const surface of indexPresentationSurfaces)surface.destroy()');
  console.log('PASS index presentation:',artifacts);
};

exports.runLanguage = async ({execute,artifacts}) => {
  const report=await execute(`
    const {reviewRootLanguage}=await import('/tests/helpers/language-root-review.tsx');
    return await reviewRootLanguage();
  `);
  fs.writeFileSync(path.join(artifacts,'language-root.json'),JSON.stringify(report,null,2));
  assert.equal(report.listeners,1);assert.equal(report.subscriptions,1);assert.equal(report.cleanup,0);
  assert.equal(report.en,'en:Cancelen:Cancelen:Cancel');assert.equal(report.id,'id:Batalid:Batalid:Batal');assert.equal(report.rootLanguage,'id');
  console.log('PASS one root language subscription:',artifacts);
};

exports.run = async ({execute,artifacts}) => {
  const reports=await execute(`
    setPages(false);await waitSaved();
    const {TemplateSectionRenderer}=await import('/src/document-engine/renderers/template.ts');
    const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
    const {templateFlowInput}=await import('/tests/helpers/template-flow-input.tsx');
    await import('/src/css/document-template.css');await import('/src/css/toc.css');await import('/src/css/bibliography.css');
    const geometry=paginationGeometry(),task=new AbortController(),timer=setTimeout(()=>task.abort(Error('Template fixture deadline')),25000),reports=[];
    try {
      for(const variant of ['index','tall-index','bibliography','abbreviations']) {
        const section=templateFlowInput(variant);
        const before=section.html,renderer=new TemplateSectionRenderer(geometry,{data:async url=>url});let rendered;
        try {
          rendered=await renderer.render(section,{signal:task.signal,runId:'template-fixture'});
          reports.push({variant,ok:true,pages:rendered.pages.length,sourceUnchanged:before===section.html});
        } catch(error) {reports.push({variant,ok:false,message:error.message});break}
        finally {rendered?.destroy()}
      }
    } finally {clearTimeout(timer)}
    return reports;
  `);
  fs.writeFileSync(path.join(artifacts,'template-flow.json'),JSON.stringify(reports,null,2));
  console.log('Template flow:',artifacts,JSON.stringify(reports));
  for(const report of reports){assert.equal(report.ok,true,report.variant+': '+report.message);assert.equal(report.sourceUnchanged,true)}
  assert.equal(reports.length,4);
};

// Actual category sheets, including all five committee members; one bounded native export.
exports.runStaticSheets = async ({execute,artifacts,editorPDFTest,win}) => {
  const result=await execute(`
    setPages(false);await waitSaved();
    const {readExportDocument}=await import('/src/document-export/source/document-snapshot.ts');
    const {DocumentSections}=await import('/src/document-engine/adapters/current-category.tsx');
    const {DocumentEngine}=await import('/src/document-engine/index.ts');
    const {TemplateSectionRenderer}=await import('/src/document-engine/renderers/template.ts');
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const {captureDocumentContexts}=await import('/src/document-export/snapshot/capture-contexts.ts');
    const {sha256Text}=await import('/src/utils/sha256.ts');
    const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
    const {templateFlowInput}=await import('/tests/helpers/template-flow-input.tsx');
    await import('/src/css/document-template.css');
    const before={source:JSON.stringify(editor.getJSON()),stored:JSON.stringify(await db.documents.get('fixture')),history:JSON.stringify(historyDepth())};
    const task=new AbortController(),timer=setTimeout(()=>task.abort(Error('Static sheets fixture deadline')),45000);
    const resources=new DocumentResources(task.signal),geometry=paginationGeometry(),renderer=new TemplateSectionRenderer(geometry,resources);
    const input=await readExportDocument('fixture',task.signal),definitions=[],generated=[];
    const root=document.createElement('main');root.className='editor-pdf-pages';root.style.cssText='position:absolute;left:-100000px;top:0';document.body.append(root);
    let engine;
    try {
      for(const scenario of ${process.env.HIGHTEX_VALIDITY_GAP_ONLY ? "['single','double']" : "['single','double','intern','proposal']"}) {
        const data=structuredClone(input.data),model=structuredClone(input.model);
        data.title='Perancangan dan Evaluasi Sistem Informasi Pengelolaan Dokumen Akademik dengan Dukungan Kolaborasi dan Publikasi';
        data.profile={...data.profile,advisorName:'Dr. Pembimbing Pertama Penelitian Sistem Informasi, S.Kom., M.Kom.',
          secondAdvisor:scenario==='single'?undefined:{name:'Dr. Pembimbing Kedua Penelitian Sistem Informasi, S.Kom., M.Kom.',nip:'002'},
          committee:{chair:{name:'Dr. Ketua Dewan Penguji Penelitian Sistem Informasi, M.Kom.',nip:''},
            examiner1:{name:'Dr. Penguji Pertama Penelitian Sistem Informasi, S.Kom., M.Kom.',nip:''},
            examiner2:{name:'Dr. Penguji Kedua Penelitian Sistem Informasi, S.Kom., M.Kom.',nip:''}}};
        data.config={...data.config,validityDate:new Date('2026-01-02'),consentDate:new Date('2026-01-02'),statementDate:new Date('2026-01-02')};
        model.document=data;
        const parts=new DocumentSections({document:data,model,category:{id:1,name:'Fixture',variant:['intern','proposal'].includes(scenario)?scenario:'thesis',chapters:[{chapter:'1',title:'Introduction'}]}});
        try {for(const section of parts.sections.slice(0,parts.sections.findIndex(section=>section.id==='toc'))) if(section.kind==='template'${process.env.HIGHTEX_VALIDITY_GAP_ONLY ? "&&section.id==='validity'" : ""})definitions.push({...section,id:scenario+'-'+section.id})}
        finally{parts.destroy()}
      }
      engine=new DocumentEngine({template:renderer,editor:{render(){throw Error('Static sheet routed to editor')}}});
      await engine.render(root,definitions,'fixture',task.signal);
      const sheets=engine.sections.map(section=>{
        const page=root.querySelector('[data-document-section="'+section.id+'"]'),viewport=page.querySelector('.document-template-viewport'),content=page.querySelector('.document-template-content');
        const clip=viewport.getBoundingClientRect(),walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT);let node,count=0,outside=[];
        while(node=walker.nextNode())if(node.textContent.trim()){
          const range=document.createRange();range.selectNodeContents(node);
          for(const box of range.getClientRects())if(box.width&&box.height){count++;if(box.left<clip.left-1||box.right>clip.right+1||box.top<clip.top-1||box.bottom>clip.bottom+1)outside.push(node.textContent)}
        }
        const gap=content.querySelector('.validity-committee-gap');
        return {...section,text:content.textContent.replace(/\\s/g,''),count,outside,transform:content.style.transform,
          gap:gap?.getBoundingClientRect().height,
          remaining:clip.bottom-(content.querySelector('.validity-sheet')?.getBoundingClientRect().bottom??clip.bottom)};
      });
      ${process.env.HIGHTEX_VALIDITY_GAP_ONLY ? `
      const paper=root.querySelector('[data-document-section="double-validity"]');
      paper.style.cssText+=';position:fixed;left:0;top:0';document.body.append(paper);
      window.validityGapPaper=paper.cloneNode(true);validityGapPaper.style.zoom='.7';document.body.append(validityGapPaper);
      return {sheets};` : ""}
      window.staticSheetSnapshot=await captureDocumentContexts(engine.documentPages,{documentId:'fixture',title:'Static sheets',author:'Writer',sourceHash:input.sourceHash,planHash:await sha256Text(JSON.stringify(engine.identity)),sections:engine.sections},resources,'',task.signal);
      for(const variant of ['index','tall-index','bibliography','abbreviations']){
        const rendered=await renderer.render(templateFlowInput(variant),{signal:task.signal,runId:'generated-regression'});
        generated.push({variant,pages:rendered.pages.length});rendered.destroy();
      }
      return {sheets,generated,sourceUnchanged:before.source===JSON.stringify(editor.getJSON()),storedUnchanged:before.stored===JSON.stringify(await db.documents.get('fixture')),historyUnchanged:before.history===JSON.stringify(historyDepth())};
    }finally{clearTimeout(timer);engine?.destroy();root.remove()}
  `);
  fs.writeFileSync(path.join(artifacts,'static-sheets.json'),JSON.stringify(result,null,2));
  if(process.env.HIGHTEX_VALIDITY_GAP_ONLY){
    for(const sheet of result.sheets){assert.equal(sheet.pages,1,sheet.id);assert.deepEqual(sheet.outside,[],sheet.id);assert.equal(sheet.gap,28);}
    fs.writeFileSync(path.join(artifacts,'validity-gap.png'),(await win.webContents.capturePage()).toPNG());
    await execute('validityGapPaper.remove()');
    console.log('PASS validity gap:',artifacts,JSON.stringify(result.sheets.map(({id,pages,gap,remaining})=>({id,pages,gap,remaining}))));return;
  }
  assert.equal(result.sheets.length,14);
  for(const sheet of result.sheets){assert.equal(sheet.pages,1,sheet.id);assert.ok(sheet.count>0);assert.equal(sheet.transform,'',sheet.id+' must keep original text size');assert.deepEqual(sheet.outside,[],sheet.id+' clipped text')}
  for(const value of ['sourceUnchanged','storedUnchanged','historyUnchanged'])assert.equal(result[value],true,value);
  for(const entry of result.generated)assert.ok(entry.pages>1,'Generated list unexpectedly limited: '+entry.variant);
  await execute('await window.editorPDFExperimental.export(staticSheetSnapshot,crypto.randomUUID())');
  const {execFileSync}=require('node:child_process');
  const pdf=editorPDFTest.outputs.at(-1);
  const pages=execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8'}).split('\f');
  for(const sheet of result.sheets.filter(sheet=>sheet.id.endsWith('-validity'))){
    const text=pages[sheet.firstPage-1].replace(/\s/g,'');
    for(const token of ['Ketua','Sekretaris','Anggota1','Anggota2',...(sheet.id.startsWith('double-')?['Anggota3']:[]),'PengujiKedua'])assert.ok(text.includes(token),sheet.id+' missing '+token);
  }
  const validity=result.sheets.find(sheet=>sheet.id==='double-validity');
  execFileSync('pdftoppm',['-f',String(validity.firstPage),'-singlefile','-scale-to','1400','-png',pdf,path.join(artifacts,'committee-sheet')]);
  console.log('PASS static sheets:',artifacts,JSON.stringify({sheets:result.sheets.map(({id,pages,transform})=>({id,pages,transform})),generated:result.generated}));
};
