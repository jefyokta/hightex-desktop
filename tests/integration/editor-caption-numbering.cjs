const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");

exports.runCaptions = async ({ execute, win, artifacts }) => {
  const result = await execute(`
    const {Chapter}=await import('/src/editor/chapter/chapter.ts');
    const {Document}=await import('/src/editor/document/index.ts');
    const {FigureNumberPlugin}=await import('/src/editor/plugins/figure-number.ts');
    const {chapterSnapshotSource}=await import('/src/editor/chapter/snapshot-source.ts');
    const {ReadOnlyChapter}=await import('/src/editor/chapter/read-only-chapter.ts');
    const {readDocumentSnapshot}=await import('/src/editor/storage/document-snapshot.ts');
    const {documentRenderModel}=await import('/src/editor/document/render-model.ts');
    const {measureEditor}=await import('/src/editor/pagination/measurement/measure-chapter.ts');
    const {FlowCache}=await import('/src/editor/pagination/flow/text-flow.ts');
    const {paginationDecorations}=await import('/src/editor/pagination/presentation/decorations.ts');
    const {PageFragments}=await import('/tests/helpers/legacy-pagination/fragments.ts');
    const {applyPageGeometry,paginationGeometry}=await import('/src/editor/pagination/options.ts');
    const {waitForContentFonts}=await import('/src/document-engine/resources/fonts.ts');
    const geometry=paginationGeometry(),base=await documentRenderModel(await readDocumentSnapshot('fixture'));
    const sourceBefore=JSON.stringify(editor.getJSON()),storedBefore=JSON.stringify(await db.chapters.toArray());
    window.captionProof=document.createElement('main');captionProof.id='caption-proof';document.body.append(captionProof);
    window.captionProofRuns=[];
    const heading=id=>({type:'heading',attrs:{id,level:1},content:[{type:'text',text:id}]});
    const table=(id,rows)=>{const node=makeTable(rows);node.attrs={id,figureId:id+'-figure'};return node};
    const cases=[{name:'4',nodes:[heading('Chapter-four'),table('table-first',45),table('table-second',2)],expected:['Tabel 4.1','Tabel 4.2']},
      {name:'attachment',nodes:[heading('Appendix-A'),table('table-a',45),heading('Appendix-B'),table('table-b',45)],expected:['Tabel A.1','Tabel B.2']}];
    const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Caption verification deadline')),30000);
    const audit=[];
    const captions=root=>Array.from(root.querySelectorAll('figcaption'),node=>({label:node.dataset.label,before:getComputedStyle(node,'::before').content,continued:node.classList.contains('editor-pagination-repeat-caption')}));
    try{
      for(const entry of cases){
        const source=chapterSnapshotSource(editor.schema,entry.nodes,entry.name);
        const model={...base,chapters:[{id:entry.name,content:source.toJSON().content}]};
        const paper=document.createElement('div');paper.className='page '+(entry.name==='attachment'?'attachment-chapter':'ch');
        paper.dataset.paginationSurface='';paper.style.cssText='position:absolute;left:2400px;top:0';
        paper.style.setProperty('--start-counter',entry.name==='4'?'3':'0');applyPageGeometry(paper,geometry);
        const mount=document.createElement('div');paper.append(mount);document.body.append(paper);
        const previous=Chapter.instance;
        let view,readonly,fragments;
        try{
          Chapter.instance=new Chapter({documentId:'fixture',document:Document.instance,chapter:entry.name,isolated:true});
          view=new nativeEditor.EditorView(mount,{state:nativeEditor.EditorState.create({doc:source,plugins:[FigureNumberPlugin]}),editable:()=>false,attributes:{class:'tiptap','data-editor-pagination':'true'}});
          Chapter.instance=previous;
          await waitForContentFonts(view.dom,task.signal);await document.fonts.ready;
          const layout=await measureEditor(view,new FlowCache(),task.signal,geometry);
          view.setProps({decorations:()=>paginationDecorations(source,layout)});
          const live=captions(view.dom);
          const readPaper=paper.cloneNode(false);document.body.append(readPaper);
          try{
            readonly=new ReadOnlyChapter(readPaper,source,model,undefined,undefined,(await import('/tests/helpers/captured-chapter-node-views.ts')).capturedChapterNodeViews(source,view,document));readonly.applyLayout(source,layout);
            const projected=captions(readonly.view.dom);
            const section=document.createElement('section');captionProof.append(section);
            fragments=new PageFragments(readonly,geometry);await fragments.render(section,task.signal,false);
            const pages=fragments.pages.map(page=>captions(page.element));
            audit.push({name:entry.name,expected:entry.expected,live,projected,pages});
            captionProofRuns.push(fragments);fragments=undefined;
          }finally{readonly?.destroy();readPaper.remove()}
        }finally{Chapter.instance=previous;fragments?.destroy();view?.destroy();paper.remove()}
      }
      const probe=document.createElement('div');probe.className='page attachment-chapter';
      probe.innerHTML='<div class="tiptap"><figure data-type="imageFigure"><figcaption data-label="Gambar B.3">Image</figcaption></figure></div>';
      document.body.append(probe);const appendixImage=captions(probe)[0];probe.remove();
      const style=document.createElement('style');style.id='caption-proof-print-style';
      style.textContent='@page{size:210mm 297mm;margin:0}@media print{html,body{margin:0!important;padding:0!important}body>:not(#caption-proof){display:none!important}#caption-proof{display:block!important}.editor-page-fragment{margin:0!important;box-shadow:none!important;break-after:page!important}#caption-proof>:last-child>.editor-page-fragment:last-child{break-after:auto!important}}';document.head.append(style);
      return {audit,appendixImage,sourceUnchanged:sourceBefore===JSON.stringify(editor.getJSON()),storageUnchanged:storedBefore===JSON.stringify(await db.chapters.toArray())};
    }finally{clearTimeout(timer)}
  `);
  fs.writeFileSync(
    path.join(artifacts, "caption-numbering.json"),
    JSON.stringify(result, null, 2),
  );
  try {
    for (const entry of result.audit) {
      assert.deepEqual(
        entry.live.map((caption) => caption.label),
        entry.expected,
      );
      assert.deepEqual(
        entry.projected.map((caption) => caption.label),
        entry.expected,
      );
      assert.ok(
        entry.pages.flat().some((caption) => caption.continued),
        "Expected a repeated caption",
      );
      for (const caption of [
        ...entry.live,
        ...entry.projected,
        ...entry.pages.flat(),
      ]) {
        assert.ok(entry.expected.includes(caption.label));
        assert.ok(
          caption.before.includes(caption.label),
          "CSS counter replaced the JS label: " + JSON.stringify(caption),
        );
      }
    }
    assert.ok(result.appendixImage.before.includes("Gambar B.3"));
    assert.equal(result.sourceUnchanged, true);
    assert.equal(result.storageUnchanged, true);
    const output = path.join(artifacts, "caption-numbering.pdf");
    fs.writeFileSync(
      output,
      await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      }),
    );
    const pdf = await PDFDocument.load(fs.readFileSync(output));
    const expected = result.audit.flatMap((entry) => entry.pages);
    assert.equal(pdf.getPageCount(), expected.length);
    const pages = execFileSync("pdftotext", ["-layout", output, "-"], {
      encoding: "utf8",
    }).split("\f");
    for (const [index, captions] of expected.entries())
      for (const caption of captions)
        assert.ok(
          pages[index].includes(caption.label),
          "Native PDF changed caption on page " + (index + 1),
        );
    console.log(
      "PASS: JS caption labels match live editor, read-only projection, continued headers and native PDF across chapter 4 and appendices A/B; appendix image CSS uses its JS label; source/storage unchanged.",
    );
    console.log("Caption evidence:", artifacts);
  } finally {
    await execute(
      "for(const fragments of captionProofRuns)fragments.destroy();captionProof.remove();document.getElementById('caption-proof-print-style')?.remove()",
    );
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_CAPTIONS = "1";
  require("./editor-pagination.cjs");
}
