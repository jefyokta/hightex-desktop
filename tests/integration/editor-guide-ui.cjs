// Opt-in Electron UI check with an isolated profile and fixture document.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const profile = mkdtempSync("/private/tmp/hightex-editor-guide-");
app.setPath("userData", profile);
let vite, server, win;
const html = `<!doctype html><html><body style="margin:0"><main id="root"></main><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,Outlet,useNavigate,useLocation} from 'react-router-dom';
import {Editor} from '/src/pages/editor.tsx';
import {EditorGuide} from '/src/components/editor/editor-guide.tsx';
import {EditorChrome} from '/src/components/editor/editor-chrome.tsx';
import {ExpandableSideBar} from '/src/components/editor/expandable-sidebar.tsx';
import {ExpandableSideBarContextProvider} from '/src/hooks/use-expandable-sidebar.tsx';
import {EditorProvider,useCurrentEditor} from '/src/hooks/use-editor.tsx';
import {ParamsContextProvider,useParams} from '/src/hooks/use-params.tsx';
import {ConfigContextProvider} from '/src/context/config-context.tsx';
import {TooltipProvider} from '/src/components/ui/tooltip.tsx';
import {EditorNavigatorSlave} from '/src/slaves/editor-navigator.tsx';
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {availableGuides} from '/src/data/ui-guides.ts';
import {getEditorChapter} from '/src/editor/event/index.ts';
window.editorGuides=availableGuides('1.2.0','editor');
import '/src/App.css';
const config={language:'id',theme:'light',editor:{scrollBar:true,aliasHint:false,spellCheck:false,tableResizeGuides:true}};
window.config={get:()=>config,onChange:()=>()=>{},set:async()=>{}};
window.hightex={categories:async()=>[{id:1,name:'Thesis',variant:'thesis',chapters:[{chapter:'1',title:'Pendahuluan'},{chapter:'4',title:'Pembahasan'}]}],cloud:{academic:{locked:async()=>false}}};
window.installation={time:'2026-01-01T00:00:00.000Z',firstInstalled:false,installedVersion:'1.2.0',currentVersion:'1.2.0',previousVersion:'1.2.0',versionChanged:false,seenGuides:{welcome:2,'workspace-1-1-2':2}};
window.hightex.onboarding={status:async()=>structuredClone(window.installation),acknowledge:async guides=>{for(const guide of guides)window.installation.seenGuides[guide.id]=guide.revision;return structuredClone(window.installation)}};
window.profile={get:async()=>({})};
const db=HighTexDB.getInstance();await db.open();window.db=db;
for(const id of ['demo','other'])await db.documents.put({id,title:'Scroll fixture',altTitle:'',category:'1',config:{},keywords:{indonesian:[],english:[]},profile:{name:'Writer',nim:'123',cv:'<p>CV fixture</p>'}});
for(const doc of ['demo','other'])for(const chapter of ['1','4'])for(const version of ['', '.v1'])await db.chapters.put({id:doc+'.'+chapter+version,content:Array.from({length:90},(_,index)=>({type:'paragraph',attrs:{id:'paragraph-'+index},content:[{type:'text',text:'Paragraph '+index+' '+('Text to exercise chapter scroll memory. '.repeat(8))}]}))});
function Probe(){window.currentEditor=useCurrentEditor().editor;window.currentEditorChapter=window.currentEditor?getEditorChapter(window.currentEditor)?.getId():null;window.navigate=useNavigate();window.currentPath=useLocation().pathname;window.setTargets=useParams().setParams;return null}
function Shell(){return React.createElement(EditorChrome,null,React.createElement(EditorProvider,null,React.createElement(ParamsContextProvider,null,React.createElement(Probe),React.createElement(ExpandableSideBarContextProvider,null,React.createElement('div',{className:'flex h-full w-full'},React.createElement(ExpandableSideBar),React.createElement(Outlet)),React.createElement(EditorGuide)),React.createElement(EditorNavigatorSlave))))}
createRoot(document.getElementById('root')).render(React.createElement(ConfigContextProvider,null,React.createElement(TooltipProvider,null,React.createElement(MemoryRouter,{initialEntries:['/document/demo/1']},React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(Shell)},React.createElement(Route,{path:'/document/:id/:chapter?/:version?',element:React.createElement(Editor)})))))));
</script></body></html>`;
const execute = (code) =>
  win.webContents
    .executeJavaScript(`(async()=>await eval(${JSON.stringify(code)}))()`)
    .catch((error) => {
      throw new Error(`Evaluation failed: ${code}`, { cause: error });
    });
