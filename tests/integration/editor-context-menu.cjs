// Isolated React/Tiptap UI with a temporary profile and fixture image database.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");

const artifacts = mkdtempSync(path.join(os.tmpdir(), "hightex-context-menu-"));
const hoverOnly = process.argv.includes("--hover-only");
app.setPath("userData", artifacts);
app.disableHardwareAcceleration();
let vite, server, win;
const deadline = setTimeout(() => {
  console.error("Context menu fixture exceeded 60 seconds");
  app.exit(1);
}, 60000);
deadline.unref();

const html = `<!doctype html><html><body style="background:#eef0f2;padding:24px">
<div id="controls"></div><div class="page" style="padding:32px;width:740px;min-height:600px"><div id="editor"></div></div>
<script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Editor} from '@tiptap/core';
import {EditorContent} from '@tiptap/react';
import {ChapterExtensions} from '/src/editor/chapter/chapter-extensions.ts';
import {Document} from '/src/editor/document/index.ts';
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {EditorContextMenu} from '/src/editor/context-menu/index.tsx';
import {ContextMenuPopup} from '/src/components/context-menu.tsx';
import {useContextMenuStore,closeContextMenu} from '/src/hooks/use-context-menu.tsx';
import {TooltipProvider} from '/src/components/ui/tooltip.tsx';
import {setCurrentLanguage} from '/src/utils/lang.ts';
import '/src/App.css';
import '/src/css/editor.css';
window.config={get:()=>({language:'id',editor:{}})};
setCurrentLanguage('id');
Document.instance={id:'context-fixture'};
const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
const context=canvas.getContext('2d');context.fillStyle='#4285f4';context.fillRect(0,0,320,180);
context.fillStyle='#34a853';context.fillRect(0,0,100,180);
const blob=await new Promise(resolve=>canvas.toBlob(resolve));
await HighTexDB.getInstance().images.put({id:'fixture-image',blob,documentId:'context-fixture',createdAt:0});
const text=value=>({type:'text',text:value});
const paragraph=(id,value)=>({type:'paragraph',attrs:{id},content:[text(value)]});
const image=id=>({type:'image',attrs:{id,src:'fixture-image',width:320}});
const figure=(id,caption)=>({type:'imageFigure',attrs:{id,figureId:id},content:[image(id+'-image'),{type:'figcaption',attrs:{id:id+'-caption'},content:[{...text(caption),marks:[{type:'italic'}]}]}]});
window.editor=new Editor({element:document.createElement('div'),extensions:ChapterExtensions.contentSchema('attachment'),content:{type:'doc',content:[
  paragraph('before','Keep this paragraph'),figure('first','Caption first'),paragraph('middle','Between figures'),figure('second','Caption second'),
  image('plain'),{type:'heading',attrs:{id:'heading',level:2},content:[{...text('Heading target'),marks:[{type:'bold'}]}]},
  {type:'bulletList',attrs:{id:'list'},content:[{type:'listItem',attrs:{id:'item'},content:[paragraph('item-text','List target')]}]},
  {type:'table',attrs:{id:'table'},content:[{type:'tableRow',content:[{type:'tableCell',content:[paragraph('cell','Cell target')]},{type:'tableCell',content:[paragraph('cell-two','Second cell')]}]}]},
  paragraph('end','End'),
]}});
const root=createRoot(document.getElementById('editor'));
root.render(React.createElement(TooltipProvider,null,React.createElement(EditorContent,{editor}),React.createElement(ContextMenuPopup)));
window.previews=[];window.inspections=[];
window.connectMenu=()=>window.handler=new EditorContextMenu(editor,{preview:id=>previews.push(id)});
window.menu=useContextMenuStore;
window.closeMenu=closeContextMenu;
window.frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
window.rightClick=async selector=>{
  const element=document.querySelector(selector);element.scrollIntoView({block:'center'});
  await frame();
  const rect=element.getBoundingClientRect();
  const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:rect.left+Math.min(10,rect.width/2),clientY:rect.top+rect.height/2});
  element.dispatchEvent(event);
  window.lastContext={prevented:event.defaultPrevented,root:handler.root===editor.view.dom,selection:editor.state.selection.toJSON(),visible:menu.getState().visible};
};
window.ready=true;
</script></body></html>`;

const execute = code => win.webContents.executeJavaScript(code, true);
async function until(code) {
  const limit = Date.now() + 10000;
  while (!await execute(`Boolean(${code})`)) {
    if (Date.now() > limit) throw Error(`Timed out: ${code}`);
    await new Promise(resolve => setTimeout(resolve, 30));
  }
}
async function clickAction(label) {
  await execute(`(() => {
    const item=[...document.querySelectorAll('[data-editor-context-menu] button')].find(item=>item.textContent.trim()===${JSON.stringify(label)});
    if(!item)throw Error('Missing action: '+${JSON.stringify(label)});item.click();
  })()`);
}

