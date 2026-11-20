const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");
const electron = require("electron");
const { execFileSync } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");

exports.prepare = ({ root, artifacts }) => {
  const compile = (source) =>
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText;
  const preloadSource = fs.readFileSync(
    path.join(root, "electron/preload/index.ts"),
    "utf8",
  );
  const ast = ts.createSourceFile(
    "preload.ts",
    preloadSource,
    ts.ScriptTarget.Latest,
    true,
  );
  const api = ast.statements.find((node) =>
    node
      .getText(ast)
      .startsWith('contextBridge.exposeInMainWorld("editorPDFExperimental"'),
  );
  assert.ok(api);
  const preload = path.join(artifacts, "editor-pdf-api.cjs");
  fs.writeFileSync(
    preload,
    compile(
      'import {contextBridge,ipcRenderer} from "electron";\n' +
        api.getText(ast),
    ),
  );
  const printPreload = path.join(artifacts, "editor-pdf-print-preload.cjs");
  fs.writeFileSync(printPreload, compile(preloadSource));
  let base,
    dialogMode = "save",
    count = 0,
    timeout = Number(process.env.HIGHTEX_NATIVE_PRINT_TIMEOUT_MS ??
      (process.env.HIGHTEX_CORE_MVP_PRINT || process.env.HIGHTEX_EDITOR_PDF_ARCHIVES ? 120000 : 30000));
  assert.ok(Number.isFinite(timeout)&&timeout>0&&timeout<=300000,'Invalid bounded native print deadline');
  const outputs = [],
    metrics = [];
  const timings = { nativePrintMs: [], hostReadyMs: [], assemblyMs: [], exportMs: [] };
  const timed = async (values, work) => {
    const start = performance.now();
    try { return await work(); }
    finally { values.push(performance.now() - start); }
  };
  let proof, inspectPrint;
  const recordedSnapshots=new Set();
  const load = (file, modules) => {
    const module = { exports: {} };
    new Function(
      "exports",
      "require",
      compile(fs.readFileSync(path.join(root, file), "utf8")),
    )(module.exports, (name) =>
      name in modules ? modules[name] : require(name),
    );
    return module.exports;
  };
  const contract = load("shared/editor-pdf-contract.ts", {});
  const dependencies = {
      electron: {
        ...electron,
        dialog: {
          showSaveDialog: async () => {
            if (dialogMode === "cancel") return { canceled: true };
            const filePath = path.join(
              artifacts,
              "editor-pdf-" + ++count + ".pdf",
            );
            outputs.push(filePath);
            return { canceled: false, filePath };
          },
        },
      },
      "../main/application": {
        Application: {
          instance: {
            preloadEntry: printPreload,
            resolveRendererUrl: (route) => new URL(route, base).href,
          },
        },
      },
      "./config-service": {
        ConfigService: {
          get: () => ({
            export: { saveFolder: artifacts, exportTimeout: timeout },
          }),
        },
      },
      "../../shared/editor-pdf-contract": contract,
    };
  const host = load("electron/windows/editor-pdf-host.ts", {
    ...dependencies, "../service/config-service": dependencies["./config-service"],
  });
  const assembly = load("electron/pdf/page-assembly.ts", {});
  const { EditorPDFExperimentalService } = load("electron/service/editor-pdf-experimental-service.ts", {
    ...dependencies, "../windows/editor-pdf-host": host,
    "../pdf/page-assembly": assembly,
  });
  if (process.env.HIGHTEX_PDF_TIMING) {
    for (const [prototype, method, values] of [
      [host.EditorPDFHost.prototype, "open", timings.hostReadyMs],
      [assembly.PDFPageAssembly.prototype, "finish", timings.assemblyMs],
      [EditorPDFExperimentalService.prototype, "export", timings.exportMs],
    ]) {
      const original = prototype[method];
      prototype[method] = async function(...args) {
        try { return await timed(values, () => original.apply(this, args)); }
        finally { fs.writeFileSync(path.join(artifacts, "pdf-timing.json"), JSON.stringify(timings, null, 2)); }
      };
    }
  }
  const legacyProfile = process.env.HIGHTEX_COMPARE_LEGACY
    ? require('./legacy-export-profile.cjs').prepare({root,artifacts,load,dependencies})
    : undefined;
  const handled = load("electron/exception/interface/handled.ts", {});
  const reporting = load("electron/exception/should-report.ts", {
    "./interface/handled": handled,
    "@main/service/logger-service": load("electron/service/logger-service.ts", {}),
  });
  const { EditorPDFExperimentalHandlers } = load(
    "electron/handlers/editor-pdf-experimental-handlers.ts",
    {
      "../utilities/ipc-main": {
        IPCMain: {
          handle: (channel, listener) =>
            electron.ipcMain.handle(channel, listener),
        },
      },
      "../service/editor-pdf-experimental-service": {
        EditorPDFExperimentalService: process.env.HIGHTEX_PDF_BATCH
          ? class extends EditorPDFExperimentalService {
              constructor() { super(Number(process.env.HIGHTEX_PDF_BATCH)); }
            } : EditorPDFExperimentalService,
      },
      "../exception/interface/handled": handled,
      "../exception/should-report": reporting,
    },
  );
  EditorPDFExperimentalHandlers.register();
  electron.ipcMain.handle("config:get", () => ({ language: "en" }));
  const created = (_event, win) => {
    if(process.env.HIGHTEX_INPUT_CDP||process.env.HIGHTEX_COMPOSITE_APP)win.setFocusable(false);
    win.webContents.on('console-message', event => {
      if (event.level === 'error') console.error('PDF host:', event.message);
    });
    const print = win.webContents.printToPDF.bind(win.webContents);
    const native = options => process.env.HIGHTEX_PDF_TIMING
      ? timed(timings.nativePrintMs, () => print(options)) : print(options);
    win.webContents.printToPDF = async (options) => {
      const url = new URL(win.webContents.getURL());
      if (url.pathname === "/experimental/editor-pdf/print") {
        if(process.env.HIGHTEX_CORE_MVP_PRINT || process.env.HIGHTEX_EDITOR_PDF_ARCHIVES){
          const bytes=await native(options);
          const progressFile=path.join(artifacts,'core-native-progress.json');
          const previous=fs.existsSync(progressFile)?JSON.parse(fs.readFileSync(progressFile,'utf8')):{pages:0,started:Date.now()};
          previous.pages++;previous.elapsedMs=Date.now()-previous.started;
          fs.writeFileSync(progressFile,JSON.stringify(previous));
          return bytes;
        }
        if(process.env.HIGHTEX_COMPOSITE_APP){
          const snapshot=await win.webContents.executeJavaScript(`window.editorPDFExperimental.init(${JSON.stringify(url.searchParams.get('request'))})`);
          if(!recordedSnapshots.has(snapshot.fingerprint)){
            recordedSnapshots.add(snapshot.fingerprint);
            fs.writeFileSync(path.join(artifacts,'application-snapshot-'+recordedSnapshots.size+'.json'),JSON.stringify(snapshot));
          }
        }
        const metric = await win.webContents.executeJavaScript(
          `({pages:document.querySelectorAll('[data-page-chrome]').length||document.querySelectorAll('.editor-page-fragment').length,paged:document.querySelectorAll('.pagedjs_page').length,images:Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0&&image.src.startsWith('data:')),fonts:Array.from(document.fonts).every(font=>font.status!=='error'),paper:getComputedStyle(document.querySelector('[data-section-context],.editor-page-fragment')).backgroundColor,ink:getComputedStyle(document.querySelector('[data-section-context] .tiptap,.editor-page-fragment .tiptap,.document-template-content')).color,borders:Array.from(document.querySelectorAll('[data-section-context] tr,.editor-page-fragment tr')).every(row=>getComputedStyle(row).borderBottomColor==='rgb(0, 0, 0)'&&getComputedStyle(row).borderTopColor==='rgb(0, 0, 0)'),text:document.body.textContent})`,
        );
        const bytes = await native(options);
        if (inspectPrint) await inspectPrint(win, bytes);
        if (process.env.HIGHTEX_EDITOR_PDF_APPENDIX_PROBE)
          metric.appendices = await win.webContents
            .executeJavaScript(`Array.from(document.querySelectorAll('[data-document-section="attachment"]'),page=>{
            const heading=page.querySelector('h1'),box=heading.getBoundingClientRect(),origin=page.getBoundingClientRect();
            return {page:Number(page.dataset.documentPage),headingY:box.top-origin.top,padding:getComputedStyle(page).paddingTop,style:heading.getAttribute('style')};
          })`);
        if (process.env.HIGHTEX_EDITOR_PDF_VERIFY)
          metric.references = await win.webContents
            .executeJavaScript(`Array.from(document.querySelectorAll('a[data-type="ref-component"][data-status="missing"]'),link=>{
            const page=link.closest('.editor-page-fragment'),box=link.getBoundingClientRect(),origin=page.getBoundingClientRect();
            return {text:link.textContent,color:getComputedStyle(link).color,page:Number(page.dataset.documentPage),rect:{x:box.left-origin.left,y:box.top-origin.top,width:box.width,height:box.height},href:link.getAttribute('href')};
          })`);
        if (proof)
          await require("./editor-page-fragments.cjs").verifyPdf({
            pdf: bytes,
            printWindow: win,
            ...proof,
          });
        metric.pdfPages = (await PDFDocument.load(bytes)).getPageCount();
        metrics.push(metric);
        return bytes;
      }
      return native(options);
    };
  };
  electron.app.on("browser-window-created", created);
  return {
    preload,
    connect(url) {
      base = url;
    },
    outputs,
    metrics,
    legacyProfile: (url, input) => legacyProfile.generate(url,input),
    async generate(snapshot, batch) {
      const before = timings.nativePrintMs.length;
      const started = performance.now();
      const bytes = await new EditorPDFExperimentalService(batch).generate(snapshot, new AbortController().signal);
      return { bytes, ms: performance.now() - started, calls: timings.nativePrintMs.length - before };
    },
    inspectPrint(callback) {
      inspectPrint = callback;
    },
    async serve(req, res, vite) {
      if (legacyProfile && await legacyProfile.serve(req,res,vite)) return true;
      if (
        new URL(req.url, "http://fixture").pathname !==
        "/experimental/editor-pdf/print"
      )
        return false;
      res.setHeader("content-type", "text/html");
      res.end(
        await vite.transformIndexHtml(
          "/experimental/editor-pdf/print",
          `<!doctype html><div id="root"></div><script type="module" src="/src/main.tsx"></script>`,
        ),
      );
      return true;
    },
    async run({
      execute,
      until,
      win,
      folder,
      contract: sourceContract,
      editorAudit,
      fragmentOutput,
      ranges,
      narrativeIds,
    }) {
      base = win.webContents.getURL();
      if (process.env.HIGHTEX_EDITOR_PDF_DOCUMENT) {
        proof = undefined;
        return require("./editor-document-pdf.cjs").run({
          execute,
          until,
          folder,
          metrics,
          outputs,
          setDialogMode: (mode) => {
            dialogMode = mode;
          },
        });
      }
      const hostEvidence = path.join(folder, "application-host");
      fs.mkdirSync(hostEvidence);
      proof = {
        output: fragmentOutput,
        contract: sourceContract,
        folder: hostEvidence,
      };
      const integrityScript = `return {source:JSON.stringify(editor.getJSON()),stored:JSON.stringify(await db.chapters.get('fixture.1')),updates,plan:JSON.stringify(layout()),selection:editor.state.selection.toJSON(),...historyDepth()}`;
      if (process.env.HIGHTEX_EDITOR_PDF_SEPARATOR) {
        await execute("window.caretWidget=installCaretWidget()");
        await until("layoutReady()");
        const separator = await execute(
          `const helper=editor.view.dom.querySelector('img.ProseMirror-separator');return {exists:!!helper,src:helper?.getAttribute('src'),width:helper?.naturalWidth}`,
        );
        assert.deepEqual(separator, { exists: true, src: null, width: 0 });
      }
      const baseline = await execute(integrityScript);
      if (process.env.HIGHTEX_EDITOR_PDF_UNUSED_FONT)
        assert.deepEqual(
          await execute(`
          const failed=new FontFace('Unused UI failure',new Uint8Array([0]).buffer);
          try{await failed.load()}catch{}
          document.fonts.add(failed);window.unusedFailedFont=failed;
          await document.fonts.ready;
          return {font:failed.status,pending:!layoutReady()};
        `),
          { font: "error", pending: false },
        );
      const input = await execute(
        `const {captureEditorChapterPDF:captureDocumentPDF}=await import('/tests/helpers/editor-chapter-pdf.ts');window.pdfSnapshot=await captureDocumentPDF(editor,new AbortController().signal);return pdfSnapshot`,
      );
      fs.writeFileSync(
        path.join(folder, "editor-pdf-snapshot.json"),
        JSON.stringify(
          {
            ...input,
            html: undefined,
            presentation: undefined,
            htmlBytes: Buffer.byteLength(input.html),
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(
        path.join(folder, "editor-pdf-captured.html"),
        input.html,
      );
      const presentationMatch = await execute(`
        const {editorPDFPresentation}=await import('/src/document-export/snapshot/presentation.ts');
        const expected=editorPDFPresentation(fragmentHost),actual=pdfSnapshot.presentation;
        return expected.flatMap((page,index)=>page.flatMap((box,offset)=>{
          const other=actual[index]?.[offset];
          return !other||box.some((value,dimension)=>Math.abs(value-other[dimension])>0.75)?[{page:index+1,offset,source:box,captured:other}]:[];
        }));
      `);
      fs.writeFileSync(
        path.join(folder, "editor-pdf-source-presentation.json"),
        JSON.stringify(presentationMatch, null, 2),
      );
      assert.equal(input.pages, editorAudit.pages);
      assert.ok(!input.html.includes("blob:"));
      assert.equal(
        await execute(
          `return new DOMParser().parseFromString(pdfSnapshot.html,'text/html').body.querySelectorAll('img.ProseMirror-separator').length`,
        ),
        0,
      );
      // Bounded diagnostic capture exercises the exact source-range/PDF oracle.
      // The separate document fixture covers the actual full-document UI.
      await execute(
        "await window.editorPDFExperimental.export(pdfSnapshot,crypto.randomUUID())",
      );
      assert.equal(outputs.length, 1);
      assert.ok(fs.existsSync(outputs[0]));
      const bytes = fs.readFileSync(outputs[0]),
        pdf = await PDFDocument.load(bytes);
      assert.equal(pdf.getPageCount(), input.pages);
      const subject = JSON.parse(pdf.getSubject());
      assert.equal(subject.kind, "editor-chapter-experimental");
      assert.equal(subject.sourceHash, input.sourceHash);
      assert.equal(subject.planHash, input.planHash);
      const text = execFileSync("pdftotext", ["-layout", outputs[0], "-"], {
          encoding: "utf8",
        }),
        raw = execFileSync("pdftotext", ["-raw", outputs[0], "-"], {
          encoding: "utf8",
        });
      fs.writeFileSync(path.join(folder, "editor-pdf.txt"), text);
      fs.writeFileSync(path.join(folder, "editor-pdf-raw.txt"), raw);
      fs.copyFileSync(outputs[0], path.join(folder, "editor-pdf.pdf"));
      require("./page-plan-pdf.cjs").verifyPagePlanText({
        text,
        raw,
        contract: sourceContract,
        markerPages: editorAudit.markerPages,
        ranges,
        narrativeIds,
      });
      assert.ok(
        metrics.every(
          (metric) =>
            metric.pages === metric.pdfPages &&
            metric.paged === 0 &&
            metric.images &&
            metric.fonts &&
            metric.paper === "rgb(255, 255, 255)" &&
            metric.ink === "rgb(0, 0, 0)" &&
            metric.borders,
        ),
      );
      const beforeCancel = metrics.length;
      dialogMode = "cancel";
      assert.equal(
        await execute(
          "return window.editorPDFExperimental.export(pdfSnapshot,crypto.randomUUID())",
        ),
        null,
      );
      assert.equal(metrics.length, beforeCancel);
      dialogMode = "save";
      const tampered = await execute(
        "try{await window.editorPDFExperimental.export({...pdfSnapshot,pages:pdfSnapshot.pages+1},crypto.randomUUID());return false}catch(error){return /identity|Invalid editor PDF snapshot/.test(error.message)}",
      );
      assert.equal(tampered, true);
      const failedPrints = await execute(`
        const {archiveSha256}=await import('/src/utils/htx/import-model.ts');
        const {editorPDFIdentity}=await import('/shared/editor-pdf-contract.ts');
        const result={};
        for(const kind of ['presentation','image','markup']){
          const snapshot=structuredClone(pdfSnapshot);
          if(kind==='presentation')snapshot.presentation[0][0][2]+=20;
          else if(kind==='image')snapshot.html=snapshot.html.replace(/src="data:image[^\"]*"/,'src="data:image/png;base64,AA=="');
          else snapshot.html=snapshot.html.replace('</body>','<script>throw Error("must never run")</script></body>');
          snapshot.fingerprint=await archiveSha256(new TextEncoder().encode(editorPDFIdentity(snapshot)));
          try{await window.editorPDFExperimental.export(snapshot,crypto.randomUUID())}catch(error){result[kind]=error.message.includes(kind==='presentation'?'presentation changed':kind==='image'?'Unable to load print image':'Unsupported editor PDF markup')}
        }
        return result;
      `);
      assert.deepEqual(failedPrints, {
        presentation: true,
        image: true,
        markup: true,
      });
      assert.equal(metrics.length, beforeCancel);
      assert.ok(outputs.slice(1).every((file) => !fs.existsSync(file)));
      const integrity = await execute(integrityScript);
      assert.deepEqual(integrity, baseline);
      const readiness = await execute(`
        const {waitForEditorExport}=await import('/src/document-export/source/editor-readiness.ts');
        const {paginationKey}=await import('/src/editor/pagination/index.ts');
        const plan=layout(),publish=value=>editor.view.dispatch(editor.state.tr.setMeta(paginationKey,value));
        publish({pending:true});let settled=false;
        const waiting=waitForEditorExport(editor,new AbortController().signal).then(value=>{settled=true;return value});
        await Promise.resolve();
        const pendingWait=!settled;publish({layout:structuredClone(plan)});
        const result=await waiting;
        publish({pending:true});const canceled=new AbortController();
        const stopped=waitForEditorExport(editor,canceled.signal);canceled.abort();let cancel=false;
        try{await stopped}catch(error){cancel=error.name==='AbortError'}
        const timeout=window.setTimeout;window.setTimeout=(callback,delay,...args)=>timeout(callback,delay===30000?20:delay,...args);
        let timedOut=false;try{await waitForEditorExport(editor,new AbortController().signal)}catch(error){timedOut=error.message.includes('30 seconds')}finally{window.setTimeout=timeout;publish({layout:structuredClone(plan)})}
        const finalPlan=structuredClone(plan),reflow=waitForEditorExport(editor,new AbortController().signal);
        requestAnimationFrame(()=>{publish({pending:true});requestAnimationFrame(()=>publish({layout:finalPlan}))});
        const stable=await reflow;
        return {pendingWait,exactPlan:result.plan.pages===plan.pages&&result.source===editor.state.doc,cancel,timedOut,reflowPlan:stable.plan===finalPlan};
      `);
      assert.deepEqual(readiness, {
        pendingWait: true,
        exactPlan: true,
        cancel: true,
        timedOut: true,
        reflowPlan: true,
      });
      if (process.env.HIGHTEX_PAGE_PLAN_CITATIONS) {
        const citations = await execute(`
          const {waitForEditorExport}=await import('/src/document-export/source/editor-readiness.ts');
          const {captureEditorChapterPDF:captureDocumentPDF}=await import('/tests/helpers/editor-chapter-pdf.ts');
          const cite=editor.view.dom.querySelector('cite'),status=cite.dataset.citationStatus;
          const result={};
          try {
            cite.dataset.citationStatus='error';
            await waitForEditorExport(editor,new AbortController().signal);result.missing=true;
            cite.dataset.citationStatus='loading';let settled=false;
            const pending=waitForEditorExport(editor,new AbortController().signal).then(value=>{settled=true;return value});
            await new Promise(resolve=>setTimeout(resolve,80));result.waited=!settled;
            cite.dataset.citationStatus='ready';await pending;result.recovered=true;
            const record=await db.cite.get('cite-fixture-alpha');
            try {
              await db.cite.put({...record,bib:record.bib.replace('2024','2026')});
              try{await captureDocumentPDF(editor,new AbortController().signal)}catch(error){result.archiveChanged=error.message.includes('Citation')||error.message.includes('citation')}
            }finally{await db.cite.put(record)}
          } finally {cite.dataset.citationStatus=status}
          return result;
        `);
        assert.deepEqual(citations, {
          missing: true,
          waited: true,
          recovered: true,
          archiveChanged: true,
        });
        fs.writeFileSync(
          path.join(folder, "citation-readiness.json"),
          JSON.stringify(citations, null, 2),
        );
        await until("layoutReady()");
      }
      await execute(`
        window.fontStyleBefore=editor.view.dom.getAttribute('style');
        const failed=new FontFace('Failed chapter font',new Uint8Array([0]).buffer);
        try{await failed.load()}catch{}document.fonts.add(failed);window.failedChapterFont=failed;
        editor.view.dom.style.fontFamily='"Failed chapter font",serif';
      `);
      await until(
        "layoutReady()&&!document.querySelector('[data-editor-pdf-export]').disabled",
      );
      await execute(
        "document.querySelector('[data-editor-pdf-export]').click()",
      );
      await until("document.querySelector('[role=alert]')");
      const fontError = await execute(
        `return {message:document.querySelector('[role=alert]').textContent,extraStatus:document.querySelector('[data-editor-pdf-progress]')?.textContent??null}`,
      );
      assert.ok(fontError.message.includes("Failed chapter font"));
      assert.equal(fontError.extraStatus, null);
      const chapterProof = proof;
      proof = undefined;
      const beforeRetry = outputs.length;
      await execute(`
        if(fontStyleBefore===null)editor.view.dom.removeAttribute('style');else editor.view.dom.setAttribute('style',fontStyleBefore);
        document.fonts.delete(failedChapterFont);
        document.querySelector('[data-editor-pdf-export]').click();
      `);
      await until(
        "!document.querySelector('[data-editor-pdf-export]').disabled",
      );
      assert.equal(
        await execute(
          "return document.querySelector('[role=alert]')?.textContent",
        ),
        undefined,
      );
      assert.equal(outputs.length, beforeRetry + 1);
      assert.ok(fs.existsSync(outputs.at(-1)));
      proof = chapterProof;
      await until(
        "!document.querySelector('[data-editor-pdf-progress]')&&layoutReady()",
      );
      const failures = await execute(`
        const {captureEditorChapterPDF:captureDocumentPDF}=await import('/tests/helpers/editor-chapter-pdf.ts');
        const {Storage}=await import('/src/editor/storage/index.ts');
        const {paginationKey}=await import('/src/editor/pagination/index.ts');
        const storage=Storage.instance,wait=storage.waitForDocument;
        const count=()=>document.querySelectorAll('[data-pagination-surface],.editor-pdf-pages').length;
        const before=count(),result={};
        const aborted=new AbortController();aborted.abort();
        try{await captureDocumentPDF(editor,aborted.signal)}catch(error){result.preAbort=error.name==='AbortError'}
        const mid=new AbortController();
        const observer=new MutationObserver(()=>{if(document.querySelector('body>.editor-pdf-pages'))mid.abort()});
        observer.observe(document.body,{childList:true});
        try{await captureDocumentPDF(editor,mid.signal)}catch(error){result.midAbort=error.name==='AbortError'}finally{observer.disconnect()}
        storage.waitForDocument=async function(...args){await wait.apply(this,args);editor.view.dispatch(editor.state.tr.setMeta(paginationKey,{layout:structuredClone(layout())}))};
        try{await captureDocumentPDF(editor,new AbortController().signal)}catch(error){result.stalePlan=error.message.includes('changed')}finally{storage.waitForDocument=wait}
        const image=editor.view.dom.querySelector('img:not(.ProseMirror-separator)'),src=image.getAttribute('src');
        storage.waitForDocument=async function(...args){await wait.apply(this,args);image.src=src+'#changed'};
        try{await captureDocumentPDF(editor,new AbortController().signal)}catch{result.imageChanged=true}finally{storage.waitForDocument=wait;image.setAttribute('src',src);await image.decode()}
        for(let turn=0;turn<100;turn++){await new Promise(requestAnimationFrame);if(layoutReady())break}
        const fetch=window.fetch;
        window.fetch=async()=>{throw Error('Fixture resource unavailable')};
        try{await captureDocumentPDF(editor,new AbortController().signal)}catch(error){result.resourceFailure=error.message.includes('Fixture resource unavailable')}finally{window.fetch=fetch}
        const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
        const style=document.createElement('style');style.textContent='.capture-fixture{color:red}';document.head.append(style);
        try{const resources=new DocumentResources(new AbortController().signal);try{await resources.styles()}catch(error){throw Error('Style test capture: '+error.message)};style.sheet.insertRule('.capture-changed{color:blue}');try{resources.assertCurrent()}catch(error){const {EditorPDFStateError}=await import('/src/exception/editor-pdf-state-error.ts');result.stylesChanged=error instanceof EditorPDFStateError}}finally{style.remove()}
        result.cleaned=count()===before;
        return result;
      `);
      assert.deepEqual(failures, {
        preAbort: true,
        midAbort: true,
        stalePlan: true,
        imageChanged: true,
        resourceFailure: true,
        stylesChanged: true,
        cleaned: true,
      });
      const imageProjection = await execute(`
        const {EditorState,EditorView}=nativeEditor;
        const {PageImageSnapshot}=await import('/src/editor/pagination/measurement/image-snapshot.ts');
        const {PageFragments}=await import('/tests/helpers/legacy-pagination/fragments.ts');
        const {applyPageGeometry}=await import('/src/editor/pagination/options.ts');
        const {resolveChapterContent}=await import('/src/editor/chapter/render-content.ts');
        const host=document.createElement('div'),output=document.createElement('main');
        host.className='page';host.dataset.paginationSurface='';host.style.cssText='position:absolute;left:-100000px;top:0';applyPageGeometry(host,planGeometry);document.body.append(host,output);
        const source=editor.schema.nodeFromJSON({type:'doc',content:[p('Caret helper is not an authored image.')]});
        const view=new EditorView(host,{state:EditorState.create({doc:source,plugins:[createCaretWidget()]}),editable:()=>false,attributes:{class:'tiptap ProseMirror'}});
        const fragments=new PageFragments({source,view,layout:{pages:1,breaks:[]},layoutRevision:0,headingNumbers:new Map()},planGeometry);
        const hydrated=document.createElement('section');hydrated.innerHTML='<p>Text<img class="ProseMirror-separator" alt=""></p><img data-image-id="fixture-image">';
        let rendered;
        try{
          const generated=!!view.dom.querySelector('img.ProseMirror-separator'),images=new PageImageSnapshot(view);
          await fragments.render(output,new AbortController().signal);
          rendered=resolveChapterContent(hydrated,planModel);
          await hydrated.querySelector('img[data-image-id]').decode();
          return {generated,sourceImages:images.images.length,current:images.isCurrent(),exportedHelpers:output.querySelectorAll('img.ProseMirror-separator').length,text:fragments.pages[0].content.textContent===source.textContent,hydration:rendered.issues.length===0,realImage:hydrated.querySelector('img[data-image-id]').naturalWidth>0};
        }finally{rendered?.dispose();fragments.destroy();view.destroy();host.remove();output.remove()}
      `);
      assert.deepEqual(imageProjection, {
        generated: true,
        sourceImages: 0,
        current: true,
        exportedHelpers: 0,
        text: true,
        hydration: true,
        realImage: true,
      });
      const authoredImageGuard = await execute(`
        const {EditorState,EditorView}=nativeEditor;
        const {PageImageSnapshot}=await import('/src/editor/pagination/measurement/image-snapshot.ts');
        const host=document.createElement('div');document.body.append(host);
        const source=editor.schema.nodeFromJSON({type:'doc',content:[{type:'image',attrs:{src:'fixture-image',width:100}}]});
        const view=new EditorView(host,{state:EditorState.create({doc:source}),editable:()=>false});
        try{
          const unavailable=new PageImageSnapshot(view).issue;
          const image=view.dom.querySelector('img:not(.ProseMirror-separator)');image.src=editor.view.dom.querySelector('img:not(.ProseMirror-separator)').src;await image.decode();
          const snapshot=new PageImageSnapshot(view),ready=snapshot.isCurrent();
          const original=image.src;image.src=original+'#changed';const changed=snapshot.issue;
          image.src=original;await image.decode();
          const restored=snapshot.isCurrent();
          return {unavailable,ready,changed,restored};
        }finally{view.destroy();host.remove()}
      `);
      assert.deepEqual(authoredImageGuard, {
        unavailable: { image: 1, reason: "unavailable" },
        ready: true,
        changed: { image: 1, reason: "changed" },
        restored: true,
      });
      const zoom = await execute(`
        const {captureEditorChapterPDF:captureDocumentPDF}=await import('/tests/helpers/editor-chapter-pdf.ts');
        const paper=editor.view.dom.closest('.page'),style=paper.getAttribute('style');
        paper.style.transform='scale(0.67)';
        try{
          let captured;try{captured=await captureDocumentPDF(editor,new AbortController().signal)}catch(error){throw Error('Zoom capture: '+error.message)};
          const parsed=new DOMParser().parseFromString(captured.html,'text/html');
          const sourceTable=editor.view.dom.querySelector('table'),table=parsed.querySelector('table');
          return {pages:captured.pages,planHash:captured.planHash,columns:Math.abs(parseFloat(table.style.width)-sourceTable.getBoundingClientRect().width/0.67)<0.5};
        }finally{if(style===null)paper.removeAttribute('style');else paper.setAttribute('style',style)}
      `);
      assert.deepEqual(zoom, {
        pages: input.pages,
        planHash: input.planHash,
        columns: true,
      });
      assert.equal(
        electron.BrowserWindow.getAllWindows().filter(
          (window) =>
            !window.isDestroyed() &&
            new URL(window.webContents.getURL()).pathname ===
              "/experimental/editor-pdf/print",
        ).length,
        0,
      );
      fs.writeFileSync(
        path.join(folder, "editor-pdf-host.json"),
        JSON.stringify(
          {
            metadata: subject,
            metrics: metrics.map(({ text, ...rest }) => rest),
            integrity: true,
            saveCancel: true,
            tamperedRejected: true,
            failedPrints,
            captureFailures: failures,
            readiness,
            fontError,
            imageProjection,
            authoredImageGuard,
            retryCapture: true,
            zoom,
          },
          null,
          2,
        ),
      );
      console.log(
        "PASS: bounded diagnostic uses new typed IPC and real PDF host with portable captured resources, exact editor pages and unchanged source/legacy pipeline.",
      );
    },
  };
};
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE = "1";
  process.env.HIGHTEX_EDITOR_PAGE_PLAN = "1";
  process.env.HIGHTEX_PAGE_PLAN_FRAGMENTS = "1";
  process.env.HIGHTEX_PAGE_PLAN_MIXED = "1";
  require("./editor-pagination.cjs");
}
