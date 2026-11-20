// Bounded Chromium check of authored captions and derived continuation content.
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const path = require('node:path');

exports.run = async ({ execute, artifacts }) => {
  const result = await execute(`
    setPages(false);await waitSaved();
    const {ReadOnlyChapter}=await import('/src/editor/chapter/read-only-chapter.ts');
    const {readDocumentSnapshot}=await import('/src/editor/storage/document-snapshot.ts');
    const {documentRenderModel}=await import('/src/editor/document/render-model.ts');
    const {measureEditor}=await import('/src/editor/pagination/measurement/measure-chapter.ts');
    const {FlowCache}=await import('/src/editor/pagination/flow/text-flow.ts');
    const {paginationGeometry,applyPageGeometry}=await import('/src/editor/pagination/options.ts');
    const {retainFirstVisualLine}=await import('/src/editor/pagination/flow/visual-line.ts');
    const {captionFlowInput}=await import('/tests/helpers/complex-table-input.ts');
    const model=await documentRenderModel(await readDocumentSnapshot('fixture'));
    const baseline=JSON.stringify(editor.getJSON());
    const reports=[];
    const task=new AbortController(),timer=setTimeout(()=>task.abort(Error('Caption fixture deadline')),25000);
    try {
      // BR and marks: the clone retains an actual line, not hidden later text.
      const line=document.createElement('div');line.style.cssText='width:180px;font:16px serif';
      line.innerHTML='<strong>Awal caption</strong><br><em>Ini harus hilang dari salinan</em>';
      document.body.append(line);retainFirstVisualLine(line);
      const compactMarkup=line.innerHTML;line.remove();
      const variants=${JSON.stringify(process.env.HIGHTEX_CAPTION_CASES?.split(',') ?? ['normal','caption','header','image','nested'])};
      const modes=${JSON.stringify(process.env.HIGHTEX_TABLE_OPTION_MATRIX ? ['both','header','caption','none'] : ['both'])};
      for(const {variant,mode} of variants.flatMap(variant=>modes.map(mode=>({variant,mode})))) {
        const geometry=paginationGeometry({repeatTableHeader:mode==='both'||mode==='header',repeatTableCaption:mode==='both'||mode==='caption'});
        const contents=captionFlowInput(variant);
        const source=editor.state.schema.nodeFromJSON({type:'doc',content:contents});
        const original=JSON.stringify(source.toJSON());
        const paper=document.createElement('div');paper.className='page';paper.dataset.paginationSurface='';
        paper.style.cssText='position:absolute;left:-100000px;top:0';applyPageGeometry(paper,geometry);document.body.append(paper);
        let chapter;
        try {
          const tallImage='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="2000"><rect width="100" height="2000" fill="blue"/></svg>');
          chapter=new ReadOnlyChapter(paper,source,model,undefined,{url:key=>key==='tall-fixture-image'?tallImage:undefined});
          await chapter.waitForImages(task.signal);await document.fonts.ready;
          const cache=new FlowCache();let prior='',stable=false,plan;
          for(let pass=0;pass<4;pass++) {
            plan=await measureEditor(chapter.view,cache,task.signal,geometry);chapter.applyLayout(source,plan);
            const signature=JSON.stringify(plan);if(signature===prior){stable=true;break}prior=signature;
          }
          const origin=paper.getBoundingClientRect(),bad=[];
          for(const root of [chapter.view.dom,...paper.querySelectorAll('.editor-pagination-furniture')]) {
            const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let text;
            while(text=walker.nextNode()) {
              if(text.parentElement.closest('[data-editor-page-break],.katex-mathml'))continue;
              const range=document.createRange();range.selectNodeContents(text);
              for(const rect of range.getClientRects()) {
                if(!rect.width||!rect.height)continue;
                const y=rect.top-origin.top-geometry.margins.top,page=Math.floor(y/geometry.stride);
                if(y<page*geometry.stride-1||rect.bottom-origin.top-geometry.margins.top>page*geometry.stride+geometry.contentHeight+1)
                  bad.push({text:text.textContent.slice(0,40),y,bottom:rect.bottom-origin.top});
              }
            }
          }
          const repeatLineCounts=[];
          for(const repeat of paper.querySelectorAll('.editor-pagination-furniture')) {
            const table=repeat.querySelector('table');
            for(const row of table?.rows??[])for(const cell of row.cells) {
              const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT),tops=[];let text;
              while(text=walker.nextNode()) {
                const range=document.createRange();range.selectNodeContents(text);
                for(const rect of range.getClientRects())if(rect.width&&rect.height&&!tops.some(y=>Math.abs(y-rect.top)<1))tops.push(rect.top);
              }
              repeatLineCounts.push(tops.length);
            }
          }
          const imageHeight=chapter.view.dom.querySelector('img')?.getBoundingClientRect().height;
          reports.push({variant,mode,stable,pages:plan.pages,issues:plan.issues??[],bad:bad.slice(0,10),repeatLineCounts,
            repeatPolicy:(plan.furniture??[]).every(item=>{
              const parsed=new DOMParser().parseFromString(item.html,'text/html');
              return (mode!=='none')&&((mode==='header'||mode==='none')?!parsed.querySelector('figcaption'):true)
                &&((mode==='caption'||mode==='none')?!parsed.querySelector('table'):true);
            })&&(mode!=='none'||!plan.furniture?.length),
            imageFits:imageHeight===undefined||imageHeight<=geometry.contentHeight+1,
            sourceUnchanged:JSON.stringify(source.toJSON())===original,
            contentPreserved:chapter.view.dom.textContent.replaceAll('\\u2060','')===source.textContent,
            repeats:(plan.furniture??[]).map(item=>item.html.length),portable:!!structuredClone(plan)});
        } finally {chapter?.destroy();paper.remove()}
      }
      return {reports,compactMarkup,editorUnchanged:baseline===JSON.stringify(editor.getJSON())};
    } finally {clearTimeout(timer)}
  `);
  writeFileSync(path.join(artifacts,'caption-flow.json'),JSON.stringify(result,null,2));
  console.log('Caption flow evidence:',artifacts,JSON.stringify(result));
  assert.equal(result.editorUnchanged,true);
  assert.equal(result.compactMarkup,'<strong>Awal caption</strong>');
  for(const report of result.reports) {
    assert.equal(report.stable,true,report.variant+' convergence');
    assert.equal(report.sourceUnchanged,true);assert.equal(report.contentPreserved,true);
    assert.deepEqual(report.bad,[],report.variant+' glyph placement');
    assert.equal(report.portable,true);
    assert.equal(report.repeatPolicy,true,report.variant+' '+report.mode+' repeat options');
    assert.equal(report.imageFits,true);
    if(['normal','caption','header','image','nested'].includes(report.variant))
      assert.equal(report.repeatLineCounts.every(count=>count===1),true,report.variant+' first visual header line');
    if(['header','caption','nested'].includes(report.variant))assert.equal(report.issues[0]?.kind,'table');
    if(report.variant==='normal'){assert.deepEqual(report.issues,[]);assert.ok(report.repeats.length>0)}
  }
};
