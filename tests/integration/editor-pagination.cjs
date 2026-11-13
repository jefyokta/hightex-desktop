// Isolated real Tiptap editor, persistence and native Chromium layout.
// env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/editor-pagination.cjs
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const artifacts = mkdtempSync(path.join(os.tmpdir(), "hightex-pagination-"));
app.setPath("userData", artifacts);
app.disableHardwareAcceleration();
let vite, server, win;
const documentTests = process.env.HIGHTEX_PAGINATION_DOCUMENTS
  ? require('./editor-pagination-documents.cjs').prepare({ artifacts }) : undefined;
const html = `<!doctype html><body style="margin:0;background:#f1f3f5"><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {useEditor,EditorContent} from '@tiptap/react';
import {closeHistory} from '@tiptap/pm/history';
import {Document} from '/src/editor/document/index.ts';
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {Storage} from '/src/editor/storage/index.ts';
import {events,getEditorChapter} from '/src/editor/event/index.ts';
import {EditorPagination,paginationKey} from '/src/editor/pagination/index.ts';
import {EDITOR_PAGE} from '/src/editor/pagination/layout.ts';
import {paginationGeometry} from '/src/editor/pagination/options.ts';
import {measureEditor} from '/src/editor/pagination/measure.ts';
import {FlowCache} from '/src/editor/pagination/flow.ts';
import {LayoutSnapshot} from '/src/editor/pagination/snapshot.ts';
import {PaginationStatus} from '/src/components/editor/pagination-status.tsx';
import {TooltipProvider} from '/src/components/ui/tooltip.tsx';
import {MemoryRouter,Routes,Route,useNavigate} from 'react-router-dom';
import {Editor as ApplicationEditor} from '/src/pages/editor.tsx';
import {EditorProvider,useCurrentEditor} from '/src/hooks/use-editor.tsx';
import {ParamsContextProvider} from '/src/hooks/use-params.tsx';
import {ExpandableSideBarContextProvider} from '/src/hooks/use-expandable-sidebar.tsx';
import {ConfigContextProvider} from '/src/context/config-context.tsx';
import '/src/App.css';import '/src/css/editor.css';import 'katex/dist/katex.css';
const config={language:'en',theme:'light',editor:{pagination:false},previewer:{scope:'current',autoUpdate:false,layoutIndicator:true}};
const configListeners=new Set();
window.config={get:()=>structuredClone(config),onChange:callback=>{configListeners.add(callback);return ()=>configListeners.delete(callback)},set:async patch=>{const editor={...config.editor,...patch.editor};Object.assign(config,patch,{editor});for(const callback of configListeners)callback(structuredClone(config));return structuredClone(config)}};
window.feedbackTest={reports:[],copies:[],versionCalls:0,mode:'success'};
Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.feedbackTest.copies.push(text)}}});
window.hightex={version:async()=>{window.feedbackTest.versionCalls++;if(window.feedbackTest.versionFails)throw Error('Offline version fixture');return '1.5.0'},reportError:async report=>{window.feedbackTest.reports.push(report);if(window.feedbackTest.mode==='failure')throw Error('Offline report fixture');if(window.feedbackTest.mode==='deferred')await new Promise(resolve=>window.feedbackTest.resolve=resolve)},categories:async()=>[{id:1,name:'Fixture',variant:'thesis',chapters:[{chapter:'1',title:'Introduction'}]}],cloud:{academic:{locked:async()=>false}}};
window.session={onChange:()=>()=>{}};
window.profile={get:async()=>({name:'Writer',nim:'001',cv:'',advisorName:'Advisor',advisorNip:'002',isCloud:false}),picture:async()=>false};
const db=HighTexDB.getInstance();await db.open();window.db=db;
window.citeKey=(await db.cite.toCollection().first()).key;
const p=text=>({type:'paragraph',content:[{type:'text',text}]});
const sentence='Penelitian ini menjelaskan hubungan antara kebutuhan pengguna dan hasil pengujian sistem. ';
window.p=p;window.sentence=sentence;
window.codeListFixture=count=>Array.from({length:count},(_,i)=>[
 p(sentence.repeat(1+i%9)),{type:'orderedList',content:[{type:'listItem',content:[p('Contoh'),
  {type:'codeBlock',content:[{type:'text',text:Array.from({length:2+i%20},(_,j)=>'const baris'+j+' = '+j+';').join(String.fromCharCode(10))}]},
  p('Sesudah kode '+sentence.repeat(2))]}]},p('Berikut '+sentence)]).flat();
window.makeTable=rows=>({type:'figureTable',content:[
 {type:'figcaption',content:[{type:'text',text:'Hasil Pengujian'}]},
 {type:'table',content:Array.from({length:rows},(_,index)=>({type:'tableRow',content:[0,1].map(column=>({type:index===0?'tableHeader':'tableCell',content:[p('Data '+index+' / '+column)]}))}))},
]});
await db.images.put({id:'fixture-image',documentId:'fixture',createdAt:0,blob:new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><rect width="400" height="250" fill="#cbd5e1"/><text x="40" y="125" font-size="30">Gambar Penelitian</text></svg>'],{type:'image/svg+xml'})});
await db.documents.put({id:'fixture',title:'Pagination fixture',category:'1',config:{},keywords:{indonesian:[],english:[]}});
await db.chapters.put({id:'fixture.1',content:[
 {type:'heading',attrs:{level:1},content:[{type:'text',text:'Introduction'}]},
 p(sentence.repeat(90)),
 {type:'heading',attrs:{level:2},content:[{type:'text',text:'Metode Penelitian'}]},
 p(sentence.repeat(18)),
 {type:'bulletList',content:[{type:'listItem',content:[p('Satu')]},{type:'listItem',content:[p('Dua')]}]},
 p('Akhir bab.'),
]});
const doc=await new Document('fixture').warm({workspaceIdentity:false});
const chapter=doc.chapters.find(chapter=>chapter.getChapter()==='1');Document.setCurrentChapter(chapter);
window.updates=0;window.layouts=0;window.errors=[];
window.addEventListener('error',event=>window.errors.push(event.message));
window.addEventListener('unhandledrejection',event=>window.errors.push(String(event.reason)));
window.layout=()=>paginationKey.getState(editor.state).layout;
window.layoutReady=()=>!paginationKey.getState(editor.state).pending;
window.setPages=enabled=>editor.commands.setEditorPagination(enabled);
window.failLayout=()=>editor.view.dispatch(editor.state.tr.setMeta(paginationKey,{layout:{breaks:[],pages:1,error:true}}));
window.waitSaved=()=>Storage.instance.waitForChapter(chapter.getId());
window.closeHistory=()=>editor.view.dispatch(closeHistory(editor.state.tr));
window.pageMetrics=EDITOR_PAGE;
window.paginationGeometry=()=>paginationGeometry(paginationKey.getState(editor.state).options);
window.paginationOptions=()=>paginationKey.getState(editor.state).options;
window.prepareComparison=async input=>{await db.chapters.put({id:'fixture.1',content:input.content});await chapter.graph.sync()};
window.measureFresh=()=>measureEditor(editor.view,new FlowCache(),new AbortController().signal,window.paginationGeometry());
window.probeCollapsedMargins=()=>{
 const result=[];
 for(const size of [12,36]) {
  const snapshot=new LayoutSnapshot(editor.view);
  try {
   const [from,element]=Array.from(snapshot.elements.entries()).find(([pos])=>editor.state.doc.nodeAt(pos)?.type.name==='codeBlock');
   const pre=element.querySelector('pre');pre.style.marginTop=size+'px';pre.style.marginBottom=size+'px';
   const reference=Array.from(snapshot.textRuns(from+1,from+editor.state.doc.nodeAt(from).nodeSize-1))[0].from;
   const before=snapshot.charRect(reference).top;
   const effect=snapshot.margin(from,250);
   result.push({size,effect,moved:snapshot.charRect(reference).top-before});
  }finally{snapshot.destroy()}
 }return result;
};
window.probeTableMargins=()=>{
 const snapshot=new LayoutSnapshot(editor.view);
 try {
  const [from,element]=Array.from(snapshot.elements.entries()).find(([pos,element])=>editor.state.doc.nodeAt(pos)?.type.name==='paragraph'&&element.parentElement.matches('td,th'));
  const cell=element.parentElement;
  cell.style.verticalAlign='middle';
  cell.parentElement.style.height='500px';
  const before=element.getBoundingClientRect().top;
  const effect=snapshot.margin(from,250);
  return {moved:element.getBoundingClientRect().top-before,effect};
 }finally{snapshot.destroy()}
};
window.performanceCache=new FlowCache();
window.measureCached=async()=>{
 const measured=performanceCache.measured;const reused=performanceCache.reused;const start=performance.now();
 const result=await measureEditor(editor.view,performanceCache,new AbortController().signal,window.paginationGeometry());
 return {ms:performance.now()-start,measured:performanceCache.measured-measured,reused:performanceCache.reused-reused,pages:result.pages,signature:JSON.stringify(result)};
};
window.sampleTransactions=async count=>{
 const samples=[];let position=0;editor.state.doc.forEach((node,pos)=>{if(!position&&node.type.name==='paragraph')position=pos+1});
 for(let i=0;i<count;i++){
  const start=performance.now();editor.commands.insertContentAt(position,'x');samples.push(performance.now()-start);
  await new Promise(requestAnimationFrame);
 }
 await waitSaved();return samples;
};
window.inPage=element=>{
 const page=document.querySelector('.page').getBoundingClientRect();
 const scale=page.width/EDITOR_PAGE.width;
 const rect=element.getBoundingClientRect();
 const top=(rect.top-page.top)/scale;const bottom=(rect.bottom-page.top)/scale;
 const geometry=window.paginationGeometry();
 const index=Math.floor(top/geometry.stride);
 return {top,bottom,start:index*geometry.stride+geometry.margins.top,end:index*geometry.stride+geometry.height-geometry.margins.bottom};
};
window.textRects=()=>{
 const page=document.querySelector('.page').getBoundingClientRect();
 const scale=page.width/EDITOR_PAGE.width;
 const bad=[];let lines=0;
 for(const paragraph of editor.view.dom.querySelectorAll('p, pre code, h1, h2, h3, h4, figcaption')){
  const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);
  let text;while(text=walker.nextNode()){
   if(text.parentElement.closest('.katex-mathml'))continue;
   const range=document.createRange();range.selectNodeContents(text);
   for(const rect of range.getClientRects()){
    if(!rect.width||!rect.height)continue;lines++;
    const top=(rect.top-page.top)/scale;const bottom=(rect.bottom-page.top)/scale;
    const geometry=window.paginationGeometry();
    const index=Math.floor(top/geometry.stride);
    const start=index*geometry.stride+geometry.margins.top;
    const end=index*geometry.stride+geometry.height-geometry.margins.bottom;
    if(top<start-1||bottom>end+1)bad.push({top,bottom,start,end,text:text.textContent.slice(0,35)});
   }
  }
 }
 return {lines,bad};
};
function Fixture(){
 const editor=useEditor({extensions:[...chapter.extensions.get(),EditorPagination],content:'',editable:false,
  onCreate:async({editor})=>{await events.create({editor,chapter});window.ready=true},
  onUpdate:({editor})=>{window.updates++;void events.update({editor})},
  onTransaction:({transaction})=>{if(transaction.getMeta(paginationKey)?.layout)window.layouts++},
 });
 window.editor=editor;
 return React.createElement(React.Fragment,null,
  React.createElement(PaginationStatus,{editor}),
  React.createElement('div',{className:'page',style:{margin:'20px auto'}},React.createElement(EditorContent,{editor})));
}
const reactRoot=createRoot(document.getElementById('root'));
reactRoot.render(React.createElement(React.StrictMode,null,React.createElement(TooltipProvider,null,React.createElement(${process.env.HIGHTEX_PAGINATION_COMPARE ? "MemoryRouter" : "React.Fragment"},null,React.createElement(Fixture)))));
function ApplicationProbe(){window.applicationEditor=useCurrentEditor().editor;window.navigate=useNavigate();return null}
window.mountApplication=()=>reactRoot.render(
 React.createElement(ConfigContextProvider,null,
  React.createElement(TooltipProvider,null,
   React.createElement(MemoryRouter,{initialEntries:['/document/fixture/1']},
    React.createElement(EditorProvider,null,
     React.createElement(ParamsContextProvider,null,
      React.createElement(ExpandableSideBarContextProvider,null,
       React.createElement(ApplicationProbe),
       React.createElement(Routes,null,React.createElement(Route,{path:'/document/:id/:chapter?',element:React.createElement(ApplicationEditor)})))))))));
window.applicationLayout=()=>paginationKey.getState(applicationEditor.state).layout;
window.applicationChapter=()=>getEditorChapter(applicationEditor)?.getId();
</script>`;
const execute = (code) =>
  win.webContents.executeJavaScript(`(async()=>{${code}})()`);
