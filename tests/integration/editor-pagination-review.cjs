const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {prepareEquivalence,liveAndCapture,verifyPDFMarkers}=require('./editor-pdf-equivalence.cjs');
const {measureContent,compareContent}=require('./editor-pdf-geometry.cjs');
const {containsPDFSourceText}=require('./page-plan-pdf.cjs');

function reviewAudit(){
  const lists=Array.from(document.querySelectorAll('li[data-fragment-list-from][value]'),item=>{
    const paragraph=item.querySelector('p'),walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT),text=walker.nextNode(),range=document.createRange();
    range.setStart(text,0);range.setEnd(text,1);const box=range.getBoundingClientRect(),page=item.closest('.editor-page-fragment'),origin=page.getBoundingClientRect();
    return {from:Number(item.dataset.fragmentListFrom),value:Number(item.getAttribute('value')),continued:item.hasAttribute('data-fragment-list-continuation'),marker:getComputedStyle(item,'::marker').content,type:getComputedStyle(item).listStyleType,
      page:Number(page.dataset.documentPage),x:box.left-origin.left,y:box.top-origin.top};
  });
  const seams=Array.from(document.querySelectorAll('table[data-fragment-table-continuation]'),table=>({
    top:getComputedStyle(table.rows[0]).borderTopWidth,cells:Array.from(table.rows[0].cells,cell=>getComputedStyle(cell).borderTopWidth),
  }));
  const body=document.querySelector('[data-document-section="bibliography"] .csl-bib-body'),entry=body.querySelector('.csl-entry'),heading=document.querySelector('[data-document-section="bibliography"] h1');
  const b=getComputedStyle(body),e=getComputedStyle(entry),h=getComputedStyle(heading);
  const headerEdges=Array.from(document.querySelectorAll('.editor-pagination-furniture table'),table=>getComputedStyle(table.rows[table.rows.length-1]).borderBottomWidth);
  return {lists,seams,headerEdges,bibliography:{fontSize:b.fontSize,lineHeight:b.lineHeight,bodyMargin:b.marginTop,padding:e.paddingLeft,indent:e.textIndent,entryMargin:e.marginBottom,align:e.textAlign,headingSize:h.fontSize,headingMargin:h.marginBottom}};
}