app.whenReady().then(async () => {
  const project = path.resolve(__dirname, "../..");
  const { createServer: createVite } = await import("vite");
  vite = await createVite({
    configFile: false, root: project, cacheDir: path.join(artifacts, "vite"),
    plugins: [(await import("@vitejs/plugin-react")).default(), (await import("@tailwindcss/vite")).default()],
    resolve: { alias: { "@": path.join(project, "src") } },
    server: { middlewareMode: true, hmr: false }, logLevel: "error",
  });
  server = createServer(async (request, response) => {
    if (request.url === "/") {
      response.setHeader("content-type", "text/html");
      response.end(await vite.transformIndexHtml("/", html));
    } else vite.middlewares(request, response, () => { response.writeHead(404); response.end(); });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  win = new BrowserWindow({ show: false, width: 1024, height: 860, webPreferences: { contextIsolation: true, backgroundThrottling: false } });
  const errors = [];
  win.webContents.on("console-message", event => {
    if (event.level === "error") { errors.push(event.message); console.error(event.message); }
  });
  await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
  await until("window.ready && document.querySelector('#second-image img') && document.querySelector('#first button')");
  await until("document.querySelector('#first-image').dataset.imageStatus==='ready'");
  await execute("connectMenu();undefined");
  const before = await execute("JSON.stringify(editor.getJSON())");

  if (!hoverOnly) {
    await execute("editor.commands.setTextSelection({from:1,to:5});rightClick('#second-image img')");
    await until("document.querySelector('[data-editor-context-menu]')");
    assert(await execute("menu.getState().items.some(item=>item.label==='Ubah menjadi gambar biasa')"));
    assert.equal(await execute("JSON.stringify(editor.getJSON())"), before, "opening a context menu preserves source");
    await clickAction("Ubah menjadi gambar biasa");
    await until("!document.querySelector('#second')");
    assert(await execute("!!document.querySelector('#first') && document.querySelector('#second-image img') && !document.querySelector('#second-caption') && document.querySelector('#before').textContent==='Keep this paragraph'"));
    await execute("editor.commands.undo()");
    await until("document.querySelector('#second figcaption')");
    assert.equal(await execute("JSON.stringify(editor.getJSON())"), before);

    await execute("rightClick('#first-caption em')");
    await until("document.querySelector('[data-editor-context-menu]')");
    await clickAction("Ubah menjadi gambar biasa");
    assert(await execute("!document.querySelector('#first') && !!document.querySelector('#second')"));
    await execute("editor.commands.undo();closeMenu()");

    await execute("rightClick('#plain img')");
    await until("document.querySelector('[data-editor-context-menu]')");
    assert(!await execute("menu.getState().items.some(item=>item.label==='Ubah menjadi gambar biasa')"));
    await clickAction("Hapus gambar");
    assert(await execute("!document.querySelector('#plain') && document.querySelector('#before').textContent==='Keep this paragraph'"));
    await execute("editor.commands.undo();closeMenu()");

    await execute("rightClick('#heading strong')");
    assert(await execute("menu.getState().items.some(item=>item.label==='Heading 3')"));
    await clickAction("Heading 3");
    assert.equal(await execute("document.querySelector('#heading').tagName"), "H3");
    await execute("editor.commands.undo();rightClick('#cell')");
    assert(await execute("menu.getState().items.some(item=>item.label==='Tambah baris setelah ini')"));
    await clickAction("Tambah baris setelah ini");
    assert.equal(await execute("editor.getJSON().content.find(node=>node.type==='table').content.length"), 2);
    await execute("editor.commands.undo();closeMenu();rightClick('#item-text')");
    assert(await execute("menu.getState().items.some(item=>item.label==='Kurangi indentasi item')"));
    await execute("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));frame()");
    assert(!await execute("menu.getState().visible"));
  }

  await execute("document.querySelector('#first').scrollIntoView({block:'center'});frame()");
  const figurePoint = await execute("(()=>{const rect=document.querySelector('#first').getBoundingClientRect();return {x:Math.round(rect.left+rect.width/2),y:Math.round(rect.top+rect.height/2)}})()");
  win.webContents.sendInputEvent({ type: "mouseMove", ...figurePoint });
  await execute("frame()");
  const trigger = await execute("(()=>{const rect=document.querySelector('#first button[aria-label=\"Aksi node\"]').getBoundingClientRect();return {x:Math.round(rect.left+rect.width/2),y:Math.round(rect.top+rect.height/2),width:rect.width,height:rect.height}})()");
  assert(trigger.width > 0 && trigger.height > 0, "hover reveals the figure action trigger");
  win.webContents.sendInputEvent({ type: "mouseMove", x: trigger.x, y: trigger.y });
  win.webContents.sendInputEvent({ type: "mouseDown", x: trigger.x, y: trigger.y, button: "left", clickCount: 1 });
  win.webContents.sendInputEvent({ type: "mouseUp", x: trigger.x, y: trigger.y, button: "left", clickCount: 1 });
  await until("document.querySelector('[data-slot=dropdown-menu-content] [role=menuitem]')");
  await execute("Promise.all(document.querySelector('[data-slot=dropdown-menu-content]').getAnimations({subtree:true}).map(animation=>animation.finished)).then(()=>undefined)");
  const geometry = await execute(`(() => {
    const menu=document.querySelector('[data-slot=dropdown-menu-content]');
    const item=[...menu.querySelectorAll('[role=menuitem]')].find(item=>item.textContent==='Ubah menjadi gambar biasa');
    const span=item.querySelector('span'),rect=span.getBoundingClientRect(),style=getComputedStyle(span);
    return {width:menu.getBoundingClientRect().width,labelHeight:rect.height,lineHeight:parseFloat(style.lineHeight),fontSize:style.fontSize,portalled:!menu.closest('.page')};
  })()`);
  assert(geometry.portalled && geometry.width >= 256 && geometry.labelHeight <= geometry.lineHeight * 1.1, JSON.stringify(geometry));
  const sourceBeforeHover = await execute("JSON.stringify(editor.getJSON())");
  const menuPoint = await execute("(()=>{const rect=document.querySelector('[data-slot=dropdown-menu-content] [role=menuitem]').getBoundingClientRect();return {x:Math.round(rect.left+rect.width/2),y:Math.round(rect.top+rect.height/2)}})()");
  win.webContents.sendInputEvent({ type: "mouseMove", ...menuPoint });
  const hoverSamples = await execute(`(async()=>{
    const samples=[];
    for(let frame=0;frame<16;frame++) {
      await new Promise(requestAnimationFrame);
      const trigger=document.querySelector('#first button[aria-label="Aksi node"]').getBoundingClientRect();
      const menu=document.querySelector('[data-slot=dropdown-menu-content]').getBoundingClientRect();
      samples.push({triggerWidth:trigger.width,triggerHeight:trigger.height,x:menu.x,y:menu.y,width:menu.width,height:menu.height});
    }
    return samples;
  })()`);
  writeFileSync(path.join(artifacts, "menu-hover.json"), JSON.stringify(hoverSamples, null, 2));
  console.log(JSON.stringify({
    samples: hoverSamples.length,
    anchorVisible: hoverSamples.every(sample => sample.triggerWidth > 0 && sample.triggerHeight > 0),
    menuPositions: [...new Set(hoverSamples.map(sample => JSON.stringify([sample.x, sample.y, sample.width, sample.height])))],
    artifacts,
  }));
  assert(hoverSamples.every(sample => sample.triggerWidth > 0 && sample.triggerHeight > 0), "the anchor remains visible while the pointer is inside the portalled menu");
  assert.equal(new Set(hoverSamples.map(sample => JSON.stringify([sample.x, sample.y, sample.width, sample.height]))).size, 1, "the open menu stays in one position while hovering its items");
  assert.equal(await execute("JSON.stringify(editor.getJSON())"), sourceBeforeHover, "menu hover preserves source");
  writeFileSync(path.join(artifacts, "figure-menu.png"), (await win.webContents.capturePage()).toPNG());
  await execute("[...document.querySelectorAll('[data-slot=dropdown-menu-content] [role=menuitem]')].find(item=>item.textContent==='Ubah menjadi gambar biasa').click()");
  await until("!document.querySelector('#first')");
  assert(await execute("!document.querySelector('#first-caption') && !!document.querySelector('#first-image img') && !!document.querySelector('#second')"));
  await execute("editor.commands.undo();closeMenu()");
  assert.equal(await execute("JSON.stringify(editor.getJSON())"), before, "undo restores the figure and its caption");
  if (hoverOnly) {
    await execute("rightClick('#second-caption em')");
    await until("document.querySelector('[data-editor-context-menu]')");
    await clickAction("Ubah menjadi gambar biasa");
    assert(await execute("!document.querySelector('#second') && !document.querySelector('#second-caption') && !!document.querySelector('#second-image img') && !!document.querySelector('#first')"));
    await execute("editor.commands.undo();closeMenu()");
    assert.equal(await execute("JSON.stringify(editor.getJSON())"), before);
  }
  await execute("(async()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await frame();handler.destroy();await rightClick('#first-image img');await frame()})()");
  assert(!await execute("menu.getState().visible"), "destroy removes the handler");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "PASS", scope: hoverOnly ? "portalled menu hover stability, unwrap/undo and cleanup" : "image/caption targeting, unwrap/undo, plain image deletion, heading/list/table actions, menu layout and cleanup", geometry, artifacts }));
}).then(async () => {
  clearTimeout(deadline); win?.destroy(); server?.close(); await vite?.close(); app.exit(0);
}).catch(async error => {
  console.error(error);
  if (win && !win.isDestroyed())
    console.error(await execute("JSON.stringify({last:window.lastContext,menu:window.menu?.getState().visible,body:document.body.innerText.slice(0,800)})").catch(() => ""));
  clearTimeout(deadline); win?.destroy(); server?.close(); await vite?.close(); app.exit(1);
});
