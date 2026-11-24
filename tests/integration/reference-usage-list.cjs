// Real reference lists and editor buffers; temporary database, no user documents.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const artifacts = mkdtempSync(path.join(os.tmpdir(), "hightex-reference-usage-"));
app.setPath("userData", artifacts);
app.disableHardwareAcceleration();
let vite, server, win;
const deadline = setTimeout(() => { console.error("Usage fixture deadline"); app.exit(1); }, 60000);
deadline.unref();
const key = "local_a_internal_cite31";
const html = `<!doctype html><html><body style="padding:24px"><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {Editor} from '@tiptap/core';import {EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';import {Cite} from '/src/editor/extensions/citation/index.ts';
import {events} from '/src/editor/event/index.ts';
import {Citation as Library} from '/src/pages/citation.tsx';
import {Citation as Sidebar} from '/src/components/editor/expandable-items/citation.tsx';
import {SnapshotReferenceList} from '/src/components/citation/snapshot-reference-list.tsx';
import {EditorContext} from '/src/hooks/use-editor.tsx';
import {ConfigContextProvider} from '/src/context/config-context.tsx';
import {ConfirmProvider} from '/src/context/confrim-context.tsx';
import {MultiSelectProvider} from '/src/context/multi-select-context.tsx';
import {ParamsContextProvider} from '/src/hooks/use-params.tsx';
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {ReferenceRepository} from '/src/editor/storage/reference-repository.ts';
import {tabs} from '/src/hooks/use-expandable-sidebar.tsx';
import {plugins} from 'citation-js';import locale from '/src/assets/locales-id-ID.xml?raw';
import '/src/App.css';
plugins.config.get('@csl').locales.add('id-ID',locale);
const config={language:'id',theme:'light',editor:{},zotero:{enabled:false,host:'localhost',port:23119}};
window.config={get:()=>config,ready:async()=>config,onChange:()=>()=>{}};
window.flushes=0;window.editor={has:async()=>true,flush:async()=>{window.flushes++;throw Error('Usage must not flush')}};
const key='${key}';
const db=window.db=HighTexDB.getInstance();await db.open();
await db.cite.clear();
await db.documents.bulkPut([{id:'a',title:'Thesis A'},{id:'b',title:'Thesis B'}]);
await db.cite.bulkPut([
 {key,bib:'@book{different-bib-key,title={Readable Research},author={Writer, Alice},year={2026}}'},
 {key:'other',bib:'@book{other,title={Other Research},author={Author, Bob},year={2025}}'},
 {key:'unused',bib:'@book{unused,title={Unused Research},author={Author, Bob},year={2024}}'},
]);
const heading=text=>({type:'heading',attrs:{level:1},content:[{type:'text',text}]});
const paragraph=(cite,text)=>({type:'paragraph',content:[{type:'text',text},{type:'cite',attrs:{cite}}]});
await db.chapters.bulkPut([
 {id:'a.1',content:[heading('Introduction'),paragraph(key+'|other|'+key,'Research evidence ')]},
 {id:'a.2',content:[heading('Method'),paragraph(key,'Analysis ')]},
 {id:'b.1',content:[heading('Results'),paragraph(key,'Secondary evidence ')]},
]);
window.storedBefore=JSON.stringify(await db.chapters.toArray());
const editing=window.editing=new Editor({element:document.createElement('div'),extensions:[StarterKit,Cite],content:{type:'doc',content:(await db.chapters.get('a.1')).content}});
await events.create({editor:editing,chapter:{getId:()=> 'a.1',getDocumentId:()=> 'a',getContent:async()=> (await db.chapters.get('a.1')).content,document:{}}});
window.snapshot={references:Object.fromEntries((await db.cite.toArray()).map(record=>[record.key,record.bib])),chapters:await db.chapters.where('id').startsWith('a.').toArray()};
window.navigations=[];window.sidebarTabs=Object.keys(tabs);
const root=createRoot(document.getElementById('root'));let revision=0;
window.show=kind=>{
 const content=kind==='editor'?React.createElement('div',{style:{display:'flex',gap:24,height:'95vh'}},
  React.createElement('div',{style:{width:380}},React.createElement(EditorContent,{editor:editing})),
  React.createElement('div',{style:{width:360}},React.createElement(Sidebar)))
  :kind==='snapshot'?React.createElement('div',{style:{maxWidth:520}},React.createElement(SnapshotReferenceList,{snapshot,onNavigate:location=>navigations.push(location)}))
  :React.createElement(Library);
 root.render(React.createElement(ConfigContextProvider,null,React.createElement(MemoryRouter,{key:++revision,initialEntries:[kind==='editor'?'/document/a/1':'/library']},
  React.createElement(ConfirmProvider,null,React.createElement(MultiSelectProvider,null,React.createElement(ParamsContextProvider,null,
   React.createElement(EditorContext.Provider,{value:{editor:kind==='editor'?editing:null,setEditor:()=>{}}},
    React.createElement(Routes,null,React.createElement(Route,{path:kind==='editor'?'/document/:id/:chapter':'*',element:content})))))))));
};
const original=ReferenceRepository.prototype.usageChapters;
ReferenceRepository.prototype.usageChapters=function(...args){if(window.failUsage)return Promise.reject(Error('Fixture read failure'));return original.apply(this,args)};
window.show('library');window.ready=true;
</script></body></html>`;
const execute = code => win.webContents.executeJavaScript(`(async()=>await eval(${JSON.stringify(code)}))()`, true);
async function until(code) {
  const limit = Date.now() + 10000;
  while (!await execute(`Boolean(${code})`)) {
    if (Date.now() > limit) throw Error(`Timed out: ${code}`);
    await new Promise(resolve => setTimeout(resolve, 30));
  }
}
const row = `[data-citation-key="${key}"]`;
const count = value => `${row} [data-citation-usage="${value}"]`;
const clickUsage = () => execute(`document.querySelector(${JSON.stringify(row + ' [data-slot=collapsible-trigger]')}).click()`);