async function until(code) {
  const deadline = Date.now() + 20000;
  while (!(await execute(`(async()=>Boolean(await (${code})))()`))) {
    if (Date.now() > deadline) throw Error("Timed out: " + code);
    await new Promise((r) => setTimeout(r, 30));
  }
}
const ready = (path) =>
  until(
    `window.currentPath===${JSON.stringify(path)} && window.currentEditorChapter===${JSON.stringify(path.split("/").slice(2).join("."))} && document.querySelector('#page')?.hidden===false && window.currentEditor?.isEditable`,
  );
app
  .whenReady()
  .then(async () => {
    const { createServer: createVite } = await import(
      root + "/node_modules/vite/dist/node/index.js"
    );
    const react = require(root + "/node_modules/@vitejs/plugin-react");
    const { default: tailwind } = await import(
      root + "/node_modules/@tailwindcss/vite/dist/index.mjs"
    );
    vite = await createVite({
      configFile: false,
      root,
      cacheDir: path.join(profile, "vite"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": path.join(root, "src") } },
      server: { middlewareMode: true, hmr: false },
      logLevel: "error",
    });
    server = createServer(async (req, res) => {
      if (req.url === "/") {
        res.setHeader("Content-Type", "text/html");
        res.end(await vite.transformIndexHtml("/", html));
      } else
        vite.middlewares(req, res, () => {
          res.statusCode = 404;
          res.end();
        });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    win = new BrowserWindow({
      show: false,
      width: 1440,
      height: 940,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    win.webContents.on("console-message", (event) => {
      if (event.level === "error") console.error(event.message);
    });
    await win.loadURL("http://127.0.0.1:" + server.address().port + "/");
    const verifyToolbarTooltip = async () => {
      // Toolbar hints must remain visible below the titlebar after it gained its
      // own layer. Hover the actual toolbar button to open the Radix tooltip.
      const point = await execute(
        `(()=>{const box=document.querySelector('[data-tour="editor-bold"]').getBoundingClientRect();return {x:Math.round(box.left+box.width/2),y:Math.round(box.top+box.height/2)}})()`,
      );
      win.webContents.sendInputEvent({ type: "mouseMove", ...point });
      await until(
        `document.querySelector('[data-slot="tooltip-content"][data-state="instant-open"],[data-slot="tooltip-content"][data-state="delayed-open"]')`,
      );
      assert.ok(
        await execute(
          `(()=>{const tip=document.querySelector('[data-slot="tooltip-content"]');const header=document.querySelector('[data-editor-titlebar]');return parseInt(getComputedStyle(tip).zIndex)>parseInt(getComputedStyle(header).zIndex)&&tip.getBoundingClientRect().top>=header.getBoundingClientRect().bottom&&tip.dataset.side==='bottom'})()`,
        ),
        "toolbar tooltip must paint above titlebar and open below its trigger",
      );
      writeFileSync(
        path.join(profile, "editor-toolbar-tooltip.png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      await execute("document.activeElement.blur()");
    };
    await ready("/document/demo/1");
    await until(`document.querySelector('[data-guide-announcement]')`);
    if (process.env.HIGHTEX_UI_ONLY === "tooltip") {
      await execute(
        `Array.from(document.querySelectorAll('[data-guide-announcement] button')).find(button=>button.textContent.trim()==='Lewati panduan').click()`,
      );
      await until(`!document.querySelector('[role=dialog]')`);
      await verifyToolbarTooltip();
      console.log(
        "PASS: toolbar tooltip opens below the control and paints above the titlebar. Screenshots: " +
          profile,
      );
      return;
    }
    await until(
      `document.querySelector('[data-editor-window-title]')?.textContent==='Scroll fixture'`,
    );
    assert.ok(
      await execute(
        `document.querySelector('[data-editor-workspace]').getBoundingClientRect().bottom<=innerHeight`,
      ),
      "workspace must fit below the titlebar",
    );
    const original = await execute(
      "JSON.stringify(window.currentEditor.getJSON())",
    );
    assert.ok(
      await execute(
        `document.querySelector('[data-guide-announcement]').getBoundingClientRect().bottom<=innerHeight`,
      ),
    );
    await execute(
      `Array.from(document.querySelectorAll('[data-guide-announcement] button')).find(item=>item.textContent.trim()==='Lanjut tur').click()`,
    );
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=chapters]') && document.querySelector('[data-tour-highlight]')`,
    );
    const clickText = (text) =>
      execute(
        `Array.from(document.querySelectorAll('[data-tour-panel] button')).find(item=>item.textContent.trim()===${JSON.stringify(text)}).click()`,
      );
    const shot = async (name) => {
      await execute(
        "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      writeFileSync(
        path.join(profile, name + ".png"),
        (await win.webContents.capturePage()).toPNG(),
      );
    };
    await shot("editor-guide-chapters");
    await execute(
      `document.querySelector('[data-tour="chapter-navigation"] button[aria-label="Bab berikutnya"]').click()`,
    );
    await ready("/document/demo/4");
    assert.equal(
      await execute(
        `document.querySelector('[data-tour-panel]').dataset.tourStep`,
      ),
      "chapters",
    );
    await until(
      `document.querySelector('[data-tour-highlight]') && !Array.from(document.querySelectorAll('[data-tour-panel] button')).find(item=>item.textContent.trim()==='Berikutnya')?.disabled`,
    );
    const selectFeature = async (id) => {
      await execute(
        `(()=>{const field=document.querySelector('[data-tour-panel] select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,${JSON.stringify(id)});field.dispatchEvent(new Event('change',{bubbles:true}))})()`,
      );
      await until(
        `document.querySelector('[data-tour-panel] select')?.value===${JSON.stringify(id)} && document.querySelector('[data-tour-highlight]') && !Array.from(document.querySelectorAll('[data-tour-panel] button')).find(button=>button.textContent.trim()==='Berikutnya'||button.textContent.trim()==='Selesai')?.disabled`,
      );
    };
    await selectFeature("editor-formatting");
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=emphasis]')`,
    );
    await shot("editor-guide-formatting");
    await selectFeature("editor-sidebar");
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=chapterTree]')`,
    );
    const before = await execute(
      `document.querySelector('[data-tour-highlight]').getBoundingClientRect().left`,
    );
    await execute(
      `document.querySelector('[data-tour="editor-sidebar"]').click()`,
    );
    await until(
      `document.querySelector('[data-tour-highlight]').getBoundingClientRect().left>${before + 250}`,
    );
    await until(`document.body.textContent.includes('Pendahuluan')`);
    await shot("editor-guide-sidebar");
    assert.ok(
      await execute(
        `document.querySelector('[data-editor-titlebar]').getBoundingClientRect().top>=0`,
      ),
      "guide must not scroll the titlebar out of view",
    );
    await clickText("Selesai");
    await until(`!document.querySelector('[data-tour-panel]')`);
    await until(
      `window.editorGuides.every(guide=>window.installation.seenGuides[guide.id]===guide.revision)`,
    );
    assert.equal(await execute(`window.installation.seenGuides.welcome`), 2);
    await execute(
      `document.querySelector('button[aria-label="Panduan penggunaan"]').click()`,
    );
    await until(`document.querySelector('[data-guide-announcement] select')`);
    await execute(
      `Array.from(document.querySelectorAll('[data-guide-announcement] button')).find(item=>item.textContent.trim()==='Mulai panduan').click()`,
    );
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=chapters]')`,
    );
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
    await until(`!document.querySelector('[data-tour-panel]')`);
    await ready("/document/demo/1");
    // Exercise every writing guide against real editor controls, including automatic
    // chapter/panel preparation, examples, per-guide navigation and restoration.
    await execute(`window.navigate('/document/demo/cv')`);
    await until(
      `window.currentPath==='/document/demo/cv' && document.querySelector('[contenteditable=true]')?.textContent.includes('CV fixture')`,
    );
    const features = await execute(
      "window.editorGuides.filter(guide=>guide.steps.some(step=>step.editor)).map(guide=>({id:guide.id,steps:guide.steps.map(step=>({id:step.id,example:!!step.example}))}))",
    );
    let checked = 0;
    for (const feature of features) {
      await execute(
        `document.querySelector('button[aria-label="Panduan penggunaan"]').click()`,
      );
      await until(`document.querySelector('[data-guide-announcement] select')`);
      await execute(
        `(()=>{const field=document.querySelector('[data-guide-announcement] select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,${JSON.stringify(feature.id)});field.dispatchEvent(new Event('change',{bubbles:true}))})()`,
      );
      await execute(
        `Array.from(document.querySelectorAll('[data-guide-announcement] button')).find(item=>item.textContent.trim()==='Mulai panduan').click()`,
      );
      for (const [index, step] of feature.steps.entries()) {
        await until(
          `document.querySelector('[data-tour-panel][data-tour-step="${step.id}"]') && document.querySelector('[data-tour-highlight]') && !Array.from(document.querySelectorAll('[data-tour-panel] button')).find(button=>button.textContent.trim()==='Berikutnya'||button.textContent.trim()==='Selesai')?.disabled`,
        );
        assert.equal(
          await execute(
            `document.querySelector('[data-tour-panel] select').value`,
          ),
          feature.id,
        );
        if (step.example)
          assert.ok(
            await execute(
              `document.querySelector('[data-guide-example]')?.textContent.trim().length>0`,
            ),
          );
        if (feature.id === "editor-writing-basics" && index === 0) {
          assert.ok(await execute(`window.currentPath==='/document/demo/1'`));
          await ready("/document/demo/1");
          await until(
            `Array.from(document.querySelectorAll('[data-tour-panel] button')).some(button=>button.textContent.trim()==='Fokus ke kontrol')`,
          );
          await clickText("Fokus ke kontrol");
          assert.equal(
            await execute(
              `document.activeElement.getAttribute('contenteditable')`,
            ),
            "true",
          );
        }
        if (feature.id === "editor-document-details" && step.id === "metadata")
          assert.ok(
            await execute(
              `Array.from(document.querySelectorAll('[data-tour="editor-document-settings"] button')).some(button=>button.textContent.trim()==='Simpan')`,
            ),
            "settings save action must be usable inside the spotlight",
          );
        if (
          feature.id === "editor-document-details" &&
          step.id === "metadata"
        ) {
          await execute(
            `(()=>{const input=document.querySelector('[data-tour="editor-document-settings"] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Judul _baru_');input.dispatchEvent(new Event('input',{bubbles:true}))})()`,
          );
          await execute(
            `Array.from(document.querySelectorAll('[data-tour="editor-document-settings"] button')).find(button=>button.textContent.trim()==='Simpan').click()`,
          );
          await until(
            `document.querySelector('[data-editor-window-title]')?.textContent==='Judul baru'`,
          );
          assert.equal(
            await execute(
              `document.querySelector('[data-editor-window-title] em')?.textContent`,
            ),
            "baru",
          );
        }
        if (feature.id === "editor-document-details" && step.id === "keywords")
          assert.equal(
            await execute("window.currentPath"),
            "/document/demo/abstract",
          );
        if (
          feature.id === "editor-references-aliases" &&
          step.id === "aliases"
        ) {
          await execute(
            `(()=>{let from;window.currentEditor.state.doc.descendants((node,pos)=>{if(from===undefined&&node.isText&&node.text.startsWith('Paragraph '))from=pos});window.aliasSelection=from;window.currentEditor.commands.setTextSelection({from,to:from+9});window.currentEditor.commands.focus()})()`,
          );
          await until(
            `document.querySelector('[data-guide-popup=selection] button[aria-label="Definisikan alias"]') && getComputedStyle(document.querySelector('[data-tour-overlay]')).visibility==='hidden'`,
          );
          await execute(
            `document.querySelector('[data-guide-popup=selection] button[aria-label="Definisikan alias"]').click()`,
          );
          await until(
            `document.querySelector('[data-guide-popup=selection] input')`,
          );
          await execute(
            `window.currentEditor.commands.setTextSelection(window.aliasSelection)`,
          );
          await until(
            `!document.querySelector('[data-guide-popup=selection]') && getComputedStyle(document.querySelector('[data-tour-overlay]')).visibility==='visible'`,
          );
        }
        if (index === 0) await shot("editor-feature-" + feature.id);
        await until(
          `(()=>{const box=document.querySelector('[data-tour-panel]').getBoundingClientRect();return box.top>=document.querySelector('[data-editor-titlebar]').getBoundingClientRect().bottom&&box.left>=0&&box.right<=innerWidth&&box.bottom<=innerHeight})()`,
        );
        assert.ok(
          await execute(
            `document.querySelector('[data-editor-titlebar]').getBoundingClientRect().top>=0`,
          ),
          "guide must keep the native titlebar visible",
        );
        await clickText(
          index === feature.steps.length - 1 ? "Selesai" : "Berikutnya",
        );
        checked++;
      }
      await until(
        `!document.querySelector('[data-tour-panel]') && window.currentPath==='/document/demo/cv'`,
      );
    }
    await execute(`window.navigate('/document/demo/1')`);
    await ready("/document/demo/1");
    const after = await execute(
      "JSON.stringify(window.currentEditor.getJSON())",
    );
    if (after !== original) {
      writeFileSync(path.join(profile, "before.json"), original);
      writeFileSync(path.join(profile, "after.json"), after);
    }
    // Node IDs may be assigned while opening a chapter. Compare its authored structure.
    const authored = (json) =>
      JSON.stringify(JSON.parse(json), (key, value) =>
        key === "id" || key === "shouldUnique" ? undefined : value,
      );
    assert.ok(
      authored(after) === authored(original),
      "tour must not insert examples or modify authored chapter content",
    );
    await execute(
      `document.querySelector('button[aria-label="Panduan penggunaan"]').click()`,
    );
    await until(`document.querySelector('[data-guide-announcement] select')`);
    win.setSize(1000, 640);
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.ok(
      await execute(
        `(()=>{const box=document.querySelector('[data-guide-announcement]').getBoundingClientRect();return box.top>=document.querySelector('[data-editor-titlebar]').getBoundingClientRect().bottom&&box.bottom<=innerHeight})()`,
      ),
      "feature picker must respect titlebar on a small window",
    );
    await execute(
      `Array.from(document.querySelectorAll('[data-guide-announcement] button')).find(button=>button.textContent.trim()==='Mulai panduan').click()`,
    );
    await until(`document.querySelector('[data-tour-highlight]')`);
    await shot("editor-titlebar-small");
    assert.ok(
      await execute(
        `document.querySelector('[data-editor-titlebar]').getBoundingClientRect().top===0`,
      ),
    );
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
    await until(`!document.querySelector('[data-tour-panel]')`);
    win.setSize(1440, 940);
    await ready("/document/demo/1");
    await verifyToolbarTooltip();
    const shortcut = async (key, modifiers = { metaKey: true }) =>
      execute(
        `(()=>{const event=new KeyboardEvent('keydown',{key:${JSON.stringify(key)},...${JSON.stringify(modifiers)},bubbles:true,cancelable:true});document.dispatchEvent(event);return event.defaultPrevented})()`,
      );
    assert.equal(await shortcut("4"), true);
    await ready("/document/demo/4");
    assert.equal(
      await shortcut("2"),
      false,
      "chapter 2 is absent from this schema",
    );
    assert.equal(await execute("window.currentPath"), "/document/demo/4");
    assert.equal(await shortcut("1", { ctrlKey: true }), true);
    await ready("/document/demo/1");
    assert.equal(await shortcut("n"), true);
    await ready("/document/demo/4");
    assert.equal(await shortcut("0"), true);
    await ready("/document/demo/attachment");
    assert.equal(await shortcut("0"), true);
    await ready("/document/demo/attachment");
    await execute(`window.navigate('/document/demo/cv')`);
    await until(
      `window.currentPath==='/document/demo/cv' && document.querySelector('[contenteditable=true]')?.textContent.includes('CV fixture')`,
    );
    assert.equal(await shortcut("0", { ctrlKey: true }), true);
    await ready("/document/demo/attachment");
    await execute(`window.navigate('/document/demo/1/v1')`);
    await ready("/document/demo/1/v1");
    assert.equal(await shortcut("4"), true);
    await ready("/document/demo/4/v1");
    assert.equal(await shortcut("0"), true);
    await ready("/document/demo/attachment/v1");
    // The new editor feature is offered at 1.3.0, opens settings and leaves saved data intact.
    await execute(`window.navigate('/document/demo/1')`);
    await ready("/document/demo/1");
    const documentBefore = await execute(
      `window.db.documents.get('demo').then(doc=>JSON.stringify(doc))`,
    );
    await execute(
      `window.installation.currentVersion='1.3.0';window.dispatchEvent(new Event('hightex:editor-guide'))`,
    );
    await until(`document.querySelector('[data-guide-announcement] select')`);
    await execute(
      `const field=document.querySelector('[data-guide-announcement] select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,'document-author-profile');field.dispatchEvent(new Event('change',{bubbles:true}));`,
    );
    await execute(
      `Array.from(document.querySelectorAll('[data-guide-announcement] button')).find(button=>button.textContent.trim()==='Mulai panduan').click()`,
    );
    for (const step of [
      "document-profile",
      "document-profile-default",
      "document-profile-save",
    ]) {
      await until(
        `document.querySelector('[data-tour-panel][data-tour-step=${step}]') && document.querySelector('[data-tour-highlight]')`,
      );
      if (step === "document-profile-default")
        assert.ok(
          await execute(
            `!!document.querySelector('[data-tour="document-profile-default"]')`,
          ),
        );
      if (step === "document-profile-save") {
        assert.equal(
          await execute(
            `document.querySelector('[data-tour="document-settings-save"]').disabled`,
          ),
          true,
        );
        await shot("release130-document-profile");
      }
      await clickText(
        step === "document-profile-save" ? "Selesai" : "Berikutnya",
      );
    }
    await until(`!document.querySelector('[data-tour-panel]')`);
    assert.equal(
      await execute(
        `window.db.documents.get('demo').then(doc=>JSON.stringify(doc))`,
      ),
      documentBefore,
    );
    assert.equal(
      await execute(
        `window.installation.seenGuides['document-author-profile']`,
      ),
      1,
    );
    assert.equal(await execute("window.currentPath"), "/document/demo/1");
    console.log(
      "PASS: real 1.3.0 document profile guide opens settings, explains explicit defaults and saving, preserves saved document data and does not repeat 1.2.0 features.",
    );
    console.log(
      "PASS: Mod+0 opens the appendix, Mod+N advances chapters, numeric shortcuts follow schema chapters, unavailable numbers are ignored, and version context is preserved.",
    );
    console.log(
      "PASS: " +
        checked +
        " writing steps; paragraphs/headings, metadata/keywords, image/table/math, citations/references, aliases/variables, search/save/PDF, frozen-section preparation and restoration, and no content mutation.",
    );
    console.log(
      "PASS: real editor tour follows chapter navigation, formatting toolbar and the animated chapter sidebar; independent acknowledgment, help replay and Escape dismissal.",
    );
    console.log("Screenshots: " + profile);
  })
  .catch(async (error) => {
    console.error(error);
    if (win)
      console.error(
        await execute(
          `({body:document.body.innerText.slice(-3000),step:document.querySelector('[data-tour-panel]')?.dataset.tourStep,path:window.currentPath,targets:document.querySelectorAll('[data-tour="editor-formatting"]').length})`,
        ).catch(() => ""),
      );
    process.exitCode = 1;
  })
  .finally(async () => {
    win?.destroy();
    await vite?.close();
    await new Promise((r) => (server ? server.close(r) : r()));
    app.exit(process.exitCode ?? 0);
  });
