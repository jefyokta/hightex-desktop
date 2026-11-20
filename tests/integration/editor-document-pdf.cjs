const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");

exports.run = async ({
  execute,
  until,
  folder,
  metrics,
  outputs,
  setDialogMode,
}) => {
  await execute(`
    const {getEditorChapter}=await import('/src/editor/event/index.ts');
    const {invalidateWorkspaceAuthorProfile}=await import('/src/utils/document-profile.ts');
    window.fullContext=getEditorChapter(editor).document;window.fullCategory=fullContext.category;
    fullContext.category={...fullCategory,variant:${JSON.stringify(process.env.HIGHTEX_EDITOR_PDF_VARIANT || "thesis")},chapters:[{chapter:'2',title:'Second chapter first'},{chapter:'1',title:'Introduction'}]};
    window.fullProfileGet=window.profile.get;
    window.profile.get=async()=>({...await fullProfileGet(),cv:'<p>CV-END-PROOF academic history.</p>',
      ${process.env.HIGHTEX_EDITOR_PDF_LONG_CV ? `cv:Array.from({length:20},(_,index)=>'<p>CV-LONG-'+index+' '+sentence.repeat(5)+'</p>').join('')+'<p>CV-END-PROOF academic history.</p>',` : ""}
      ${process.env.HIGHTEX_EDITOR_PDF_SIGNATURES ? `advisorName:'Dr. Pembimbing Pertama Penelitian Sistem Informasi, S.Kom., M.Kom.',secondAdvisor:{name:'Dr. Pembimbing Kedua Penelitian Sistem Informasi, S.Kom., M.Kom.',nip:'002'},committee:{chair:{name:'Dr. Ketua Dewan Penguji Penelitian Sistem Informasi, M.Kom.',nip:''},examiner1:{name:'Dr. Penguji Pertama Penelitian Sistem Informasi, S.Kom., M.Kom.',nip:''},examiner2:{name:'Dr. Penguji Kedua Penelitian Sistem Informasi, S.Kom., M.Kom.',nip:''}},` : ""}
    });invalidateWorkspaceAuthorProfile();
    const heading=(id,text,level=1)=>({type:'heading',attrs:{id,level},content:[{type:'text',text}]});
    await db.cite.put({key:'full-document-cite',bib:'@book{full-document-cite,title={Full document citation proof},author={Aria Writer},year={2025}}'});
    await db.chapters.put({id:'fixture.2',content:[heading('full-second','Second chapter first'),p('SECOND-CHAPTER-UNIQUE '+sentence.repeat(16)),
      heading(undefined,'A second-chapter section',2),
      {type:'paragraph',content:[{type:'text',text:'CITATION-AND-MATH '},{type:'cite',attrs:{cite:'full-document-cite'}},{type:'text',text:' '},{type:'mathInline',attrs:{latex:'x+1'}},{type:'variable',attrs:{name:'title'}}]},
      {type:'paragraph',content:[{type:'text',text:'Cross-chapter table: '},{type:'refComponent',attrs:{ref:'figureTable',link:'shared-table'}}]},
      ${process.env.HIGHTEX_EDITOR_PDF_MISSING_REFERENCES ? `{type:'paragraph',content:[{type:'text',text:'MISSING-REFERENCE-PROOF '},{type:'refComponent',attrs:{ref:'figureTable',link:'deleted-table-target'}}]},` : ""}
      {type:'paragraph',content:[{type:'text',text:'ANNOTATED-TEXT-PROOF',marks:[{type:'note',attrs:{id:'full-note',note:'Native note proof',created:'2025-01-01T00:00:00Z'}}]},{type:'dots'},{type:'hardBreak'},{type:'text',text:'Formatted proof',marks:[{type:'bold'},{type:'italic'},{type:'underline'}]}]},
      {type:'codeBlock',attrs:{language:'javascript'},content:[{type:'text',text:'const fullDocument = true;'}]},
      {type:'blockMath',attrs:{latex:'x=1'}},
    ]});
    ${process.env.HIGHTEX_EDITOR_PDF_MANY_HEADINGS ? `const many=await db.chapters.get('fixture.2');for(let index=0;index<60;index++)many.content.push(heading('many-heading-'+index,'Index section '+index,2),p('Index body '+index));await db.chapters.put(many);` : ""}
    ${
      process.env.HIGHTEX_EDITOR_PDF_NESTED
        ? `
      const nested=makeTable(4);nested.attrs={id:'nested-outer',figureId:'nested-outer-figure'};
      const inner=makeTable(8);inner.attrs={id:'nested-inner',figureId:'nested-inner-figure'};
      for(const [index,row] of inner.content[1].content.entries()) for(const [column,cell] of row.content.entries()) cell.content=[p('NESTED-'+index+'-'+column+' '+sentence.repeat(index ? 5 : 1))];
      nested.content[1].content[1].content[0].content.push(inner);
      const second=await db.chapters.get('fixture.2');second.content.push(nested);await db.chapters.put(second);
    `
        : ""
    }
    window.fullForeword=await db.chapters.get('fixture.foreword');
    await db.chapters.put({id:'fixture.foreword',content:[heading('full-foreword','KATA PENGANTAR'),...Array.from({length:8},(_,index)=>p('STATIC-BODY-PROOF-'+index+' '+sentence.repeat(5)))]});
    window.fullAttachment=await db.chapters.get('fixture.attachment');
    await db.chapters.put({id:'fixture.attachment',content:[heading('full-appendix-a','Appendix source A'),p('APPENDIX-A-PROOF'),heading('full-appendix-b','Appendix source B'),p('APPENDIX-B-PROOF')]});
    await db.aliases.put({key:'fixture.API',value:'Application Programming Interface',documentId:'fixture'});
    window.fullBefore={source:JSON.stringify(editor.getJSON()),selection:editor.state.selection.toJSON(),history:historyDepth(),updates,stored:JSON.stringify(await db.chapters.get('fixture.1'))};
  `);
  try {
    const snapshot =
      await execute(`const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
      window.engineTrace=[];window.templateStyles=[];
      window.documentSnapshot=await captureDocumentPDF(editor,new AbortController().signal,engine=>{
        for(const type of ['start','section.before','section.after','chapter','contentRendered','index.pass','diagnostic','rendered','cancel','error','dispose'])engine.events.on(type,event=>{
          engineTrace.push({type,runId:event.runId,sequence:event.sequence,phase:event.phase,chapterId:event.chapterId,changed:event.changed,stable:event.stable,sectionId:event.sectionId,kind:event.section?.kind??event.sectionKind,pass:event.pass,pages:event.pages,stage:event.stage,level:event.error?.level,code:event.error?.code});
          if(type==='rendered')templateStyles=Array.from(document.querySelector('.editor-pdf-pages').querySelectorAll('.document-template-content table'),table=>({layout:getComputedStyle(table).tableLayout,border:getComputedStyle(table).borderBottomWidth,rowBorder:getComputedStyle(table.querySelector('tr')).borderTopWidth,cellPadding:getComputedStyle(table.querySelector('td,th')).paddingLeft,editor:!!table.closest('.tiptap')}));
        });
      });return documentSnapshot`);
    if (process.env.HIGHTEX_EDITOR_PDF_VERIFY)
      return await require("./editor-document-verify.cjs").run({
        execute,
        until,
        folder,
        metrics,
        outputs,
        snapshot,
      });
    await execute(`window.captureChapterGlyphs=async html=>{
      const frame=document.createElement('iframe');frame.style.cssText='position:absolute;left:-10000px;width:210mm;height:297mm';
      try {
        const loaded=new Promise(resolve=>frame.onload=resolve);frame.srcdoc=html;document.body.append(frame);await loaded;
        const doc=frame.contentDocument;await doc.fonts.ready;await Promise.all(Array.from(doc.images,image=>image.decode()));
        window.fullFigureAlignment=Array.from(doc.querySelectorAll('.tiptap figure[data-type="imageFigure"] img'),image=>{
          const figure=image.closest('figure').getBoundingClientRect(),box=image.getBoundingClientRect();
          return {offset:Math.abs((figure.left+figure.right-box.left-box.right)/2),imageWidth:box.width,figureWidth:figure.width};
        });
        for(const image of fullFigureAlignment)if(image.offset>0.75)throw Error('Figure image is not horizontally centered: '+JSON.stringify(image));
        for(const row of doc.querySelectorAll('[data-document-section="toc"] .toc-row')) {
          const number=row.querySelector('.toc-number'),title=row.querySelector('.toc-inner');
          if(number&&number.getBoundingClientRect().right>title.getBoundingClientRect().left+0.75)throw Error('TOC number overlaps its heading');
        }
        const glyphs=[];
        for(const [pageIndex,page] of Array.from(doc.querySelectorAll('[data-document-section="2"]')).entries()) {
          const origin=page.getBoundingClientRect();
          for(const block of page.querySelectorAll('p,pre')) {
            const walker=doc.createTreeWalker(block,NodeFilter.SHOW_TEXT);let text;
            while(text=walker.nextNode()){
              if(text.parentElement.closest('.katex-mathml'))continue;
              const range=doc.createRange();let offset=0;
              for(const character of text.textContent) {
                if(character.trim()){range.setStart(text,offset);range.setEnd(text,offset+character.length);const box=range.getBoundingClientRect();if(box.width&&box.height)glyphs.push({character,page:pageIndex,left:box.left-origin.left,top:box.top-origin.top,width:box.width,height:box.height})}
                offset+=character.length;
              }
            }
          }
        }
        window.fullGlyphMetrics??=[];
        fullGlyphMetrics.push(Array.from(doc.querySelectorAll('[data-document-section="2"] table'),table=>{
          const p=table.querySelector('p'),cell=p?.closest('td,th'),caption=table.closest('figure')?.querySelector('figcaption'),page=table.closest('.page'),top=page.getBoundingClientRect().top;
          const info=element=>{if(!element)return null;const style=doc.defaultView.getComputedStyle(element),box=element.getBoundingClientRect();return {top:box.top-top,height:box.height,font:style.font,line:style.lineHeight,padding:style.padding,margin:style.margin,space:style.whiteSpace}};
          return {table:info(table),p:info(p),cell:info(cell),caption:info(caption)};
        }));
        return glyphs;
      } finally {frame.remove()}
    };window.fullBeforeGlyphs=await captureChapterGlyphs(documentSnapshot.html)`);
    const engineAudit = await execute(
      "return {trace:engineTrace,templates:templateStyles,imageAlignment:fullFigureAlignment}",
    );
    assert.ok(engineAudit.trace.some((event) => event.type === "rendered"));
    assert.equal(
      new Set(engineAudit.trace.map((event) => event.runId)).size,
      1,
    );
    assert.ok(engineAudit.imageAlignment.length > 0);
    if (process.env.HIGHTEX_EDITOR_PDF_MISSING_REFERENCES) {
      assert.equal(
        engineAudit.trace.filter(
          (event) =>
            event.type === "diagnostic" &&
            event.level === "warning" &&
            event.code === "reference.missing",
        ).length,
        1,
      );
      assert.ok(
        snapshot.html.includes("MISSING-REFERENCE-PROOF") &&
          snapshot.html.includes("Tabel ?"),
      );
      assert.equal(
        snapshot.html.includes('href="#deleted-table-target"'),
        false,
      );
    }
    for (const style of engineAudit.templates)
      assert.deepEqual(style, {
        layout: "auto",
        border: "0px",
        rowBorder: "0px",
        cellPadding: "0px",
        editor: false,
      });
    fs.writeFileSync(
      path.join(folder, "document-engine.json"),
      JSON.stringify(engineAudit, null, 2),
    );
    assert.equal(snapshot.version, 3);
    assert.ok(snapshot.pages > 12);
    if (process.env.HIGHTEX_EDITOR_PDF_MANY_HEADINGS)
      assert.ok(
        snapshot.sections.find((section) => section.id === "toc").pages > 1,
        "TOC fixture must span pages",
      );
    assert.ok(
      snapshot.sections.find((section) => section.id === "foreword").pages > 1,
    );
    assert.ok(
      snapshot.sections.findIndex((section) => section.id === "2") <
        snapshot.sections.findIndex((section) => section.id === "1"),
    );
    assert.equal(snapshot.sections[0].id, "cover");
    assert.equal(snapshot.sections.at(-1).id, "cv");
    assert.ok(
      snapshot.sections
        .find((section) => section.id === "attachment")
        .labels.includes("B - 1"),
    );
    assert.ok(!snapshot.html.includes("blob:"));
    fs.writeFileSync(
      path.join(folder, "full-document-captured.html"),
      snapshot.html,
    );
    fs.writeFileSync(
      path.join(folder, "full-document-snapshot.json"),
      JSON.stringify(
        { ...snapshot, html: undefined, presentation: undefined },
        null,
        2,
      ),
    );
    await execute(
      `window.fullExport=await window.editorPDFExperimental.export(documentSnapshot,crypto.randomUUID())`,
    );
    const bytes = fs.readFileSync(outputs.at(-1));
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), snapshot.pages);
    const text = execFileSync("pdftotext", ["-layout", outputs.at(-1), "-"], {
      encoding: "utf8",
    });
    for (const token of [
      "SECOND-CHAPTER-UNIQUE",
      "STATIC-BODY-PROOF-7",
      "APPENDIX-A-PROOF",
      "APPENDIX-B-PROOF",
      "CV-END-PROOF",
      "Full document citation proof",
      "Application Programming Interface",
    ])
      assert.ok(
        text.includes(token),
        "Missing full document content: " + token,
      );
    if (process.env.HIGHTEX_EDITOR_PDF_SIGNATURES) {
      const compact = text.replace(/\s/g, "");
      for (const role of [
        "Ketua",
        "Sekretaris",
        "Anggota1",
        "Anggota2",
        "Anggota3",
      ])
        assert.ok(compact.includes(role), "Missing signature role " + role);
      const signatures = await execute(`
        const parsed=new DOMParser().parseFromString(documentSnapshot.html,'text/html');
        const pages=Array.from(parsed.querySelectorAll('[data-document-section="validity"]'));
        return {pages:pages.length,scaled:pages.some(page=>page.querySelector('.editor-pagination-scaled')),markers:pages.some(page=>page.querySelector('.page-break')),editor:pages.some(page=>page.querySelector('.tiptap')),kind:pages.every(page=>page.dataset.sectionRenderer==='template')};
      `);
      assert.equal(signatures.pages, 1, "Committee sheet must stay on one page");
      assert.equal(
        signatures.editor,
        false,
        "Templates must not be rendered as editor content",
      );
      assert.equal(signatures.kind, true);
      assert.equal(
        signatures.scaled,
        false,
        "Signature text must keep its native size",
      );
      assert.equal(
        signatures.markers,
        false,
        "Legacy page markers must not impose editor placeholder dimensions",
      );
      fs.writeFileSync(
        path.join(folder, "signature-flow.json"),
        JSON.stringify(signatures, null, 2),
      );
    }
    if (process.env.HIGHTEX_EDITOR_PDF_LONG_CV) {
      assert.ok(
        snapshot.sections.find((section) => section.id === "cv").pages > 1,
      );
      for (let index = 0; index < 20; index++)
        assert.ok(
          text.includes("CV-LONG-" + index),
          "Missing CV paragraph " + index,
        );
    }
    const native = await execute(`
      const parsed=new DOMParser().parseFromString(documentSnapshot.html,'text/html');
      const ids=Array.from(parsed.querySelectorAll('[id]'),node=>node.id);
      const links=Array.from(parsed.querySelectorAll('a[href^="#"]'),node=>decodeURIComponent(node.getAttribute('href').slice(1)));
      const toc=Array.from(parsed.querySelectorAll('[data-document-section="toc"] .toc-row'),row=>({target:row.querySelector('a')?.dataset.headingId??row.dataset.headingId,page:row.querySelector('.toc-page').textContent}));
      return {unique:new Set(ids).size===ids.length,links:links.every(id=>ids.includes(id)),toc,tables:parsed.querySelectorAll('[data-document-section="tot"] .toc-row').length,figures:parsed.querySelectorAll('[data-document-section="tof"] .toc-row').length};
    `);
    assert.equal(native.unique, true);
    assert.equal(native.links, true);
    assert.ok(native.toc.length > 8 && native.toc.every((row) => row.page));
    assert.ok(native.tables > 0 && native.figures > 0);
    if (!process.env.HIGHTEX_EDITOR_PDF_NESTED) {
      const frozen = await execute(`
        const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
        const {abortable}=await import('/src/utils/abortable.ts');
        const {Storage}=await import('/src/editor/storage/index.ts');
        const state=editor.state,stored=await db.chapters.get('fixture.1'),count=updates;
        let entered,release;
        const ready=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
        try {
          const pending=captureDocumentPDF(editor,new AbortController().signal,engine=>engine.events.once('start',async({signal})=>{entered();await abortable(gate,signal)}));await ready;
          editor.commands.insertContentAt(editor.state.doc.content.size-1,'LATE-LIVE-EDIT-PROOF');
          await Storage.instance.waitForDocument('fixture');
          const selection=JSON.stringify(editor.state.selection.toJSON()),history=JSON.stringify(historyDepth());
          release();const result=await pending;
          return {liveEdited:editor.state.doc.textContent.includes('LATE-LIVE-EDIT-PROOF'),frozen:!result.html.includes('LATE-LIVE-EDIT-PROOF'),pages:result.pages===documentSnapshot.pages,editable:editor.isEditable,selection:JSON.stringify(editor.state.selection.toJSON())===selection,history:JSON.stringify(historyDepth())===history,stored:JSON.stringify(await db.chapters.get('fixture.1')).includes('LATE-LIVE-EDIT-PROOF')};
        } finally {await Storage.instance.waitForDocument('fixture');editor.view.updateState(state);await db.chapters.put(stored);window.updates=count}
      `);
      assert.deepEqual(frozen, {
        liveEdited: true,
        frozen: true,
        pages: true,
        editable: true,
        selection: true,
        history: true,
        stored: true,
      });
      const reading = await execute(`
        const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
        const {Storage}=await import('/src/editor/storage/index.ts');
        const original=db.transaction,state=editor.state,stored=await db.chapters.get('fixture.1'),count=updates;
        let entered,release;
        const ready=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
        db.transaction=function(mode,...args){
          const pending=original.call(this,mode,...args);
          // Hold delivery of the actual committed snapshot; the IDB transaction
          // itself is complete, so subsequent autosaves must remain possible.
          return mode==='r'&&Array.isArray(args[0])&&args[0].includes(db.images)
            ? pending.then(async value=>{entered();await gate;return value}) : pending;
        };
        try {
          const pending=captureDocumentPDF(editor,new AbortController().signal).then(()=>undefined,error=>error);
          await ready;
          editor.commands.insertContentAt(editor.state.doc.content.size-1,'EDIT-DURING-PDF-READ');
          await Storage.instance.waitForDocument('fixture');
          const selection=JSON.stringify(editor.state.selection.toJSON()),history=JSON.stringify(historyDepth());
          release();const error=await pending;
          return {staleCaptureRejected:Boolean(error?.message.includes('changed')),liveEdited:editor.state.doc.textContent.includes('EDIT-DURING-PDF-READ'),editable:editor.isEditable,selection:JSON.stringify(editor.state.selection.toJSON())===selection,history:JSON.stringify(historyDepth())===history,stored:JSON.stringify(await db.chapters.get('fixture.1')).includes('EDIT-DURING-PDF-READ')};
        } finally {release?.();db.transaction=original;await Storage.instance.waitForDocument('fixture');editor.view.updateState(state);await db.chapters.put(stored);window.updates=count}
      `);
      assert.deepEqual(reading, {
        staleCaptureRejected: true,
        liveEdited: true,
        editable: true,
        selection: true,
        history: true,
        stored: true,
      });
      fs.writeFileSync(
        path.join(folder, "editing-isolation.json"),
        JSON.stringify({ frozen, reading }, null, 2),
      );
      const cancellation = await execute(`
        const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
        const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
        const styles=DocumentResources.prototype.styles,task=new AbortController();
        const before=document.querySelectorAll('[data-pagination-surface],.editor-pdf-pages').length;
        let entered;const started=new Promise(resolve=>entered=resolve);
        DocumentResources.prototype.styles=async function(){entered();return new Promise((_resolve,reject)=>task.signal.addEventListener('abort',()=>reject(task.signal.reason),{once:true}))};
        try {
          const pending=captureDocumentPDF(editor,task.signal);await started;task.abort();
          let aborted=false;try{await pending}catch(error){aborted=error.name==='AbortError'}
          return {aborted,clean:document.querySelectorAll('[data-pagination-surface],.editor-pdf-pages').length===before};
        } finally {DocumentResources.prototype.styles=styles}
      `);
      assert.deepEqual(cancellation, { aborted: true, clean: true });
      const parallel = await execute(`
        const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
        const runs=[];
        const [first,second]=await Promise.all([1,2].map(()=>captureDocumentPDF(fullContext,new AbortController().signal,engine=>engine.events.once('start',event=>{runs.push(event.runId)}))));
        return {isolated:new Set(runs).size===2,equal:first.html===second.html&&first.planHash===second.planHash};
      `);
      assert.deepEqual(parallel, { isolated: true, equal: true });
      const noEditor = await execute(
        `const {captureDocumentPDF}=await import('/src/document-export/capture.ts');const result=await captureDocumentPDF(fullContext,new AbortController().signal);return {version:result.version,sections:result.sections.map(section=>section.id),text:result.html.includes('CV-END-PROOF')}`,
      );
      assert.equal(noEditor.version, 3);
      assert.equal(noEditor.text, true);
      assert.deepEqual(
        noEditor.sections,
        snapshot.sections.map((section) => section.id),
      );
    }
    const beforeUI = outputs.length;
    await execute(`document.querySelector('[data-editor-pdf-export]').click()`);
    await until(`!document.querySelector('[data-editor-pdf-export]').disabled`);
    assert.equal(
      await execute(
        `return document.querySelector('[data-editor-pdf-error]')?.textContent`,
      ),
      undefined,
    );
    if (process.env.HIGHTEX_EDITOR_PDF_MISSING_REFERENCES)
      assert.ok(
        await execute(
          `return Boolean(document.querySelector('[data-editor-pdf-warning]')?.textContent)`,
        ),
      );
    assert.equal(outputs.length, beforeUI + 1);
    assert.equal(
      (await PDFDocument.load(fs.readFileSync(outputs.at(-1)))).getPageCount(),
      snapshot.pages,
    );
    assert.equal(
      await execute(
        `return Boolean(document.querySelector('[data-editor-pdf-frame], [role=dialog]'))`,
      ),
      false,
    );
    await until(`layoutReady()`);
    if (!process.env.HIGHTEX_EDITOR_PDF_NESTED) {
      const beforeSaveCancel = outputs.length;
      setDialogMode("cancel");
      try {
        await execute(
          `document.querySelector('[data-editor-pdf-export]').click()`,
        );
        await until(
          `!document.querySelector('[data-editor-pdf-export]').disabled`,
        );
        assert.equal(outputs.length, beforeSaveCancel);
        assert.equal(
          await execute(
            `return document.querySelector('[data-editor-pdf-error]')?.textContent`,
          ),
          undefined,
        );
      } finally {
        setDialogMode("save");
      }
      const cancelledUI = await execute(`
        const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
        const original=DocumentResources.prototype.styles;
        const before=document.querySelectorAll('[data-pagination-surface],.editor-pdf-pages').length;
        window.uiCapturePending=false;
        DocumentResources.prototype.styles=function(){uiCapturePending=true;return new Promise((_resolve,reject)=>this.signal.addEventListener('abort',()=>reject(this.signal.reason),{once:true}))};
        window.restoreUICapture=()=>DocumentResources.prototype.styles=original;
        document.querySelector('[data-editor-pdf-export]').click();return before;
      `);
      try {
        await until("uiCapturePending");
        await execute(
          `document.querySelector('[data-editor-pdf-cancel]').click()`,
        );
        await until(
          `!document.querySelector('[data-editor-pdf-progress]')&&document.querySelectorAll('[data-pagination-surface],.editor-pdf-pages').length===${cancelledUI}`,
        );
        assert.equal(outputs.length, beforeSaveCancel);
        assert.equal(
          await execute(
            `return document.querySelector('[data-editor-pdf-error]')?.textContent`,
          ),
          undefined,
        );
      } finally {
        await execute("restoreUICapture()");
      }
    }
    const integrity = await execute(
      `return {source:JSON.stringify(editor.getJSON())===fullBefore.source,selection:JSON.stringify(editor.state.selection.toJSON())===JSON.stringify(fullBefore.selection),history:JSON.stringify(historyDepth())===JSON.stringify(fullBefore.history),stored:JSON.stringify(await db.chapters.get('fixture.1'))===fullBefore.stored,updates:updates===fullBefore.updates}`,
    );
    assert.ok(Object.values(integrity).every(Boolean));
    assert.ok(
      metrics.every(
        (metric) =>
          metric.pages === metric.pdfPages &&
          metric.paged === 0 &&
          metric.images,
      ),
    );
    const parity = await execute(`
      const {Chapter}=await import('/src/editor/chapter/chapter.ts');
      const {events,getEditorChapter}=await import('/src/editor/event/index.ts');
      const {Document}=await import('/src/editor/document/index.ts');
      const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
      const {paginationKey}=await import('/src/editor/pagination/index.ts');
      const original=getEditorChapter(editor),originalState=editor.state,originalUpdates=updates;
      window.fullParityPlans=[];
      const recordPlan=engine=>engine.events.once('rendered',()=>{fullParityPlans.push(engine.identity.find(section=>section.id==='2'))});
      const second=new Chapter({chapter:'2',document:fullContext,documentId:'fixture',isolated:true}).setTitle('Second chapter first');
      fullContext.chapters.unshift(second);await second.graph.sync();
      try {
        Document.setCurrentChapter(second);await events.create({editor,chapter:second});
        // Commit initialized stable IDs through the same save path as live editing.
        editor.commands.setEditorPagination(true);await events.update({editor});await waitSaved();
        const canonical=await captureDocumentPDF(fullContext,new AbortController().signal,recordPlan);
        const baseline=new DOMParser().parseFromString(canonical.html,'text/html');
        const before=Array.from(baseline.querySelectorAll('[data-document-section="2"] p, [data-document-section="2"] pre'),node=>node.textContent).filter(Boolean);
        window.fullBeforeGlyphs=await captureChapterGlyphs(canonical.html);
        window.fullCanonicalHTML=canonical.html;
        const next=await captureDocumentPDF(editor,new AbortController().signal,recordPlan);
        window.fullActiveHTML=next.html;
        fullParityPlans.push({live:paginationKey.getState(editor.state).layout});
        const parsed=new DOMParser().parseFromString(next.html,'text/html');
        const glyphs=await captureChapterGlyphs(next.html),buckets=new Map(),mismatches=[];
        const key=(glyph,x,y)=>[glyph.page,glyph.character,x,y].join('|');
        for(const glyph of glyphs){const k=key(glyph,Math.floor(glyph.left/4),Math.floor(glyph.top/4));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(glyph)}
        for(const [index,expected] of fullBeforeGlyphs.entries()) {
          let matched=false;
          for(let dx=-1;dx<=1&&!matched;dx++)for(let dy=-1;dy<=1&&!matched;dy++){
            const items=buckets.get(key(expected,Math.floor(expected.left/4)+dx,Math.floor(expected.top/4)+dy))??[];
            const found=items.findIndex(actual=>['left','top','width','height'].every(field=>Math.abs(expected[field]-actual[field])<=0.75));
            if(found>=0){items.splice(found,1);matched=true}
          }
          if(!matched)mismatches.push({index,expected});
        }
        const characters=values=>Array.from(values.join('').replace(/\\s/g,'')).sort().join('');
        return {plans:fullParityPlans,metrics:fullGlyphMetrics,before,after:Array.from(parsed.querySelectorAll('[data-document-section="2"] p, [data-document-section="2"] pre'),node=>node.textContent).filter(Boolean),glyphCount:glyphs.length,expectedGlyphCount:fullBeforeGlyphs.length,mismatches:mismatches.slice(0,10),pages:next.sections.find(section=>section.id==='2').pages,expectedPages:canonical.sections.find(section=>section.id==='2').pages,text:characters(before)===characters(Array.from(parsed.querySelectorAll('[data-document-section="2"] p, [data-document-section="2"] pre'),node=>node.textContent).filter(Boolean))};
      } finally {
        fullContext.chapters.shift();Document.setCurrentChapter(original);await events.create({editor,chapter:original});
        editor.view.updateState(originalState);window.updates=originalUpdates;
      }
    `);
    fs.writeFileSync(
      path.join(folder, "active-chapter-parity.json"),
      JSON.stringify(parity, null, 2),
    );
    fs.writeFileSync(
      path.join(folder, "active-chapter.html"),
      await execute("return fullActiveHTML"),
    );
    fs.writeFileSync(
      path.join(folder, "canonical-chapter.html"),
      await execute("return fullCanonicalHTML"),
    );
    assert.equal(parity.text, true);
    assert.equal(parity.pages, parity.expectedPages);
    assert.equal(parity.glyphCount, parity.expectedGlyphCount);
    assert.deepEqual(parity.mismatches, []);
    fs.writeFileSync(
      path.join(folder, "full-document.json"),
      JSON.stringify(
        {
          snapshot: { ...snapshot, html: undefined, presentation: undefined },
          integrity,
          index: native,
          metrics: metrics.map(({ text, ...metric }) => metric),
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(folder, "full-document.txt"), text);
    console.log(
      "PASS: separated document engine routes editable content to editor pagination and static pages to native templates; typed lifecycle, isolated table styles, category order, references, direct export and source integrity pass.",
    );
  } finally {
    await execute(`
      const {invalidateWorkspaceAuthorProfile}=await import('/src/utils/document-profile.ts');
      fullContext.category=fullCategory;window.profile.get=fullProfileGet;invalidateWorkspaceAuthorProfile();
      await db.chapters.delete('fixture.2');await db.chapters.put(fullForeword);await db.chapters.put(fullAttachment);await db.aliases.delete('fixture.API');
    `);
    await until(
      'layoutReady()&&!document.querySelector("[data-pagination-measure]")',
    );
  }
};