async function until(code) {
  const deadline = Date.now() + 20000;
  while (!(await execute(`return Boolean(${code})`))) {
    if (Date.now() > deadline) {
      console.error(
        await execute(
          "return {layout:window.editor&&window.layout(),errors:window.errors}",
        ),
      );
      throw Error("Timed out: " + code);
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}
const pause = () => new Promise((resolve) => setTimeout(resolve, 450));
const deadline = setTimeout(() => {
  console.error("Pagination fixture deadline");
  app.exit(1);
}, documentTests ? 900000 : process.env.HIGHTEX_PAGINATION_STRESS || process.env.HIGHTEX_PAGINATION_COMPARE ? 300000 : 120000);
app
  .whenReady()
  .then(async () => {
    const { createServer: createVite } = await import("vite");
    vite = await createVite({
      configFile: false,
      root,
      cacheDir: path.join(artifacts, "vite"),
      plugins: [
        (await import("@vitejs/plugin-react")).default(),
        (await import("@tailwindcss/vite")).default(),
      ],
      resolve: { alias: { "@": path.join(root, "src") } },
      server: { middlewareMode: true, hmr: false },
      logLevel: "error",
    });
    server = createServer(async (req, res) => {
      if (documentTests?.serve(req, res)) return;
      if (req.url === "/comparison-print.html" && process.env.HIGHTEX_PAGINATION_COMPARE) {
        res.setHeader("content-type", "text/html");
        res.end(await vite.transformIndexHtml("/comparison-print.html",require("./editor-pagination-compare.cjs").printHTML));
      } else if (req.url === "/") {
        res.setHeader("content-type", "text/html");
        res.end(await vite.transformIndexHtml("/", html));
      } else if (
        process.env.HIGHTEX_PAGINATION_FONT_RACE &&
        req.url === "/delayed-font.woff2"
      ) {
        setTimeout(() => {
          res.setHeader("content-type", "font/woff2");
          res.end(
            readFileSync(
              path.join(root, "src/assets/fonts/TimesNewRomanPSMT.woff2"),
            ),
          );
        }, 1500);
      } else
        vite.middlewares(req, res, () => {
          res.statusCode = 404;
          res.end();
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    win = new BrowserWindow({
      show: false,
      width: 1100,
      height: 950,
      webPreferences: { backgroundThrottling: false },
    });
    win.webContents.on("console-message", (event) => {
      if (event.level === "error") console.error(event.message);
    });
    win.webContents.on("render-process-gone", (_event, details) => {
      console.error("Fixture renderer gone:", details);
      void finish(1);
    });
    if (documentTests) {
      win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        const url = new URL(details.url);
        callback({ cancel: !['data:', 'blob:', 'devtools:'].includes(url.protocol) && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost' });
      });
    }
    await win.loadURL("http://127.0.0.1:" + server.address().port + "/");
    if (process.env.HIGHTEX_PAGINATION_DEBUG) {
      win.webContents.debugger.attach("1.3");
      await win.webContents.debugger.sendCommand("Debugger.enable");
      win.webContents.debugger.on("message", (_event, method, data) => {
        if (method !== "Debugger.paused") return;
        console.log(
          "Renderer stack:",
          JSON.stringify(
            data.callFrames.slice(0, 8).map((frame) => ({
              name: frame.functionName,
              url: frame.url,
              line: frame.location.lineNumber,
            })),
          ),
        );
        void win.webContents.debugger.sendCommand("Debugger.resume");
      });
      const debugTimer = setInterval(() => {
        if (!win.isDestroyed())
          void win.webContents.debugger
            .sendCommand("Debugger.pause")
            .catch(() => {});
      }, 10000);
      debugTimer.unref();
    }
    await until("window.ready&&window.editor");
    if (documentTests) {
      await documentTests.run({execute,win});
      return;
    }
    if (process.env.HIGHTEX_PAGINATION_FEEDBACK) {
      await require("./editor-pagination-feedback.cjs").runFeedback({execute,until,win,artifacts});
      return;
    }
    if (process.env.HIGHTEX_PAGINATION_COMPARE) {
      await require("./editor-pagination-compare.cjs").runComparison({execute,until,win,artifacts});
      return;
    }
    if (process.env.HIGHTEX_PAGINATION_STRESS) {
      await require("./editor-pagination-stress.cjs").runStress({ execute, until, win, artifacts });
      return;
    }
    if (process.env.HIGHTEX_PAGINATION_CLIPPING) {
      await runClippingReproduction();
      return;
    }
    if (process.env.HIGHTEX_PAGINATION_FONT_RACE) {
      await runFontRace();
      return;
    }
    if (process.env.HIGHTEX_PAGINATION_PERF) {
      await runPerformance();
      return;
    }
    await execute(
      "await document.fonts.ready;window.baseline=JSON.stringify(editor.getJSON());window.savedBaseline=JSON.stringify(await db.chapters.get('fixture.1'));window.startUpdates=updates;window.setPages(true)",
    );
    await until(
      "window.layout().pages>=3&&document.querySelectorAll('.editor-pagination-sheet').length===layout().pages",
    );
    await pause();
    const geometry = await execute("return textRects()");
    console.log(
      "Measured lines:",
      geometry.lines,
      "pages:",
      await execute("return layout().pages"),
    );
    assert.deepEqual(
      geometry.bad,
      [],
      "paragraph text must remain inside content areas",
    );
    assert.equal(
      await execute("return JSON.stringify(editor.getJSON())===baseline"),
      true,
      "pagination changed document JSON",
    );
    assert.equal(
      await execute("return updates===startUpdates"),
      true,
      "pagination triggered autosave",
    );
    assert.equal(
      await execute(
        "return JSON.stringify(await db.chapters.get('fixture.1'))===savedBaseline",
      ),
      true,
    );
    assert.equal(
      await execute(
        "return /data-editor-page-break|editor-pagination/.test(editor.getHTML())",
      ),
      false,
    );
    const before = await execute("return JSON.stringify(layout())");
    console.log("Checkpoint: baseline complete");
    await execute(
      "document.querySelector('.page').style.transform='scale(0.7)'",
    );
    await pause();
    assert.equal(
      await execute("return JSON.stringify(layout())"),
      before,
      "zoom changed pagination",
    );
    assert.deepEqual((await execute("return textRects()")).bad, []);
    await execute(
      "document.querySelector('.page').style.transform='';const pos=layout().breaks.find(item=>item.kind==='line').from;editor.commands.setTextSelection({from:pos-12,to:pos+12});window.selectionBefore=JSON.stringify(editor.state.selection.toJSON());window.setPages(false)",
    );
    await until("!document.querySelector('.editor-pagination-sheet')");
    assert.equal(
      await execute(
        "return JSON.stringify(editor.state.selection.toJSON())===selectionBefore",
      ),
      true,
    );
    await execute("window.setPages(true)");
    console.log("Checkpoint: re-enabled");
    await until(
      "document.querySelector('.editor-pagination-sheet')&&document.querySelector('[data-editor-page-break]')",
    );
    assert.equal(
      await execute(
        "return JSON.stringify(editor.state.selection.toJSON())===selectionBefore",
      ),
      true,
    );
    // Native input at a visual page boundary must still target the model text.
    win.show();
    win.focus();
    win.webContents.focus();
    await execute(
      "closeHistory();window.breakPosition=layout().breaks.find(item=>item.kind==='line').from;editor.commands.setTextSelection(breakPosition);editor.commands.focus()",
    );
    await until(
      "document.activeElement===editor.view.dom&&document.hasFocus()",
    );
    // Showing the native window can restore its old DOM selection after the
    // model selection was set. Establish the test caret after focus settles.
    await execute("editor.view.focus();editor.commands.setTextSelection(breakPosition);await new Promise(requestAnimationFrame)");
    assert.equal(await execute("return editor.state.selection.from"),await execute("return breakPosition"),"native focus changed the test caret before typing");
    await execute("window.nativeBefore={selection:editor.state.selection.toJSON(),dom:window.getSelection()?.anchorOffset,text:editor.state.doc.textContent}");
    await win.webContents.insertText("uji");
    console.log("Checkpoint: native input");
    await pause();
    if (await execute("return editor.state.doc.textBetween(breakPosition,breakPosition+3)!=='uji'")) {
      console.log('Native caret diagnostic:',await execute("const after=editor.state.doc.textContent;let diff=0;while(nativeBefore.text[diff]===after[diff]&&diff<after.length)diff++;return {expected:breakPosition,beforeSelection:nativeBefore.selection,afterSelection:editor.state.selection.toJSON(),diff,inserted:after.slice(diff,diff+12),focused:document.activeElement===editor.view.dom,domOffset:window.getSelection()?.anchorOffset}"));
    }
    assert.equal(
      await execute(
        "return editor.state.doc.textBetween(breakPosition,breakPosition+3)",
      ),
      "uji",
    );
    await execute("closeHistory();editor.commands.undo();await waitSaved()");
    await pause();
    assert.equal(
      await execute("return JSON.stringify(editor.getJSON())===baseline"),
      true,
    );
    // Exercise Chromium's editing beside noneditable widgets repeatedly,
    // including whole-grapheme deletion and the normal undo stack.
    for (let attempt = 0; attempt < 4; attempt++) {
      await until("layoutReady()&&!layout().error");
      await execute("closeHistory();window.breakPosition=layout().breaks.find(item=>item.kind==='line').from;editor.commands.setTextSelection(breakPosition);editor.commands.focus()");
      await win.webContents.insertText("e\u0301");
      win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Backspace" });
      win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Backspace" });
      await until("JSON.stringify(editor.getJSON())===baseline");
      await execute("closeHistory();editor.commands.setTextSelection(breakPosition);editor.commands.focus()");
      await win.webContents.insertText("👩🏽‍💻");
      await execute("editor.commands.setTextSelection(breakPosition)");
      win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Delete" });
      win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Delete" });
      await until("JSON.stringify(editor.getJSON())===baseline");
    }
    console.log("Checkpoint: repeated boundary input and grapheme deletion");
    await execute(
      "closeHistory();editor.commands.focus('end');editor.commands.insertContent(' Tambahan pengujian.');await waitSaved();closeHistory()",
    );
    console.log("Checkpoint: append");
    await pause();
    await execute("editor.commands.undo();await waitSaved()");
    await pause();
    assert.equal(
      await execute("return JSON.stringify(editor.getJSON())===baseline"),
      true,
      "layout transactions entered undo history",
    );
    await execute("window.stableLayouts=layouts");
    await pause();
    assert.equal(
      await execute("return layouts===stableLayouts"),
      true,
      "pagination did not settle",
    );
    await execute(
      "editor.commands.insertContentAt(editor.state.doc.content.size,{type:'codeBlock',content:[{type:'text',text:'oversized\\n'.repeat(70)}]})",
    );
    console.log("Checkpoint: long code inserted");
    await until("layout().pages>=6&&!layout().error");
    if ((await execute("return textRects().bad.length")) > 0)
      console.log(
        "Code layout diagnostic:",
        await execute(
          "const fresh=await measureFresh();return {current:layout().breaks.map(b=>({from:b.from,height:b.height,top:b.top,kind:b.kind})),fresh:fresh.breaks.map(b=>({from:b.from,height:b.height,top:b.top,kind:b.kind})),widgets:Array.from(editor.view.dom.querySelectorAll('[data-editor-page-break]')).map(e=>({height:e.style.height,pos:editor.view.posAtDOM(e,0)}))}",
        ),
      );
    assert.deepEqual((await execute("return textRects()")).bad, []);
    await execute(
      "editor.commands.setContent(JSON.parse(baseline));await waitSaved()",
    );
    await until("layoutReady()&&!layout().error&&layout().pages>=3");
    assert.deepEqual((await execute("return textRects()")).bad, []);
    // Exercise actual React node views, including loaded image dimensions,
    // captions, a small table and inline atoms/marks.
    await execute(`editor.commands.setContent({type:'doc',content:[
      JSON.parse(baseline).content[0],p(sentence.repeat(29)),
      {type:'imageFigure',content:[{type:'image',attrs:{src:'fixture-image',width:400}},{type:'figcaption',content:[{type:'text',text:'Arsitektur Sistem'}]}]},
      makeTable(5),
      {type:'paragraph',content:[{type:'variable',attrs:{name:'title'}},{type:'text',text:sentence.repeat(5),marks:[{type:'italic'}]},{type:'cite',attrs:{cite:citeKey}},{type:'mathInline',attrs:{latex:'E=mc^2'}},{type:'text',text:sentence.repeat(15)}]},
      {type:'heading',attrs:{level:2},content:[{type:'text',text:'Pembahasan'}]},p(sentence.repeat(12)),
    ]});await waitSaved()`);
    await until(
      "document.querySelector('.node-image img')?.complete&&layout().breaks.some(item=>item.kind==='block')",
    );
    await pause();
    assert.equal(await execute("return Boolean(layout().error)"), false);
    const figure = await execute(
      "return inPage(document.querySelector('[data-type=imageFigure]'))",
    );
    assert.ok(
      figure.top >= figure.start - 1 && figure.bottom <= figure.end + 1,
      JSON.stringify(figure),
    );
    const table = await execute(
      "return inPage(document.querySelector('[data-type=figureTable]'))",
    );
    assert.ok(
      table.top >= table.start - 1 && table.bottom <= table.end + 1,
      JSON.stringify(table),
    );
    assert.deepEqual((await execute("return textRects()")).bad, []);
    const tableDisplacement = await execute("return probeTableMargins()");
    assert.ok(Math.abs(tableDisplacement.moved - 250) < 0.05, JSON.stringify(tableDisplacement));
    await execute(
      "editor.commands.insertContentAt(editor.state.doc.content.size,makeTable(60));await waitSaved()",
    );
    await until("layout().furniture?.length>0&&!layout().error");
    assert.deepEqual((await execute("return textRects()")).bad, []);
    assert.equal(
      await execute(
        "return Array.from(document.querySelectorAll('.editor-pagination-furniture')).every(element=>element.querySelector('th')&&element.querySelector('figcaption'))",
      ),
      true,
    );
    await execute(`window.spanTable={type:'figureTable',content:[
      {type:'figcaption',content:[{type:'text',text:'Tabel Gabungan'}]},
      {type:'table',content:[
        {type:'tableRow',content:[{type:'tableHeader',attrs:{rowspan:2},content:[p('Kelompok')]},{type:'tableHeader',attrs:{colspan:2},content:[p('Hasil')]}]},
        {type:'tableRow',content:[{type:'tableHeader',content:[p('Awal')]},{type:'tableHeader',content:[p('Akhir')]}]},
        {type:'tableRow',content:[{type:'tableCell',attrs:{rowspan:3},content:[p(sentence.repeat(80))]},{type:'tableCell',content:[p('B1')]},{type:'tableCell',content:[p('C1')]}]},
        {type:'tableRow',content:[{type:'tableCell',attrs:{colspan:2},content:[p(sentence.repeat(35))]}]},
        {type:'tableRow',content:[{type:'tableCell',content:[p('B3')]},{type:'tableCell',content:[p('C3')]}]},
        ...Array.from({length:25},(_,row)=>({type:'tableRow',content:[0,1,2].map(column=>({type:'tableCell',content:[row%3===0?{type:'paragraph'}:p('Data '+row+'/'+column)]}))})),
      ]}
    ]};
    editor.commands.setContent({type:'doc',content:[JSON.parse(baseline).content[0],spanTable,p('Sesudah tabel')]});await waitSaved()`);
    await until("layoutReady()&&!layout().error&&layout().furniture?.length>0");
    assert.deepEqual((await execute("return textRects()")).bad, []);
    assert.equal(
      await execute(
        "return editor.getText().includes(sentence.repeat(80).trim())",
      ),
      true,
    );
    console.log("Checkpoint: rowspan and tall cell");
    await execute(`window.innerTable=makeTable(45);innerTable.content[0].content[0].text='Tabel Bagian Dalam';
      window.outerTable={type:'figureTable',content:[{type:'figcaption',content:[{type:'text',text:'Tabel Bagian Luar'}]},{type:'table',content:[
        {type:'tableRow',content:[{type:'tableHeader',content:[p('Struktur')]},{type:'tableHeader',content:[p('Penjelasan')]}]},
        {type:'tableRow',content:[{type:'tableCell',content:[p('Sebelum tabel'),innerTable,p('Sesudah tabel')]},{type:'tableCell',content:[p(sentence.repeat(60))]}]},
      ]}]};editor.commands.setContent({type:'doc',content:[JSON.parse(baseline).content[0],outerTable,p('Akhir')]});await waitSaved()`);
    await until("layoutReady()&&!layout().error&&layout().pages>=3");
    assert.deepEqual((await execute("return textRects()")).bad,[],"nested table ink crosses a page margin");
    console.log("Checkpoint: nested tables");
    await execute(`outerTable.content[1].content[1].content[0].content[0]=p(sentence.repeat(30));
      editor.commands.setContent({type:'doc',content:[JSON.parse(baseline).content[0],outerTable,p('Akhir')]});await waitSaved()`);
    await until("layoutReady()");
    assert.equal(await execute("return Boolean(layout().error)"),false,"nested table with a paginated prelude failed");
    assert.deepEqual((await execute("return textRects()")).bad,[],"nested table after a long paragraph crosses a page margin");
    console.log("Checkpoint: nested table after a paginated paragraph");
    await execute(`editor.commands.setContent({type:'doc',content:[JSON.parse(baseline).content[0],
      {type:'orderedList',attrs:{start:4},content:[{type:'listItem',content:[p('Tabel di dalam daftar'),makeTable(45),p('Sesudah tabel')]}]},
      p('Selesai')]});await waitSaved()`);
    await until("layoutReady()");
    assert.equal(await execute("return Boolean(layout().error)"),false,"table inside a list failed");
    assert.deepEqual((await execute("return textRects()")).bad,[],"table nested in a list crosses a page margin");
    console.log("Checkpoint: split table inside a list");
    await execute(`window.listFixture={type:'orderedList',attrs:{start:7},content:Array.from({length:8},(_,index)=>({type:'listItem',content:[
      p('Butir '+index+' '+sentence.repeat(18)),
      {type:'orderedList',attrs:{start:3},content:[{type:'listItem',content:[p(sentence.repeat(12))]}]},
    ]}))};editor.commands.setContent({type:'doc',content:[JSON.parse(baseline).content[0],listFixture,p('Sesudah daftar')]});await waitSaved()`);
    await until("layoutReady()&&!layout().error&&layout().pages>=5");
    assert.deepEqual((await execute("return textRects()")).bad, []);
    assert.equal(
      await execute("return editor.getJSON().content[1].attrs.start"),
      7,
    );
    assert.equal(
      await execute(
        "return editor.getJSON().content[1].content[0].content[1].attrs.start",
      ),
      3,
    );
    console.log("Checkpoint: nested numbered lists");
    await execute(`editor.commands.setContent({type:'doc',content:[JSON.parse(baseline).content[0],
      {type:'paragraph',content:Array.from({length:90},(_,i)=>[{type:'text',text:'Baris '+i},{type:'hardBreak'}]).flat()},
      {type:'paragraph',content:[{type:'text',text:sentence.repeat(20)},{type:'mathInline',attrs:{latex:String.raw\`\\dfrac{\\sum_{i=1}^{100}x_i^2}{\\sqrt{1+x^2}}\`}},{type:'text',text:sentence.repeat(20)}]},
      {type:'paragraph'},p('Akhir'),
    ]});await waitSaved();await document.fonts.ready`);
    await until("layoutReady()&&!layout().error&&layout().pages>=4");
    assert.deepEqual((await execute("return textRects()")).bad,[]);
    console.log("Checkpoint: hard breaks and tall inline math");
    await execute(`window.transitionFixture={type:'doc',content:[JSON.parse(baseline).content[0],...Array.from({length:35},(_,i)=>[
      p('Sebelum daftar '+i+' '+sentence.repeat(6+i%4)),
      {type:'orderedList',attrs:{start:i+1},content:[{type:'listItem',content:[p('Butir pertama '+i)]},{type:'listItem',content:[p('Butir kedua '+i)]}]},
      {type:'heading',attrs:{level:2},content:[{type:'text',text:'Bagian '+i}]},
      {type:'codeBlock',content:[{type:'text',text:['const a = 1;','const b = a + 1;','console.log(b);'].join(String.fromCharCode(10))}]},
      p('Sesudah blok '+i+' '+sentence.repeat(i%3+1)),
    ]).flat()]};editor.commands.setContent(transitionFixture);await waitSaved()`);
    await until("layoutReady()&&!layout().error&&layout().pages>=10");
    const transitionInk=await execute("return textRects()");
    if(transitionInk.bad.length){
      await execute("const page=document.querySelector('.page');window.scrollTo(0,scrollY+page.getBoundingClientRect().top+textRects().bad[0].top-160)");
      await pause();
      writeFileSync(path.join(artifacts,'clipped-node-transition.png'),(await win.webContents.capturePage()).toPNG());
      console.log('Clipping reproduction:',artifacts,transitionInk.bad.slice(0,4));
    }
    assert.deepEqual(transitionInk.bad,[],"glyphs are clipped at paragraph/list/code transitions");
    console.log("Checkpoint: paragraph/list/code transitions");
    await execute("editor.commands.setContent({type:'doc',content:[JSON.parse(baseline).content[0],...codeListFixture(45)]});await waitSaved()");
    await until("layoutReady()");
    assert.equal(await execute("return Boolean(layout().error)"),false);
    assert.deepEqual((await execute("return textRects()")).bad,[],"collapsed margins cause cumulative clipping after code/list boundaries");
    console.log("Checkpoint: nested code/list margin-collapse regression");
    await execute(`window.inkFixture={type:'doc',content:[JSON.parse(baseline).content[0],...Array.from({length:120},(_,i)=>({type:'paragraph',content:[
      ...(i%3===0?[]:[{type:'text',text:'ÅÉỆgyp '+sentence.repeat(i%4+1),marks:[{type:i%2?'italic':'bold'}]}]),
      {type:'mathInline',attrs:{latex:String.raw\`\\dfrac{\\sum_{i=1}^{100}x_i^2}{\\sqrt{1+x^2}}\`}},
      {type:'text',text:' '+sentence.repeat(2)},
    ]}))]};editor.commands.setContent(inkFixture);await waitSaved();await document.fonts.ready`);
    await until("layoutReady()&&!layout().error&&layout().pages>=10");
    assert.deepEqual((await execute("return textRects()")).bad,[],"visible glyph ink intersects a page margin");
    console.log("Checkpoint: accented/italic text and fraction ink at page boundaries");
    await execute(`window.forcedFixture={type:'doc',content:[JSON.parse(baseline).content[0],p('Sebelum pemisah'),{type:'horizontalRule'},p('Halaman baru'),
      {type:'orderedList',attrs:{start:5},content:[{type:'listItem',content:[p('Awal butir'),{type:'horizontalRule'},p('Lanjutan butir')]}]},
      {type:'figureTable',content:[{type:'figcaption',content:[{type:'text',text:'Pemisah dalam tabel'}]},{type:'table',content:[
        {type:'tableRow',content:[{type:'tableHeader',content:[p('Kolom')]}]},
        {type:'tableRow',content:[{type:'tableCell',content:[p('Awal sel'),{type:'horizontalRule'},p('Lanjutan sel')]}]},
      ]}]},p('Selesai')]};editor.commands.setContent(forcedFixture);await waitSaved()`);
    await until("layoutReady()");
    assert.equal(await execute("return Boolean(layout().error)"),false);
    assert.equal(await execute("return layout().pages"),4);
    assert.deepEqual((await execute("return textRects()")).bad,[],"forced page break clips visible text");
    assert.equal(await execute("return layout().furniture.length"),1);
    console.log("Checkpoint: explicit page breaks in paragraphs, lists and table cells");
    await execute(
      "editor.commands.setContent(JSON.parse(baseline));await waitSaved()",
    );
    await until("layoutReady()&&!layout().error&&layout().pages>=3");
    await execute(
      "const page=document.querySelector('.page');window.scrollTo(0,scrollY+page.getBoundingClientRect().top+pageMetrics.height-240)",
    );
    await execute("document.documentElement.classList.add('dark')");
    await pause();
    writeFileSync(
      path.join(artifacts, "pagination-dark.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await execute("document.documentElement.classList.remove('dark')");
    await pause();
    writeFileSync(
      path.join(artifacts, "pagination-light.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    // Mount the production editor and exercise its real settings switch and
    // chapter lifecycle, in addition to the isolated layout assertions above.
    await execute("window.mountApplication()");
    await until(
      "window.applicationEditor?.isEditable&&document.querySelector('#page')?.hidden===false&&document.querySelector('button[title=Settings]')",
    );
    assert.equal(
      await execute(
        "return !!document.querySelector('.editor-pagination-sheet')",
      ),
      false,
    );
    await execute("document.querySelector('button[title=Settings]').click()");
    await until("document.querySelector('[role=switch]')");
    await execute(
      "const label=Array.from(document.querySelectorAll('label')).find(element=>element.textContent==='Page view (experimental)');label.parentElement.parentElement.querySelector('[role=switch]').click()",
    );
    await until(
      "document.querySelectorAll('.editor-pagination-sheet').length>=3",
    );
    assert.equal(
      await execute("return window.config.get().editor.pagination"),
      true,
    );
    await execute(
      "window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await db.chapters.put({id:'fixture.foreword',content:[p(sentence.repeat(55))]});window.navigate('/document/fixture/foreword')",
    );
    await until(
      "window.applicationEditor?.isEditable&&applicationChapter()==='fixture.foreword'&&applicationLayout().pages>=2&&document.querySelector('#page')?.hidden===false&&document.querySelectorAll('.editor-pagination-sheet').length===applicationLayout().pages",
    );
    assert.equal(
      await execute(
        "return document.querySelectorAll('.editor-pagination-sheets').length",
      ),
      1,
      "old chapter retained page chrome",
    );
    await execute("await window.config.set({editor:{pagination:false}})");
    await until(
      "!document.querySelector('.editor-pagination-sheet')&&!document.querySelector('[data-pagination-status]')",
    );
    assert.deepEqual(await execute("return errors"), []);
    console.log(
      "PASS: glyph bounds, paragraphs/lists/code, split and nested tables, merged cells, explicit breaks, zoom, selection, native input, undo, persistence, serialization and production editor lifecycle.",
    );
    console.log("Artifacts:", artifacts);
  })
  .then(
    () => finish(0),
    (error) => {
      console.error(error);
      finish(1);
    },
  );
async function finish(code) {
  clearTimeout(deadline);
  if (win && !win.isDestroyed()) win.destroy();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (vite) await vite.close();
  app.exit(code);
}

async function runPerformance() {
  win.show(); win.focus(); win.webContents.focus();
  await execute("editor.commands.setContent({type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'Performance'}]},...Array.from({length:400},(_,i)=>p('Paragraf '+i+' '+sentence.repeat(3))),makeTable(60)]});await waitSaved();await document.fonts.ready;window.performanceInput=editor.getJSON()");
  const plain = await execute("return sampleTransactions(40)");
  await execute("window.setPages(true)");
  await until("layoutReady()&&!layout().error&&layout().pages>20");
  const paginated = await execute("return sampleTransactions(40)");
  await until("layoutReady()&&!layout().error");
  const cold = await execute("return measureCached()");
  const warm = await execute("return measureCached()");
  assert.equal(warm.signature,cold.signature,"cached layout differs from a fresh measurement");
  assert.equal(warm.measured,0,"unchanged paragraphs were remeasured");
  await execute("editor.commands.insertContentAt(editor.state.doc.child(0).nodeSize+1,'x');await waitSaved()");
  const edited = await execute("return measureCached()");
  const fresh = await execute("return JSON.stringify(await measureFresh())");
  assert.equal(edited.signature,fresh,"incremental measurements differ after editing");
  assert.ok(edited.measured<=3,JSON.stringify({remeasured:edited.measured}));
  await until("layoutReady()");
  assert.deepEqual((await execute("return textRects()")).bad,[],"long-chapter glyph bounds drift across page edges");
  const stats = samples => {
    const sorted=[...samples].sort((a,b)=>a-b);
    return {median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};
  };
  const nativeInput = async (enabled) => {
    await execute(`window.setPages(false);editor.commands.setContent(performanceInput);await waitSaved();window.setPages(${enabled})`);
    await until("layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')");
    await execute("editor.commands.focus();editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize+1)");
    await until("document.activeElement===editor.view.dom&&document.hasFocus()");
    await execute("editor.view.focus();editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize+1);await new Promise(requestAnimationFrame);window.nativeInputBefore=editor.getJSON()");
    const burst=[],paced=[];
    for(const [samples,count,delay] of [[burst,30,0],[paced,20,170]]) {
      for(let index=0;index<count;index++) {
        const start=performance.now();
        await win.webContents.insertText('x');
        await execute('await new Promise(requestAnimationFrame)');
        samples.push(performance.now()-start);
        if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      }
    }
    await execute('await waitSaved()');
    await until("layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')");
    assert.equal(await execute("const expected=structuredClone(nativeInputBefore);expected.content[1].content[0].text='x'.repeat(50)+expected.content[1].content[0].text;return JSON.stringify(editor.getJSON())===JSON.stringify(expected)"),true,'native input dropped or changed text');
    if(enabled)assert.deepEqual((await execute('return textRects()')).bad,[],'native typing caused page-boundary clipping');
    return {burst:{...stats(burst),samples:burst},paced:{...stats(paced),samples:paced}};
  };
  const native={plain:await nativeInput(false),paginated:await nativeInput(true)};
  const report={platform:process.platform,versions:process.versions,plain:stats(plain),paginated:stats(paginated),cold:{ms:cold.ms,measured:cold.measured,pages:cold.pages},warm:{ms:warm.ms,measured:warm.measured,reused:warm.reused},edited:{ms:edited.ms,measured:edited.measured,reused:edited.reused},native,
    protocol:'400 paragraphs and 60 table rows. Native insertText to next animation frame includes IPC; 30 burst and 20 paced inputs per mode. Paced inputs wait 170 ms between samples. Same chapter JSON restored per mode. Timing is diagnostic, not an acceptance threshold or physical keyboard-to-paint measurement.'};
  writeFileSync(path.join(artifacts,'performance-report.json'),JSON.stringify(report,null,2));
  console.log('PERFORMANCE',JSON.stringify({...report,versions:undefined,native:Object.fromEntries(Object.entries(native).map(([mode,values])=>[mode,Object.fromEntries(Object.entries(values).map(([kind,value])=>[kind,{median:value.median,p95:value.p95,max:value.max}]))]))}));
  console.log('Performance report:',path.join(artifacts,'performance-report.json'));
  await execute("window.setPages(false)");
  await until("!document.querySelector('[data-pagination-measure]')&&!document.querySelector('.editor-pagination-sheet')");
  console.log('PASS: performance comparison, cache equivalence, single-paragraph invalidation and cancellation cleanup.');
}

async function runFontRace() {
  await execute("await document.fonts.ready");
  await execute(`const style=document.createElement('style');
    style.textContent='@font-face{font-family:"Delayed Pagination";src:url("/delayed-font.woff2") format("woff2");font-weight:400}';
    document.head.append(style);
    document.querySelector('.page').style.fontFamily='"Delayed Pagination", serif';
    window.delayedFont=document.fonts.load('12pt "Delayed Pagination"')`);
  await until("document.fonts.status==='loading'");
  await execute("window.setPages(true)");
  await pause();
  assert.equal(
    await execute("return layoutReady()"),
    false,
    "pagination must stay pending while the document font is loading",
  );
  await execute("await delayedFont");
  await until("layoutReady()&&!layout().error&&layout().pages>=3");
  await pause();
  assert.deepEqual(
    (await execute("return textRects()")).bad,
    [],
    "glyphs must remain inside page content after the delayed font loads",
  );
  const settled = await execute("return JSON.stringify(layout())");
  await pause();
  assert.equal(
    await execute("return JSON.stringify(layout())"),
    settled,
    "font completion must leave pagination stable",
  );
  console.log("PASS: pagination waits for delayed fonts and settles without clipping.");
}

async function runClippingReproduction() {
  await execute("await document.fonts.ready;window.heading=editor.getJSON().content[0];window.setPages(true)");
  const cases = [
    ['plain lists', `Array.from({length:70},(_,i)=>[
      p(('Contoh paragraf '+i+' '+sentence).repeat(1+i%11)),
      {type:i%2?'orderedList':'bulletList',content:[{type:'listItem',content:[p(sentence.repeat(1+i%5)),p('Paragraf kedua '+sentence)]},{type:'listItem',content:[p('Terakhir '+sentence.repeat(2))]}]},
      p('Sesudah daftar '+sentence.repeat(2+i%7))]).flat()`],
    ['code inside list items', 'codeListFixture(45)'],
    ['hard breaks and lists', `Array.from({length:60},(_,i)=>[
      {type:'paragraph',content:Array.from({length:5+i%8},(_,j)=>[{type:'text',text:'Baris '+j+' '+sentence.slice(0,20+i%40)},{type:'hardBreak'}]).flat()},
      {type:'orderedList',content:[{type:'listItem',content:[p(sentence.repeat(i%8+1))]}]}]).flat()`],
    ['nested lists', `Array.from({length:60},(_,i)=>[
      p(sentence.repeat(i%7+1)),{type:'orderedList',content:[{type:'listItem',content:[p('Pembuka '+sentence),{type:'bulletList',content:[{type:'listItem',content:[p(sentence.repeat(i%11+1))]}]},p('Penutup '+sentence)]}]}]).flat()`],
    ['blockquote transitions', `Array.from({length:80},(_,i)=>[
      p(sentence.repeat(i%5+1)),{type:'blockquote',content:[p(sentence.repeat(i%7+1)),p('Di dalam kutipan '+sentence)]},p('Berikutnya '+sentence)]).flat()`],
    ['short line and whitespace boundaries', `Array.from({length:180},(_,i)=>p(('Kata   pendek '+i+' '+String.fromCharCode(10)+' dengan spasi '+sentence).repeat(1+i%9)))`],
    ['tables after variable preludes', `Array.from({length:35},(_,i)=>[
      p(sentence.repeat(1+i%12)),makeTable(2+i%8),p('Sesudah tabel '+sentence.repeat(i%7+1))]).flat()`],
    ['figures and captions inside lists', `Array.from({length:25},(_,i)=>[
      p(sentence.repeat(1+i%9)),{type:'bulletList',content:[{type:'listItem',content:[p('Gambar '+i),
        {type:'imageFigure',content:[{type:'image',attrs:{src:'fixture-image',width:400}},{type:'figcaption',content:[{type:'text',text:'Keterangan '+i}]}]},
        p('Sesudah gambar '+sentence.repeat(2))]}]},p(sentence.repeat(2))]).flat()`],
  ];
  for (const [label, content] of cases) {
    await execute(`editor.commands.setContent({type:'doc',content:[heading,...(${content})]});await waitSaved()`);
    await until("layoutReady()");
    assert.equal(await execute("return Boolean(layout().error)"),false,label+' layout failed');
    assert.ok(await execute("return layout().pages>1"),label+' did not exercise multiple pages');
    const geometry = await execute("return textRects()");
    if (geometry.bad.length) {
      writeFileSync(path.join(artifacts,'clipping.json'),JSON.stringify(await execute("return {doc:editor.getJSON(),layout:layout(),geometry:textRects()}"),null,2));
      await execute("const page=document.querySelector('.page');window.scrollTo(0,scrollY+page.getBoundingClientRect().top+textRects().bad[0].top-160)");
      await pause();
      writeFileSync(path.join(artifacts,'clipping.png'),(await win.webContents.capturePage()).toPNG());
      console.log('Clipping artifacts:',artifacts);
    }
    assert.equal(geometry.bad.length,0,label+' glyphs cross the page edge; first: '+JSON.stringify(geometry.bad.slice(0,3)));
    if (label === 'code inside list items') {
      const displacements = await execute("return probeCollapsedMargins()");
      for (const item of displacements) {
        assert.ok(Math.abs(item.moved-250)<0.05,JSON.stringify(item));
        assert.ok(item.effect.height>250,'collapsed descendant margin was not accounted for');
      }
      console.log('PASS: actual block displacement with 12px and 36px collapsed margins',JSON.stringify(displacements));
    }
    console.log('PASS clipping reproduction:',label,await execute("return layout().pages"),'pages');
  }
}
