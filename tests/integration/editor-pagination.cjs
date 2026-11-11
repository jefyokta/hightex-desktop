// Isolated real Tiptap editor, persistence and native Chromium layout.
// env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/editor-pagination.cjs
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const artifacts = mkdtempSync(path.join(os.tmpdir(), "hightex-pagination-"));
app.setPath("userData", artifacts);
app.disableHardwareAcceleration();
let vite, server, win;
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
window.config={get:()=>structuredClone(config),onChange:callback=>{configListeners.add(callback);return ()=>configListeners.delete(callback)},set:async patch=>{Object.assign(config,patch);for(const callback of configListeners)callback(structuredClone(config));return structuredClone(config)}};
window.hightex={categories:async()=>[{id:1,name:'Fixture',variant:'thesis',chapters:[{chapter:'1',title:'Introduction'}]}],cloud:{academic:{locked:async()=>false}}};
window.session={onChange:()=>()=>{}};
window.profile={get:async()=>({name:'Writer',nim:'001',cv:'',advisorName:'Advisor',advisorNip:'002',isCloud:false}),picture:async()=>false};
const db=HighTexDB.getInstance();await db.open();window.db=db;
window.citeKey=(await db.cite.toCollection().first()).key;
const p=text=>({type:'paragraph',content:[{type:'text',text}]});
const sentence='Penelitian ini menjelaskan hubungan antara kebutuhan pengguna dan hasil pengujian sistem. ';
window.p=p;window.sentence=sentence;
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
window.setPages=enabled=>editor.commands.setEditorPagination(enabled);
window.waitSaved=()=>Storage.instance.waitForChapter(chapter.getId());
window.closeHistory=()=>editor.view.dispatch(closeHistory(editor.state.tr));
window.pageMetrics=EDITOR_PAGE;
window.inPage=element=>{
 const page=document.querySelector('.page').getBoundingClientRect();
 const scale=page.width/EDITOR_PAGE.width;
 const rect=element.getBoundingClientRect();
 const top=(rect.top-page.top)/scale;const bottom=(rect.bottom-page.top)/scale;
 const index=Math.floor(top/(EDITOR_PAGE.height+EDITOR_PAGE.gap));
 return {top,bottom,start:index*(EDITOR_PAGE.height+EDITOR_PAGE.gap)+EDITOR_PAGE.margin,end:index*(EDITOR_PAGE.height+EDITOR_PAGE.gap)+EDITOR_PAGE.height-EDITOR_PAGE.margin};
};
window.textRects=()=>{
 const page=document.querySelector('.page').getBoundingClientRect();
 const scale=page.width/EDITOR_PAGE.width;
 const bad=[];let lines=0;
 for(const paragraph of document.querySelectorAll('.tiptap > p')){
  const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);
  let text;while(text=walker.nextNode()){
   const range=document.createRange();range.selectNodeContents(text);
   for(const rect of range.getClientRects()){
    if(!rect.width||!rect.height)continue;lines++;
    const top=(rect.top-page.top)/scale;const bottom=(rect.bottom-page.top)/scale;
    const index=Math.floor(top/(EDITOR_PAGE.height+EDITOR_PAGE.gap));
    const start=index*(EDITOR_PAGE.height+EDITOR_PAGE.gap)+EDITOR_PAGE.margin;
    const end=index*(EDITOR_PAGE.height+EDITOR_PAGE.gap)+EDITOR_PAGE.height-EDITOR_PAGE.margin;
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
reactRoot.render(React.createElement(React.StrictMode,null,React.createElement(TooltipProvider,null,React.createElement(Fixture))));
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
}, 120000);
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
      if (req.url === "/") {
        res.setHeader("content-type", "text/html");
        res.end(await vite.transformIndexHtml("/", html));
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
    await win.loadURL("http://127.0.0.1:" + server.address().port + "/");
    await until("window.ready&&window.editor");
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
    await execute(
      "closeHistory();window.breakPosition=layout().breaks.find(item=>item.kind==='line').from;editor.commands.setTextSelection(breakPosition);editor.commands.focus()",
    );
    await win.webContents.insertText("uji");
    await pause();
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
    await execute(
      "closeHistory();editor.commands.focus('end');editor.commands.insertContent(' Tambahan pengujian.');await waitSaved();closeHistory()",
    );
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
    await until(
      "layout().unsupported&&!document.querySelector('.editor-pagination-sheet')",
    );
    assert.equal(
      await execute(
        "return document.querySelector('[data-pagination-status]').textContent.includes('continuous view')",
      ),
      true,
    );
    await execute(
      "editor.commands.setContent(JSON.parse(baseline));await waitSaved()",
    );
    await until("!layout().unsupported&&layout().pages>=3");
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
    assert.equal(await execute("return layout().unsupported"), false);
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
    await execute(
      "editor.commands.insertContentAt(editor.state.doc.content.size,makeTable(60));await waitSaved()",
    );
    await until(
      "layout().unsupported&&!document.querySelector('.editor-pagination-sheet')",
    );
    await execute(
      "editor.commands.setContent(JSON.parse(baseline));await waitSaved()",
    );
    await until("!layout().unsupported&&layout().pages>=3");
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
      "PASS: multi-page paragraphs, zoom, selection, toggle, JSON/HTML, persistence, autosave, undo, image/caption, tables, inline atoms, oversized-block fallback, recovery and dark mode.",
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