app.whenReady().then(async () => {
  const project = path.resolve(__dirname, "../..");
  const { createServer: createVite } = await import("vite");
  vite = await createVite({ configFile: false, root: project, cacheDir: path.join(artifacts, "vite"),
    plugins: [(await import("@vitejs/plugin-react")).default(), (await import("@tailwindcss/vite")).default()],
    resolve: { alias: { "@": path.join(project, "src") } }, server: { middlewareMode: true, hmr: false }, logLevel: "error" });
  server = createServer(async (request, response) => {
    if (request.url === "/") { response.setHeader("content-type", "text/html"); response.end(await vite.transformIndexHtml("/", html)); }
    else vite.middlewares(request, response, () => { response.writeHead(404); response.end(); });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  win = new BrowserWindow({ show: false, width: 1100, height: 900, webPreferences: { contextIsolation: true, backgroundThrottling: false } });
  const errors = [];
  win.webContents.on("console-message", event => { if (event.level === "error") { errors.push(event.message); console.error(event.message); } });
  await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
  await until(`window.ready && document.querySelector(${JSON.stringify(count(3))})`);
  assert(!await execute("window.sidebarTabs.includes('usage')"));
  assert(!await execute(`document.body.innerText.includes(${JSON.stringify(key)})`));
  assert(await execute("document.body.innerText.includes('Readable Research')"));
  await clickUsage();
  await until(`document.querySelector(${JSON.stringify(row)}).innerText.includes('Thesis B')`);
  assert(await execute(`document.querySelector(${JSON.stringify(row)}).innerText.includes('Introduction')`));
  writeFileSync(path.join(artifacts, "workspace.png"), (await win.webContents.capturePage()).toPNG());

  await execute("show('editor')");
  await until(`document.querySelector(${JSON.stringify(count(2))})`);
  await execute(`editing.commands.insertContentAt(editing.state.doc.content.size-1,{type:'cite',attrs:{cite:${JSON.stringify(key)}}})`);
  await until(`document.querySelector(${JSON.stringify(count(3))})`);
  assert.equal(await execute("db.chapters.toArray().then(value=>JSON.stringify(value))"), await execute("storedBefore"));
  await clickUsage();
  await until(`document.querySelector(${JSON.stringify(row + ' [data-slot=collapsible-content] button')})`);
  assert(!await execute(`document.querySelector(${JSON.stringify(row)}).innerText.includes('Thesis B')`));
  const source = await execute("JSON.stringify(editing.getJSON())");
  await execute(`[...document.querySelectorAll(${JSON.stringify(row + ' [data-slot=collapsible-content] button')})].find(button=>button.innerText.includes('Introduction')).click()`);
  assert.equal(await execute("editing.state.selection.node?.type.name"), "cite");
  assert.equal(await execute("JSON.stringify(editing.getJSON())"), source);
  writeFileSync(path.join(artifacts, "editor.png"), (await win.webContents.capturePage()).toPNG());

  await execute("show('snapshot')");
  await until(`document.querySelector(${JSON.stringify(count(2))})`);
  assert(!await execute("document.body.innerText.includes('Edit nama penulis')"));
  await clickUsage();
  await until(`document.querySelector(${JSON.stringify(row + ' [data-slot=collapsible-content] button')})`);
  await execute(`document.querySelector(${JSON.stringify(row + ' [data-slot=collapsible-content] button')}).click()`);
  assert.equal(await execute("navigations[0].chapterId"), "a.1");

  await execute("window.failUsage=true;show('library')");
  await until("document.body.innerText.includes('Pemakaian referensi belum dapat dibaca')");
  assert(!await execute(`!!document.querySelector(${JSON.stringify(count(0))})`));
  await execute(`window.failUsage=false;[...document.querySelectorAll(${JSON.stringify(row + ' button')})].find(button=>button.textContent.trim()==='Coba lagi').click()`);
  await until(`document.querySelector(${JSON.stringify(count(3))})`);
  assert.equal(await execute("window.flushes"), 0);
  assert.equal(await execute("db.chapters.toArray().then(value=>JSON.stringify(value))"), await execute("storedBefore"));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "PASS", scope: "workspace/editor/snapshot reference rows, scoped counts, unsaved buffer, source navigation, read failure/retry and no writes/flush", artifacts }));
}).then(async () => { clearTimeout(deadline); win?.destroy(); server?.close(); await vite?.close(); app.exit(0); })
.catch(async error => {
  console.error(error);
  if (win && !win.isDestroyed()) console.error(await execute("document.body.innerText.slice(0,1800)").catch(() => ""));
  clearTimeout(deadline); win?.destroy(); server?.close(); await vite?.close(); app.exit(1);
});