exports.runReview=async context=>{
  const {execute,until,editorPDFTest,artifacts}=context;const report={};
  const save=()=>fs.writeFileSync(path.join(artifacts,'pagination-review.json'),JSON.stringify(report,null,2));
  try{
    await prepareEquivalence(context);
    await execute(`
      setPages(false);const input=editor.getJSON(),list=input.content.find(node=>node.type==='orderedList');
      list.content[0].content.push({type:'orderedList',attrs:{start:27},content:[
        {type:'listItem',content:[p('NESTED-ORDINAL-A '+sentence.repeat(16)),{type:'orderedList',attrs:{start:3},content:[{type:'listItem',content:[p('DEEP-ORDINAL '+sentence.repeat(50)),{type:'orderedList',attrs:{start:4},content:[{type:'listItem',content:[p('DEEPEST-ORDINAL short content.')]}]}]}]}]},
        {type:'listItem',content:[p('NESTED-ORDINAL-B '+sentence.repeat(5))]},
      ]});
      input.content.splice(input.content.length-1,0,{type:'paragraph',content:Array.from({length:100},(_,i)=>[
        {type:'text',text:'BR'+String(i).padStart(3,'0')+' Baris pendek.'},{type:'hardBreak'},
      ]).flat()});
      await prepareComparison(input);editor.commands.setContent(input);await waitSaved();await prepareComparison(editor.getJSON());setPages(true);
    `);
    await until("layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')");
    const {live,snapshot}=await liveAndCapture(context),active=snapshot.sections.find(section=>section.id==='1'),offset=active.firstPage-1;
    report.pages=snapshot.pages;save();let printed;
    editorPDFTest.inspectPrint(async win=>printed=await win.webContents.executeJavaScript(`({audit:(${reviewAudit.toString()})(),content:(${measureContent.toString()})(Array.from(document.querySelectorAll('[data-document-section="1"]')).map(paper=>({root:paper,paper,page:Number(paper.dataset.documentPage)})))})`));
    await execute('await window.editorPDFExperimental.export(equivalence.snapshot,crypto.randomUUID())');
    report.audit=printed.audit;save();
    report.geometry=compareContent({...live,glyphs:live.glyphs.map(g=>({...g,page:g.page+offset})),images:live.images.map(g=>({...g,page:g.page+offset}))},printed.content);save();
    assert.ok(report.audit.lists.some(item=>item.continued),'No continued list item exercised');
    assert.ok(report.audit.lists.some(item=>item.value===8&&!item.continued),'Second outer list ordinal missing');
    for(const item of report.audit.lists)if(item.continued)assert.equal(item.marker,'""','Continuation repeats its marker');
    assert.ok(report.audit.headerEdges.length>0);assert.ok(report.audit.headerEdges.every(width=>width==='1px'),'Repeated header lost its bottom edge');
    assert.ok(report.audit.seams.length>0);for(const seam of report.audit.seams){assert.equal(seam.top,'0px');assert.ok(seam.cells.every(width=>width==='0px'))}
    assert.deepEqual(report.audit.bibliography,{fontSize:'14px',lineHeight:'21px',bodyMargin:'32px',padding:'24px',indent:'-24px',entryMargin:'8px',align:'justify',headingSize:'18.6667px',headingMargin:'13.3333px'});
    const file=editorPDFTest.outputs.at(-1),text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'}).split('\f'),raw=execFileSync('pdftotext',['-raw',file,'-'],{encoding:'utf8'}).split('\f');
    for(const run of live.runs)assert.ok(containsPDFSourceText(run.text,text[run.page+offset-1],raw[run.page+offset-1]),'PDF source line changed: '+run.text);
    report.pdf={...verifyPDFMarkers(file,live.words.map(word=>({...word,page:word.page+offset}))),sourceRuns:live.runs.length};
    const bbox=execFileSync('pdftotext',['-bbox',file,'-'],{encoding:'utf8'}),pages=Array.from(bbox.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g),match=>match[1]);
    const alpha=n=>{let s='';for(;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(97+(n-1)%26)+s;return s};
    for(const item of report.audit.lists){
      const label=(item.type==='lower-alpha'?alpha(item.value):String(item.value))+(item.marker.includes(')')?')':'.');
      const words=Array.from(pages[item.page-1].matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g));
      const marker=words.some(word=>word[5]===label&&Number(word[3])<=item.x*.75+1&&Math.abs(Number(word[2])-item.y*.75)<2);
      assert.equal(marker,!item.continued,'Native list marker mismatch: '+JSON.stringify(item));
    }
    report.integrity=await execute('const before=equivalence.baseline;return {source:before.source===JSON.stringify(editor.getJSON()),stored:before.stored===JSON.stringify(await db.chapters.get("fixture.1")),history:before.history===JSON.stringify(historyDepth()),updates:before.updates===updates,errors:window.errors}');
    for(const [key,value]of Object.entries(report.integrity))if(key==='errors')assert.deepEqual(value,[]);else assert.equal(value,true,key);
    fs.copyFileSync(file,path.join(artifacts,'pagination-review.pdf'));report.passed=true;save();console.log('PASS: source list ordinals/continuation markers, hard-break justification, single table seam and legacy bibliography styling; native PDF and live geometry agree.');console.log('Review evidence:',artifacts);
  }catch(error){report.failure={message:error.message,stack:error.stack};save();throw error}
  finally{editorPDFTest.inspectPrint(undefined)}
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';process.env.HIGHTEX_EDITOR_EQUIVALENCE='1';process.env.HIGHTEX_PAGINATION_REVIEW='1';require('./editor-pagination.cjs')}
