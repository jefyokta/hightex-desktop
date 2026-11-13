// Opt-in local archives only. No document contents or filenames enter shared fixtures.
// HIGHTEX_PAGINATION_DOCUMENTS=/path/to/archives HIGHTEX_PAGINATION_CATEGORIES=/path/to/directory.json \
// env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/editor-pagination.cjs
const { createHash } = require("node:crypto");
const {
  readdirSync,
  readFileSync,
  copyFileSync,
  mkdirSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
exports.prepare = ({ artifacts }) => {
  assert(
    process.env.HIGHTEX_PAGINATION_CATEGORIES,
    "A local category directory is required",
  );
  const directory = path.resolve(process.env.HIGHTEX_PAGINATION_DOCUMENTS);
  const inputs = readdirSync(directory)
    .filter((name) => name.endsWith(".hightex"))
    .sort();
  assert(inputs.length, "No .hightex archives found");
  const copies = path.join(artifacts, "private-inputs");
  mkdirSync(copies);
  const files = inputs.map((name, index) => {
    const label = `doc-${String(index + 1).padStart(2, "0")}`;
    const source = path.join(directory, name),
      copy = path.join(copies, label + ".hightex");
    const originalHash = hash(readFileSync(source));
    copyFileSync(source, copy);
    return { label, source, copy, originalHash };
  });
  const categories = readFileSync(process.env.HIGHTEX_PAGINATION_CATEGORIES);
  return {
    serve(req, res) {
      if (req.url === "/document-test/categories") {
        res.setHeader("content-type", "application/json");
        res.end(categories);
        return true;
      }
      const file = files.find(
        (file) => req.url === `/document-test/${file.label}`,
      );
      if (!file) return false;
      res.setHeader("content-type", "application/octet-stream");
      res.end(readFileSync(file.copy));
      return true;
    },
    async run({ execute, win }) {
      const report = {
        documents: [],
        originalArchivesUnchanged: false,
        network: "external requests blocked",
        scope: "editor safety and geometry; no PDF parity assertion",
      };
      const checkpoint = () =>
        writeFileSync(
          path.join(artifacts, "document-safety-report.json"),
          JSON.stringify(report, null, 2),
        );
      console.log("Private artifacts:", artifacts);
      const wait = async (code) => {
        const deadline = Date.now() + 45000;
        while (!(await execute(`return Boolean(${code})`))) {
          if (Date.now() > deadline)
            throw Error("Local document editor did not settle");
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
      };
      await execute(`
        const {parseCategoryDirectory}=await import('/src/utils/category-directory.ts');
        const categories=parseCategoryDirectory(await (await fetch('/document-test/categories')).json());
        window.hightex.categories=async()=>structuredClone(categories);
        window.localImporter=(await import('/src/utils/import-v2.ts')).HighTexImporter;
        window.localStorageAdapter=(await import('/src/editor/storage/index.ts')).Storage.instance;
        window.localEvents=(await import('/src/editor/event/index.ts')).events;
        window.localPaginationKey=(await import('/src/editor/pagination/index.ts')).paginationKey;
        window.localChapter=(await import('/src/editor/event/index.ts')).getEditorChapter;
        window.localDiffPaths=(a,b)=>{
          const paths=[];
          const visit=(a,b,path)=>{if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))visit(a[key],b[key],path+'.'+key)}else paths.push(path)};
          visit(a,b,'doc');return paths;
        };
        window.localGeometry=()=>{
          const paper=document.querySelector('.page').getBoundingClientRect();
          const geometry=window.paginationGeometry(),scale=paper.width/geometry.width;
          const overflow=[];let lines=0;
          const outside=rect=>{
            const top=(rect.top-paper.top)/scale,bottom=(rect.bottom-paper.top)/scale;
            const page=Math.floor(top/geometry.stride);
            return top<page*geometry.stride+geometry.margins.top-1||bottom>page*geometry.stride+geometry.height-geometry.margins.bottom+1;
          };
          for(const block of editor.view.dom.querySelectorAll('p,pre code,h1,h2,h3,h4,figcaption')){
            const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node;
            while(node=walker.nextNode()){
              if(node.parentElement.closest('.katex-mathml,[data-editor-page-break]'))continue;
              const range=document.createRange();range.selectNodeContents(node);
              const rects=Array.from(range.getClientRects()).filter(rect=>rect.width&&rect.height);lines+=rects.length;
              if(!rects.some(outside))continue;
              const pages=new Set();
              for(let offset=0;offset<node.length;offset++){
                if(!node.textContent[offset].trim())continue;
                range.setStart(node,offset);range.setEnd(node,offset+1);
                const rect=range.getBoundingClientRect();if(!rect.width||!rect.height||!outside(rect))continue;
                const page=Math.floor(((rect.top-paper.top)/scale)/geometry.stride);
                if(pages.has(page))continue;pages.add(page);
                const pos=editor.view.posAtDOM(node,offset),resolved=editor.state.doc.resolve(pos),css=getComputedStyle(node.parentElement);
                overflow.push({page:page+1,tag:block.tagName,top:(rect.top-paper.top)/scale,bottom:(rect.bottom-paper.top)/scale,position:pos,ancestors:Array.from({length:resolved.depth},(_,i)=>resolved.node(i+1).type.name),fontSize:css.fontSize,lineHeight:css.lineHeight,verticalAlign:css.verticalAlign,marks:resolved.marks().map(mark=>mark.type.name),nearbyBreaks:layout().breaks.filter(item=>Math.abs(item.from-pos)<200).map(item=>({from:item.from,height:item.height,kind:item.kind}))});
              }
            }
          }
          return {lines,overflow};
        };
        window.localMarginFailures=[];
        const {LayoutSnapshot}=await import('/src/editor/pagination/snapshot.ts');
        const originalMargin=LayoutSnapshot.prototype.margin;
        LayoutSnapshot.prototype.margin=function(from,height){
          try{return originalMargin.call(this,from,height)}catch(error){
            const element=this.elements.get(from), css=getComputedStyle(element);
            window.localMarginFailures.push({from,height,type:this.model.nodeAt(from)?.type.name,tag:element.tagName,display:css.display,marginTop:css.marginTop,marginBottom:css.marginBottom,breakHeight:element.style.getPropertyValue('--editor-break-height'),parentTag:element.parentElement.tagName,children:Array.from(element.children).map(child=>({tag:child.tagName,marginTop:getComputedStyle(child).marginTop,marginBottom:getComputedStyle(child).marginBottom}))});
            throw error;
          }
        };
        window.mountApplication();
      `);
      await wait("window.applicationEditor?.isEditable");
      for (const file of files.filter(
        (file) =>
          !process.env.HIGHTEX_PAGINATION_DOCUMENT_FILTER ||
          file.label === process.env.HIGHTEX_PAGINATION_DOCUMENT_FILTER,
      )) {
        const result = {
          label: file.label,
          archiveSha256: file.originalHash,
          chapters: [],
          failures: [],
        };
        report.documents.push(result);
        try {
          const chapters = await execute(`
            const bytes=await (await fetch('/document-test/${file.label}')).arrayBuffer();
            const importer=await localImporter.create(new File([bytes],'local-test.hightex'), 'local-test.hightex');
            const imported=await importer.import('copy');
            window.localDocumentId=imported.id;
            return importer.model.chapters.map(chapter=>({id:({id:'abstract',en:'abstract-en'})[chapter.id]??chapter.id,blocks:chapter.content.length})).filter(chapter=>chapter.id!=='cv'&&chapter.id!=='abbrevation'&&chapter.blocks>0);
          `);
          for (const [index, chapter] of chapters.entries()) {
            if (
              process.env.HIGHTEX_PAGINATION_CHAPTER_FILTER &&
              String(index + 1) !==
                process.env.HIGHTEX_PAGINATION_CHAPTER_FILTER
            )
              continue;
            const id = await execute("return localDocumentId");
            const key = `${id}.${chapter.id}`;
            const record = {
              index: index + 1,
              blocks: chapter.blocks,
              stage: "open",
            };
            result.chapters.push(record);
            try {
              await execute(
                `await window.config.set({editor:{pagination:false}});window.navigate(${JSON.stringify(`/document/${id}/${chapter.id}`)})`,
              );
              await wait(
                `applicationEditor?.isEditable&&applicationChapter()===${JSON.stringify(key)}&&document.querySelector('#page')?.hidden===false`,
              );
              record.stage = "baseline";
              await execute(`
                window.editor=applicationEditor;
                await document.fonts.ready;
                await Promise.all(Array.from(editor.view.dom.querySelectorAll('img')).map(img=>img.complete?null:new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})})));
                await localEvents.update({editor});await localStorageAdapter.waitForChapter(${JSON.stringify(key)});
                window.localOpened=editor.getJSON();
                window.localBaselineErrors=errors.length;window.localMarginFailures=[];
                window.localBaseline=JSON.stringify(editor.getJSON());
                window.localSaved=JSON.stringify((await db.chapters.get(${JSON.stringify(key)})).content);
                window.localText=editor.view.dom.textContent.replaceAll(String.fromCharCode(8288),'');
                window.localImages=editor.view.dom.querySelectorAll('img').length;
              `);
              // Establish the existing save/reopen behavior with pagination OFF first.
              // Old archives can carry a generated chapter title from an older category.
              await execute("window.navigate('/document/fixture/1')");
              await wait(
                "applicationEditor?.isEditable&&applicationChapter()==='fixture.1'",
              );
              await execute(
                `window.navigate(${JSON.stringify(`/document/${id}/${chapter.id}`)})`,
              );
              await wait(
                `applicationEditor?.isEditable&&applicationChapter()===${JSON.stringify(key)}`,
              );
              record.baselineNormalizedFields = await execute(
                "return localDiffPaths(localOpened,applicationEditor.getJSON())",
              );
              await execute(`
                window.editor=applicationEditor;
                await document.fonts.ready;
                await Promise.all(Array.from(editor.view.dom.querySelectorAll('img')).map(img=>img.complete?null:new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})})));
                await localEvents.update({editor});await localStorageAdapter.waitForChapter(${JSON.stringify(key)});
                window.localBaseline=JSON.stringify(editor.getJSON());
                window.localSaved=JSON.stringify((await db.chapters.get(${JSON.stringify(key)})).content);
                window.localText=editor.view.dom.textContent.replaceAll(String.fromCharCode(8288),'');
                window.localImages=editor.view.dom.querySelectorAll('img').length;
                window.localBaselineErrors=errors.length;window.localMarginFailures=[];
                await window.config.set({editor:{pagination:true}});
              `);
              // Resource-driven reflows can keep the last completed page plan visible.
              // A large chapter must finish those background passes before geometry is audited.
              let stable = false;
              const settleDeadline = Date.now() + 45000;
              while (!stable) {
                assert(
                  Date.now() < settleDeadline,
                  "Background layout did not settle",
                );
                await wait(
                  "!localPaginationKey.getState(editor.state).pending&&!document.querySelector('[data-pagination-measure]')&&document.fonts.status==='loaded'",
                );
                const signature = await execute(
                  "return JSON.stringify(layout())",
                );
                await new Promise((resolve) => setTimeout(resolve, 600));
                stable = await execute(
                  `return !localPaginationKey.getState(editor.state).pending&&!document.querySelector('[data-pagination-measure]')&&JSON.stringify(layout())===${JSON.stringify(signature)}`,
                );
              }
              record.stage = "audit";
              Object.assign(
                record,
                await execute(`
                const state=localPaginationKey.getState(editor.state);
                const bounds=localGeometry();
                return {pages:state.layout.pages,layoutError:!!state.layout.error,lines:bounds.lines,overflowRects:bounds.overflow.length,overflow:bounds.overflow,images:localImages,baselineErrors:localBaselineErrors,newErrors:errors.length-localBaselineErrors,marginFailures:localMarginFailures,sourceUnchanged:JSON.stringify(editor.getJSON())===localBaseline,visibleTextUnchanged:editor.view.dom.textContent.replaceAll(String.fromCharCode(8288),'')===localText,savedUnchanged:JSON.stringify((await db.chapters.get(${JSON.stringify(key)})).content)===localSaved};
              `),
              );
              assert(
                record.sourceUnchanged &&
                  record.visibleTextUnchanged &&
                  record.savedUnchanged,
                "Pagination changed source, rendered text or saved content",
              );
              assert(!record.layoutError, "Layout failed");
              if (
                record.overflowRects &&
                process.env.HIGHTEX_PAGINATION_DOCUMENT_DEBUG
              ) {
                record.fresh = await execute(
                  `const before=localGeometry();const fresh=await measureFresh();const whileMeasuring=localGeometry();editor.view.dispatch(editor.state.tr.setMeta(localPaginationKey,{layout:fresh}));return {before,whileMeasuring,pages:fresh.pages,geometry:localGeometry()}`,
                );
                await execute(
                  `const page=document.querySelector('.page');window.scrollTo(0,scrollY+page.getBoundingClientRect().top+${record.overflow[0].top}-180)`,
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                writeFileSync(
                  path.join(artifacts, file.label + "-overflow.png"),
                  (await win.webContents.capturePage()).toPNG(),
                );
              }
              assert.equal(
                record.overflowRects,
                0,
                "Visible characters cross a page boundary",
              );
              assert.equal(
                record.newErrors,
                0,
                "Pagination introduced a renderer error",
              );
              record.stage = "edit-undo";
              await execute(`
                window.closeHistory();
                let position;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='paragraph')position=pos+1});
                if(position===undefined)throw Error('No editable paragraph');
                editor.commands.insertContentAt(position,'Local pagination test. ');
                await localStorageAdapter.waitForChapter(${JSON.stringify(key)});
                window.localEdited=JSON.stringify(editor.getJSON());
                window.localEditSaved=JSON.stringify((await db.chapters.get(${JSON.stringify(key)})).content)!==localSaved&&JSON.stringify((await db.chapters.get(${JSON.stringify(key)})).content).includes('Local pagination test. ');
                editor.commands.undo();await localStorageAdapter.waitForChapter(${JSON.stringify(key)});
                window.localUndoOk=JSON.stringify(editor.getJSON())===localBaseline&&JSON.stringify((await db.chapters.get(${JSON.stringify(key)})).content)===localSaved;
                await window.config.set({editor:{pagination:false}});
              `);
              await wait("!document.querySelector('.editor-pagination-sheet')");
              const safety = await execute(
                "return {editSaved:localEditSaved,undo:localUndoOk,disablePreserved:JSON.stringify(editor.getJSON())===localBaseline}",
              );
              Object.assign(record, safety);
              assert(
                Object.values(safety).every(Boolean),
                "Edit/save/undo/disable failed",
              );
              record.stage = "reopen";
              // Reopen each chapter through the production route, rebuilding its editor.
              await execute("window.navigate('/document/fixture/1')");
              await wait(
                "applicationEditor?.isEditable&&applicationChapter()==='fixture.1'",
              );
              await execute(
                `window.navigate(${JSON.stringify(`/document/${id}/${chapter.id}`)})`,
              );
              await wait(
                `applicationEditor?.isEditable&&applicationChapter()===${JSON.stringify(key)}`,
              );
              record.reopenPreserved = await execute(
                "return JSON.stringify(applicationEditor.getJSON())===localBaseline",
              );
              if (!record.reopenPreserved)
                record.reopenDifferences = await execute(`
return localDiffPaths(JSON.parse(localBaseline),applicationEditor.getJSON()).slice(0,50);
              `);
              if (
                !record.reopenPreserved &&
                record.reopenDifferences.length === 1 &&
                record.reopenDifferences[0] === "doc.content.0.attrs.id"
              ) {
                // Chapter.setContent recreates the generated H1 without its editor UUID.
                // All authored text, marks and other node attributes must still match exactly.
                record.generatedTitleIdChanged = true;
                record.reopenPreserved = true;
              }
              assert(
                record.reopenPreserved,
                "Reopened authored source differs",
              );
              record.stage = "complete";
            } catch (error) {
              // Keep private source and errors out of stdout; stage metadata is sufficient.
              record.failed = true;
              result.failures.push({ chapter: index + 1, type: error.name });
            }
            checkpoint();
          }
        } catch (error) {
          result.failures.push({ stage: "import", type: error.name });
        }
        console.log(
          `${file.label}: ${result.chapters.length} chapters checked; ${result.failures.length} failures`,
        );
      }
      report.originalArchivesUnchanged = files.every(
        (file) => hash(readFileSync(file.source)) === file.originalHash,
      );
      writeFileSync(
        path.join(artifacts, "document-safety-report.json"),
        JSON.stringify(report, null, 2),
      );
      assert(report.originalArchivesUnchanged, "Original archive changed");
      report.errorEventCount = await execute("return errors.length");
      checkpoint();
      assert(
        report.documents.every((doc) => !doc.failures.length),
        "Real document safety checks failed; see local report",
      );
      console.log(
        "PASS: local archive imports, opt-in, text/source preservation, edit/save/undo, disable and chapter reopen.",
      );
      console.log("Private artifacts:", artifacts);
    },
  };
};
