// Real archive comparison and editor-schema rendering against an isolated database.
const { app, BrowserWindow, ipcMain } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const artifacts = mkdtempSync(path.join(os.tmpdir(), "hightex-comparison-"));
app.setPath("userData", artifacts);
let vite, server, win, writer;
let failFlush = false;
let exitCode = 0;
const flushes = [];
const preload = path.join(artifacts, "preload.cjs");
writeFileSync(
  preload,
  "const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('editor',{flush:id=>ipcRenderer.invoke('fixture:flush',id)});",
);
setTimeout(() => {
  console.error("Comparison integration deadline exceeded");
  app.exit(1);
}, 90000).unref();
const html = `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {useEditor,EditorContent} from '@tiptap/react';import {ChapterExtensions} from '/src/editor/chapter/chapter-extensions.ts';
import {BranchComparisonDialog} from '/src/components/editor/branch-comparison-dialog.tsx';
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {compareDocumentBranch} from '/src/editor/storage/document-comparison.ts';import {Chapter} from '/src/editor/chapter/chapter.ts';import {Document} from '/src/editor/document/index.ts';
import '/src/App.css';
window.activeChapter={getChapter:()=>"1"};window.activeDocument={id:'branch'};Chapter.instance=window.activeChapter;Document.instance=window.activeDocument;window.globalsIntact=()=>Chapter.instance===window.activeChapter&&Document.instance===window.activeDocument;
window.config={get:()=>({language:'en'})};window.profile={get:async()=>({name:'Writer',nim:'001',advisorName:'Advisor',advisorNip:'002',cv:'',isCloud:false}),picture:async()=>false};
const db=HighTexDB.getInstance();await db.open();window.db=db;
const doc={id:'main',title:'Main title',altTitle:'',category:'1',keywords:{indonesian:[],english:[]},config:{}};
await db.documents.bulkPut([doc,{...doc,id:'branch',parentId:'main',branchName:'Revision',title:'Branch title'}]);
const text=(text,marks)=>({type:'text',text,...(marks?{marks}: {})});
const p=(id,...content)=>({type:'paragraph',attrs:{id},content});
const heading={type:'heading',attrs:{level:1,id:'head'},content:[text('Pendahuluan')]};
const image={type:'imageFigure',attrs:{id:'figure',figureId:'figure'},content:[{type:'image',attrs:{src:'main-image',width:320}},{type:'figcaption',content:[text('Diagram sistem')]}]};
const table={type:'figureTable',attrs:{id:'table',figureId:'table'},content:[{type:'figcaption',content:[text('Hasil pengujian')]},{type:'table',content:[{type:'tableRow',content:[{type:'tableHeader',attrs:{rowspan:2,colwidth:[100],align:'center'},content:[p('no',text('No.'))]},{type:'tableHeader',attrs:{colspan:2,align:'center'},content:[p('group',text('Kolom'))]}]},{type:'tableRow',content:[{type:'tableCell',content:[p('sub-a',text('Bagian A'))]},{type:'tableCell',content:[p('sub-b',text('Bagian B'))]}]},{type:'tableRow',content:[{type:'tableCell',content:[p('v1',text('1'))]},{type:'tableCell',content:[p('v2',text('Isi tabel'))]},{type:'tableCell',content:[p('v3',text('Hasil'))]}]}]}]};
const list={type:'orderedList',attrs:{start:3},content:[{type:'listItem',content:[p('li1',text('Butir pertama'))]},{type:'listItem',content:[p('li2',text('Butir kedua'))]}]};
const nodes=[heading,p('intro',text('Main paragraph ',[{type:'bold'}]),text('italic ',[{type:'italic'}]),{type:'variable',attrs:{name:'name'}},text(' '),{type:'cite',attrs:{cite:'main-cite'}},text(' note',[{type:'note',attrs:{note:'Note content'}}])),list,table,image,{type:'blockMath',attrs:{latex:'E=mc^2'}},p('inline',text('Inline '),{type:'mathInline',attrs:{latex:'x^2'}}),p('long',text('Long paragraph. '.repeat(100)))];
const revised=structuredClone(nodes);revised[1].content[0].text='Branch paragraph ';revised[1].content[4].attrs.cite='branch-cite';revised[4].content[0].attrs.src='branch-image';
await db.chapters.bulkPut([{id:'main.1',content:nodes},{id:'branch.1',content:revised},{id:'main.2',content:[p('format',text('Same words',[{type:'italic'}]))]},{id:'branch.2',content:[p('format',text('Same words',[{type:'bold'}]))]},{id:'main.3',content:[p('removed',text('Removed chapter'))]},{id:'branch.4',content:[p('added',text('Added chapter'))]}]);
const canvas=document.createElement('canvas');canvas.width=320;canvas.height=100;const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,320,100);context.strokeStyle='#334155';context.lineWidth=2;context.strokeRect(10,20,110,60);context.strokeRect(200,20,110,60);context.beginPath();context.moveTo(120,50);context.lineTo(200,50);context.lineTo(188,42);context.moveTo(200,50);context.lineTo(188,58);context.stroke();context.fillStyle='#0f172a';context.font='18px serif';context.fillText('Input',45,55);context.fillText('Output',225,55);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
await db.images.bulkPut([{id:'main-image',documentId:'main',blob,createdAt:0},{id:'branch-image',documentId:'branch',blob,createdAt:0}]);
const bib='@article{shared,author={Example, Jane},title={Reference},year={2025},journal={Journal}}';
await db.cite.bulkPut([{key:'main-cite',documentId:'main',bib},{key:'branch-cite',documentId:'branch',bib}]);
window.capture=async()=>JSON.stringify({documents:await db.documents.toArray(),chapters:await db.chapters.toArray(),cites:await db.cite.toArray(),variables:await db.documentVariables.toArray(),aliases:await db.aliases.toArray(),images:await Promise.all((await db.images.toArray()).map(async image=>({...image,blob:[...new Uint8Array(await image.blob.arrayBuffer())]})))});
window.original=await window.capture();window.comparison=await compareDocumentBranch('branch');
function TableEditor(){const editor=useEditor({extensions:ChapterExtensions.contentSchema('1'),content:{type:'doc',content:[table]},editable:true});window.tableEditor=editor;return React.createElement('div',{className:'page',id:'editor-table-proof',style:{position:'fixed',left:'-10000px',top:0}},React.createElement(EditorContent,{editor}))};
function Fixture(){const [open,setOpen]=React.useState(true);window.reopen=()=>setOpen(true);return React.createElement(React.Fragment,null,React.createElement(TableEditor),React.createElement(BranchComparisonDialog,{open,onOpenChange:setOpen,branchId:'branch'}))};
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(Fixture)));
</script></body></html>`;
const writerHTML = `<!doctype html><html><body><div id="editor"></div><script type="module">
import {Editor} from '@tiptap/core';import StarterKit from '@tiptap/starter-kit';import {HighTexDB} from '/src/editor/storage/hightex-db.ts';import {Storage} from '/src/editor/storage/index.ts';
const db=HighTexDB.getInstance();await db.open();let pending;
window.writerEditor=new Editor({element:document.getElementById('editor'),extensions:[StarterKit],content:{type:'doc',content:(await db.chapters.get('main.3')).content},onUpdate:({editor})=>{pending=editor.getJSON().content}});
window.edit=text=>window.writerEditor.commands.setContent({type:'doc',content:[{type:'paragraph',attrs:{id:'removed'},content:[{type:'text',text}]}]});
window.flush=async()=>{if(pending){await Storage.instance.setChapter({id:'main.3',content:pending});pending=undefined;}};
window.autoEdit=async text=>{window.edit(text);await window.flush();};
window.ready=true;
</script></body></html>`;
const execute = async (code) => {
  try {
    return await win.webContents.executeJavaScript(code, true);
  } catch (error) {
    throw new Error(`Renderer evaluation failed: ${code.slice(0, 240)}`, {
      cause: error,
    });
  }
};
async function until(code) {
  const end = Date.now() + 30000;
  while (!(await execute(`Boolean(${code})`))) {
    if (Date.now() > end) throw Error("Timed out: " + code);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
app
  .whenReady()
  .then(async () => {
    const { createServer: createVite } = await import("vite");
    const react = (await import("@vitejs/plugin-react")).default;
    const tailwind = (await import("@tailwindcss/vite")).default;
    const project = path.resolve(__dirname, "../..");
    vite = await createVite({
      configFile: false,
      root: project,
      cacheDir: path.join(artifacts, "vite"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": path.join(project, "src") } },
      server: { middlewareMode: true, hmr: false },
      logLevel: "error",
    });
    server = createServer(async (req, res) => {
      if (req.url === "/" || req.url === "/writer") {
        res.setHeader("content-type", "text/html");
        res.end(
          await vite.transformIndexHtml(
            req.url,
            req.url === "/writer" ? writerHTML : html,
          ),
        );
      } else
        vite.middlewares(req, res, () => {
          res.writeHead(404);
          res.end();
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    ipcMain.handle("fixture:flush", async (_, id) => {
      flushes.push(id);
      if (failFlush) throw Error("Fixture editor is still loading");
      if (id === "main" && writer)
        await writer.webContents.executeJavaScript("window.flush()");
    });
    win = new BrowserWindow({
      show: false,
      width: 1500,
      height: 1000,
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    win.webContents.on("console-message", (event) => {
      if (event.level === "error") console.error(event.message);
    });
    await win.loadURL("http://127.0.0.1:" + server.address().port + "/");
    await until(
      `document.querySelectorAll('[data-comparison-side] .tiptap table').length===2 && document.querySelectorAll('[data-comparison-side] img[src^="blob:"]').length===2`,
    );
    assert.equal(
      await execute(
        `window.comparison.sections.find(section=>section.key==='chapters').entries.length`,
      ),
      4,
    );
    assert.equal(
      await execute(
        `document.querySelectorAll('[data-compare-change]').length`,
      ),
      2,
      "Only the changed paragraph should be highlighted; remapped image/cite IDs match",
    );
    assert.equal(
      await execute(
        `Boolean(document.querySelector('[data-comparison-side] [contenteditable="true"]'))`,
      ),
      false,
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-side=main] strong').textContent`,
      ),
      "Main paragraph ",
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-side=branch] strong').textContent`,
      ),
      "Branch paragraph ",
    );
    assert.equal(
      await execute(`document.querySelectorAll('.katex').length`),
      4,
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-side=main] .katex-html').textContent.includes('E')`,
      ),
      true,
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-side=main] figure[data-type="imageFigure"] figcaption').dataset.label`,
      ),
      "Gambar 1.1",
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-side=main] .tiptap').textContent.includes('Writer')`,
      ),
      true,
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-side=main] cite').textContent.includes('2025')`,
      ),
      true,
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-side=main] abbr').title`,
      ),
      "Note content",
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-side=main] ol').start`,
      ),
      3,
    );
    assert.equal(
      await execute(
        `document.querySelectorAll('[data-comparison-side=main] td.table-header-like').length`,
      ),
      2,
    );
    await until(
      `document.querySelectorAll('#editor-table-proof td.table-header-like').length===2`,
    );
    assert.equal(
      await execute(
        `getComputedStyle(document.querySelector('#editor-table-proof table')).borderCollapse`,
      ),
      "collapse",
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('#editor-table-proof th,#editor-table-proof .table-header-like')).every(cell=>getComputedStyle(cell).borderBottomWidth==='1px' && getComputedStyle(cell).borderBottomStyle==='solid')`,
      ),
      true,
      "The actual live editor also draws bottom borders for headers and grouped cells",
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('[data-comparison-side] th,[data-comparison-side] .table-header-like')).every(cell=>getComputedStyle(cell).borderBottomWidth==='1px' && getComputedStyle(cell).borderBottomStyle==='solid')`,
      ),
      true,
      "Headers and header-like cells have visible bottom borders",
    );
    await execute(`document.documentElement.classList.add('dark')`);
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('[data-comparison-side] th,[data-comparison-side] .table-header-like')).every(cell=>getComputedStyle(cell).borderBottomWidth==='1px' && getComputedStyle(cell).borderBottomStyle==='solid')`,
      ),
      true,
      "Header borders remain visible in dark mode",
    );
    await execute(`document.documentElement.classList.remove('dark')`);
    assert.equal(
      await execute(
        `getComputedStyle(document.querySelector('[data-comparison-side=main] .tiptap > p')).textIndent`,
      ),
      "48px",
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-side=main] .page').offsetWidth`,
      ),
      794,
    );
    await until(
      `document.querySelector('[data-comparison-side=main]').scrollHeight>700`,
    );
    await execute(
      `(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))})()`,
    );
    writeFileSync(
      path.join(artifacts, "comparison.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await execute(
      `document.querySelector('[aria-label="Next change"]').click()`,
    );
    await until(
      `document.body.textContent.includes('The chapter structure or formatting changed')`,
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-side=main] em').textContent`,
      ),
      "Same words",
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-side=branch] strong').textContent`,
      ),
      "Same words",
    );
    await execute(
      `document.querySelector('[aria-label="Next change"]').click()`,
    );
    await until(
      `document.body.textContent.includes('Removed chapter') && document.querySelectorAll('[data-comparison-side]').length===1`,
    );
    await execute(
      `document.querySelector('[aria-label="Next change"]').click()`,
    );
    await until(
      `document.body.textContent.includes('Added chapter') && document.querySelectorAll('[data-comparison-side]').length===1`,
    );
    await execute(
      `document.querySelector('[aria-label="Next change"]').click()`,
    );
    await until(`document.querySelector('[data-comparison-entry] pre')`);
    assert.equal(
      await execute(
        `document.querySelector('[data-comparison-entry]').textContent.includes('Branch title')`,
      ),
      true,
    );
    await win.setSize(500, 900);
    await until(`document.querySelector('select[aria-label="Changes"]')`);
    await execute(
      `const select=document.querySelector('select[aria-label="Changes"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'0');select.dispatchEvent(new Event('change',{bubbles:true}))`,
    );
    await until(
      `document.querySelectorAll('[data-comparison-side] table').length===2`,
    );
    assert.equal(
      await execute(`document.documentElement.scrollWidth<=innerWidth`),
      true,
    );
    assert.equal(
      await execute(`(async()=>await window.capture()===window.original)()`),
      true,
      "Comparison never writes documents, content or assets",
    );
    await execute(
      `document.querySelector('[aria-label="Next change"]').click();[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Close').click()`,
    );
    await until(`!document.querySelector('[role=dialog]')`);
    await execute(`window.reopen()`);
    await until(
      `document.querySelectorAll('[data-comparison-side] table').length===2`,
    );
    assert.equal(
      await execute("window.globalsIntact()"),
      true,
      "Comparison never replaces the active document/chapter globals",
    );
    assert(
      flushes.includes("main") && flushes.includes("branch"),
      "Existing windows flush before snapshots are captured",
    );
    writer = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    writer.webContents.on("console-message", (event) => {
      if (event.level === "error") console.error("Writer:", event.message);
    });
    await writer.loadURL(
      "http://127.0.0.1:" + server.address().port + "/writer",
    );
    await writer.webContents.executeJavaScript(
      "(async()=>{const end=Date.now()+10000;while(!window.ready){if(Date.now()>end)throw Error('Writer did not load');await new Promise(resolve=>setTimeout(resolve,30));}})()",
    );
    await writer.webContents.executeJavaScript(
      "window.autoEdit('Edited in Main window')",
    );
    await until("document.querySelector('[data-comparison-stale]')");
    await execute(
      "(()=>{const select=document.querySelector('select[aria-label=\"Changes\"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'2');select.dispatchEvent(new Event('change',{bubbles:true}))})()",
    );
    await until(
      "document.querySelector('[data-comparison-entry]').textContent.includes('Removed chapter')",
    );
    assert.equal(
      await execute(
        "document.querySelector('[data-comparison-entry]').textContent.includes('Edited in Main window')",
      ),
      false,
      "Current snapshot stays stable while another window edits the source",
    );
    await execute(
      "document.querySelector('[data-comparison-stale] button').click()",
    );
    await until(
      "document.querySelectorAll('[data-comparison-side] table').length===2 && !document.querySelector('[data-comparison-stale]')",
    );
    await execute(
      "(()=>{const select=document.querySelector('select[aria-label=\"Changes\"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'2');select.dispatchEvent(new Event('change',{bubbles:true}))})()",
    );
    await until(
      "document.querySelector('[data-comparison-entry]').textContent.includes('Edited in Main window')",
    );
    await writer.webContents.executeJavaScript(
      "window.edit('Pending edit in existing editor')",
    );
    await execute("document.querySelector('[aria-label=\"Refresh\"]').click()");
    await until(
      "document.querySelectorAll('[data-comparison-side] table').length===2 && !document.querySelector('[data-comparison-stale]')",
    );
    await execute(
      "(()=>{const select=document.querySelector('select[aria-label=\"Changes\"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'2');select.dispatchEvent(new Event('change',{bubbles:true}))})()",
    );
    await until(
      "document.querySelector('[data-comparison-entry]').textContent.includes('Pending edit in existing editor')",
    );
    assert.equal(
      await writer.webContents.executeJavaScript(
        "window.writerEditor.getText()",
      ),
      "Pending edit in existing editor",
    );
    assert.equal(await execute("window.globalsIntact()"), true);
    // A branch edit also invalidates the snapshot without replacing the displayed DOM.
    await execute(
      "(async()=>{const chapter=await window.db.chapters.get('branch.4');chapter.content[0].content[0].text='Branch edited elsewhere';await window.db.chapters.put(chapter)})()",
    );
    await until("document.querySelector('[data-comparison-stale]')");
    await execute(
      "document.querySelector('[data-comparison-stale] button').click()",
    );
    await until(
      "document.querySelectorAll('[data-comparison-side] table').length===2 && !document.querySelector('[data-comparison-stale]')",
    );
    const baseline = await execute("window.capture()");
    failFlush = true;
    await execute("document.querySelector('[aria-label=\"Refresh\"]').click()");
    await until(
      "[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Retry')",
    );
    assert.equal(
      await execute("window.capture()"),
      baseline,
      "Unready editors fail comparison without overwriting any chapter with placeholders",
    );
    failFlush = false;
    await execute(
      "[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Retry').click()",
    );
    await until(
      "document.querySelectorAll('[data-comparison-side] table').length===2",
    );
    console.log(
      "PASS: cross-window Main and Branch changes mark a stable snapshot stale; refresh flushes the existing editor and includes pending input; globals remain unchanged; an unready editor fails safely without data loss.",
    );
    console.log(
      "PASS: actual archive comparison; editor schema and styles; text marks, notes, tables, images, lists, math, citations and variables; block highlights; formatting-only/add/remove navigation; responsive UI; source preservation; reopen.",
    );
    console.log("Artifacts:", artifacts);
  })
  .catch((error) => {
    console.error(error);
    exitCode = 1;
  })
  .finally(async () => {
    writer?.destroy();
    win?.destroy();
    server?.closeAllConnections();
    await vite?.close();
    await new Promise((resolve) =>
      server ? server.close(resolve) : resolve(),
    );
    app.exit(exitCode);
  });
