// Real branch creation and nested dialogs, with optional guide steps and small-window bounds.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const artifacts = mkdtempSync(path.join(os.tmpdir(), "hightex-branch-guide-"));
app.setPath("userData", artifacts);
app.disableHardwareAcceleration();
let vite,
  server,
  win,
  exitCode = 0;
const deadline = setTimeout(() => {
  console.error("Branch guide deadline exceeded");
  app.exit(1);
}, 120000);
deadline.unref();
const html = `<!doctype html><html><body>
<div data-editor-titlebar style="position:fixed;inset:0 0 auto;height:56px;z-index:2200;background:white">Fixture titlebar</div>
<div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {Editor} from '@tiptap/core';import StarterKit from '@tiptap/starter-kit';
import {BranchManagerDialog} from '/src/components/editor/branch-manager-dialog.tsx';
import {GuidedTour} from '/src/components/dashboard/guided-tour.tsx';
import release from '/src/data/ui-guides/releases/1.4.0.ts';import release130 from '/src/data/ui-guides/releases/1.3.0.ts';import {Forms} from '/src/pages/forms.tsx';import {MemoryRouter} from 'react-router-dom';
const features=[...release.guides,...release130.guides];
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {events} from '/src/editor/event/index.ts';import {Storage} from '/src/editor/storage/index.ts';
import {t} from '/src/utils/lang.ts';import {Toaster} from 'sonner';import '/src/App.css';
window.config={get:()=>({language:'en'})};
window.profileBroken=false;window.profile={get:async()=>{if(window.profileBroken)throw Error('Fixture profile unavailable');return {name:'Writer',nim:'001',advisorName:'Advisor',advisorNip:'002',cv:'',isCloud:false}},picture:async()=>false};
window.hightex={categories:async()=>[{id:1,name:'Thesis',variant:'thesis',chapters:[{chapter:'1',title:'Introduction'}]}]};
const db=HighTexDB.getInstance();await db.open();window.db=db;
await db.documents.put({id:'main',title:'Main title',altTitle:'',category:'1',keywords:{indonesian:[],english:[]},config:{}});
await db.chapters.put({id:'main.1',content:[{type:'paragraph',attrs:{id:'original'},content:[{type:'text',text:'Original Main content'}]}]});
window.chapter={getId:()=> 'main.1',getDocumentId:()=> 'main',getContent:async()=> (await db.chapters.get('main.1')).content,setContent:content=>Storage.instance.setChapter({id:'main.1',content})};
window.editorInstance=new Editor({extensions:[StarterKit],content:'<p></p>'});await events.create({editor:window.editorInstance,chapter:window.chapter});
window.opened=[];window.failOpen=false;window.editor={open:async id=>{if(window.failOpen)throw Error('Fixture opening failed');window.opened.push(id)},flush:id=>Storage.instance.waitForDocument(id),has:async()=>false};
function Fixture(){
 const [open,setOpen]=React.useState(true);const [guide,setGuide]=React.useState(null);const [index,setIndex]=React.useState(0);const [formsOpen,setFormsOpen]=React.useState(false);
 window.manager=()=>{setGuide(null);setOpen(true);setFormsOpen(false)};
 window.tour=id=>{setGuide(id);setIndex(0);setOpen(id==='branch-comparison');setFormsOpen(id!=='branch-comparison')};window.step=id=>setIndex(features.find(g=>g.id===guide).steps.findIndex(s=>s.id===id));
 const feature=features.find(g=>g.id===guide);
 return React.createElement(React.Fragment,null,
  formsOpen&&React.createElement(MemoryRouter,null,React.createElement('div',{style:{padding:'80px 24px 24px'}},React.createElement(Forms))),
  React.createElement(BranchManagerDialog,{open,onOpenChange:setOpen,editor:window.editorInstance,chapter:window.chapter}),
  feature&&React.createElement(GuidedTour,{eyebrow:'Fixture',steps:feature.steps.map(s=>({...s,title:t(s.title),description:t(s.description),fallbackDescription:s.fallbackDescription?t(s.fallbackDescription):undefined,waitingDescription:s.waitingDescription?t(s.waitingDescription):undefined})),guides:[{id:feature.id,name:t(feature.name)}],activeGuideId:feature.id,onGuide:setGuide,index,onIndex:setIndex,onDismiss:()=>setGuide(null)}),
  React.createElement(Toaster));
}
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(Fixture)));
window.ready=true;
</script></body></html>`;
const execute = (code) =>
  win.webContents.executeJavaScript(`(async()=>{${code}})()`, true);
async function until(code) {
  const end = Date.now() + 20000;
  while (!(await execute(`return Boolean(${code})`))) {
    if (Date.now() > end) throw Error("Timed out: " + code);
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}
async function input(value) {
  await execute(
    `const input=document.querySelector('[data-tour=branch-manager-dialog] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));`,
  );
  await until("!document.querySelector('[data-tour=branch-create]').disabled");
}
const next = async () => {
  await execute("document.querySelector('[data-tour-next]').click()");
};
async function screenshot(name) {
  await execute(
    "await document.fonts.ready;document.getAnimations().forEach(animation=>animation.finish());await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
  );
  writeFileSync(
    path.join(artifacts, name + ".png"),
    (await win.webContents.capturePage()).toPNG(),
  );
}
async function bounds(selector) {
  assert.equal(
    await execute(
      `const el=document.querySelector(${JSON.stringify(selector)});const r=el.getBoundingClientRect();return r.left>=8&&r.right<=innerWidth-8&&r.top>=document.querySelector('[data-editor-titlebar]').getBoundingClientRect().bottom+8&&r.bottom<=innerHeight-8`,
    ),
    true,
    selector + " stays inside the usable viewport",
  );
}
app
  .whenReady()
  .then(async () => {
    const { createServer: createVite } = await import("vite");
    const project = path.resolve(__dirname, "../..");
    vite = await createVite({
      configFile: false,
      root: project,
      cacheDir: path.join(artifacts, "vite"),
      plugins: [
        (await import("@vitejs/plugin-react")).default(),
        (await import("@tailwindcss/vite")).default(),
      ],
      resolve: { alias: { "@": path.join(project, "src") } },
      server: { middlewareMode: true, hmr: false },
      logLevel: "error",
    });
    server = createServer(async (req, res) => {
      if (req.url === "/") {
        res.setHeader("Content-Type", "text/html");
        res.end(await vite.transformIndexHtml("/", html));
      } else if (req.url.startsWith("/forms/print")) {
        // The full form-generation integration covers the actual printable HTML/PDF.
        res.setHeader("Content-Type", "text/html");
        res.end("<!doctype html><body>Preview fixture</body>");
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
      height: 850,
      webPreferences: { contextIsolation: true, backgroundThrottling: false },
    });
    win.webContents.on("console-message", (event) => {
      if (event.level === "error") console.error(event.message);
    });
    await win.loadURL("http://127.0.0.1:" + server.address().port + "/");
    await until(
      "window.ready&&document.querySelector('[data-tour=branch-create]')",
    );
    assert.equal(
      await execute(
        "return document.querySelector('[data-tour=branch-create]').disabled&&document.querySelector('[data-tour=branch-create-open]').disabled",
      ),
      true,
    );
    // Empty forms never require creating/selecting a document to finish the guide.
    await execute(
      "window.savedDoc=await db.documents.get('main');window.savedChapters=await db.chapters.toArray();await db.documents.clear();await db.chapters.clear();window.tour('shared-form-data')",
    );
    await until(
      "document.querySelector('#forms-document')?.disabled&&document.querySelector('[data-tour=forms-inputs]')",
    );
    assert.equal(
      await execute(
        "return document.querySelector('#forms-document').options.length",
      ),
      1,
    );
    assert.equal(
      await execute(
        "return document.querySelector('[data-tour=forms-empty] a').getAttribute('href')",
      ),
      "/dashboard",
    );
    await execute(
      "const city=document.querySelector('[data-form-field=city] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(city,'Saved without a document');city.dispatchEvent(new Event('input',{bubbles:true}))",
    );
    await until(
      "JSON.parse(localStorage.getItem('hightex:forms:workspace:v1')).values.city==='Saved without a document'",
    );

    for (const step of [
      "forms-stage",
      "forms-shared-values",
      "forms-validation",
    ]) {
      await until(
        `document.querySelector('[data-tour-panel][data-tour-step=${step}]')`,
      );
      assert.equal(
        await execute(
          "return document.querySelector('[data-tour-next]').disabled",
        ),
        false,
      );
      assert.equal(
        await execute(
          "return document.querySelector('[data-tour-panel]').checkVisibility()",
        ),
        true,
        "The fallback guide stays visible and can be skipped",
      );
      if (step === "forms-stage") {
        await execute("document.querySelector('[data-tour-panel]').focus()");
        win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Right" });
        win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Right" });
      } else await next();
    }
    await until("!document.querySelector('[data-tour-panel]')");
    assert.equal(await execute("return await db.documents.count()"), 0);
    await execute("window.tour('form-generation')");
    for (const step of [
      "forms-stage",
      "forms-data",
      "forms-document",
      "forms-selection",
      "forms-preview",
      "forms-export",
    ]) {
      await until(
        `document.querySelector('[data-tour-panel][data-tour-step=${step}]')`,
      );
      assert.equal(
        await execute(
          "return document.querySelector('[data-tour-next]').disabled",
        ),
        false,
      );
      if (step === "forms-document") {
        await until(
          "document.querySelector('[data-tour-panel]')?.textContent.includes('No documents yet.')",
        );
        assert.equal(
          await execute(
            "return document.querySelector('[data-tour-panel]').textContent.includes('Choose an available document')",
          ),
          false,
          "An empty document selector never asks users to choose an unavailable option",
        );
      }
      await next();
    }
    await until("!document.querySelector('[data-tour-panel]')");
    assert.equal(await execute("return await db.documents.count()"), 0);
    await execute(
      "await db.documents.put(window.savedDoc);await db.chapters.bulkPut(window.savedChapters)",
    );
    assert.equal(
      await execute(
        "return JSON.parse(localStorage.getItem('hightex:forms:workspace:v1')).values.city",
      ),
      "Saved without a document",
      "Shared input survives both empty-document tours",
    );
    // Live updates make the first document selectable while keeping shared values.
    await until(
      "!document.querySelector('#forms-document').disabled&&document.querySelector('#forms-document').options.length===2",
    );
    assert.equal(
      await execute("return document.querySelector('#forms-document').value"),
      "",
      "New documents are not selected automatically",
    );
    await execute(
      "const select=document.querySelector('#forms-document');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'main');select.dispatchEvent(new Event('change',{bubbles:true}))",
    );
    await until("document.querySelector('[data-tour=forms-workspace]')");
    assert.equal(
      await execute(
        "return document.querySelector('[data-form-field=city] input').value",
      ),
      "Saved without a document",
    );
    // Removing a selected document clears its selection, including after it is restored.
    await execute("await db.documents.delete('main')");
    await until(
      "document.querySelector('#forms-document').disabled&&!document.querySelector('[data-tour=forms-workspace]')",
    );
    await execute("await db.documents.put(window.savedDoc)");
    await until("!document.querySelector('#forms-document').disabled");
    assert.equal(
      await execute("return document.querySelector('#forms-document').value"),
      "",
      "Restoring a removed document requires an explicit new choice",
    );
    assert.equal(
      await execute(
        "return Boolean(document.querySelector('[data-tour=forms-workspace]'))",
      ),
      false,
    );
    // A failed profile reload offers retry without discarding the workspace draft.
    await execute(
      "window.profileBroken=true;window.dispatchEvent(new Event('focus'))",
    );
    await until("document.querySelector('[role=alert] button')");
    await execute(
      "window.profileBroken=false;document.querySelector('[role=alert] button').click()",
    );
    await until(
      "document.querySelector('[data-form-field=city] input')&&!document.querySelector('[role=alert]')",
    );
    assert.equal(
      await execute(
        "return document.querySelector('[data-form-field=city] input').value",
      ),
      "Saved without a document",
    );
    // A branch guide can be completed without creating data or opening another editor.
    await execute("window.tour('branch-comparison')");
    for (const step of [
      "branch-manager",
      "branch-create",
      "branch-compare",
      "branch-navigation",
      "branch-content",
    ]) {
      await until(
        `document.querySelector('[data-tour-panel][data-tour-step=${step}]')`,
      );
      assert.equal(
        await execute(
          "return document.querySelector('[data-tour-next]').disabled",
        ),
        false,
      );
      assert.equal(
        await execute(
          "return document.querySelector('[data-tour-panel]').checkVisibility()",
        ),
        true,
        "The fallback guide stays visible and can be skipped",
      );
      await next();
    }
    await until("!document.querySelector('[data-tour-panel]')");
    assert.equal(await execute("return await db.documents.count()"), 1);
    await input("Unready editor");
    await execute(
      "window.editorInstance.setEditable(false);document.querySelector('[data-tour=branch-create]').click()",
    );
    await until(
      "!document.querySelector('[data-tour=branch-manager-dialog] input').disabled",
    );
    assert.equal(
      await execute("return await db.documents.count()"),
      1,
      "An unready editor cannot create a branch from placeholder state",
    );
    await execute("window.editorInstance.setEditable(true)");
    // Create stays in the current editor and reveals the new branch in the manager.
    await input("Revision A");
    await execute(
      "document.querySelector('[data-tour=branch-create]').click()",
    );
    await until(
      "[...document.querySelectorAll('[data-tour=branch-manager-dialog] p')].some(p=>p.textContent==='Revision A')",
    );
    assert.deepEqual(await execute("return window.opened"), []);
    assert.equal(await execute("return await db.documents.count()"), 2);
    // Keyboard submission uses Create, not Create and open.
    await input("Keyboard revision");
    await execute(
      "document.querySelector('[data-tour=branch-manager-dialog] input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))",
    );
    await until(
      "[...document.querySelectorAll('[data-tour=branch-manager-dialog] p')].some(p=>p.textContent==='Keyboard revision')",
    );
    assert.deepEqual(await execute("return window.opened"), []);
    await input("Revision B");
    await execute(
      "document.querySelector('[data-tour=branch-create-open]').click()",
    );
    await until(
      "!document.querySelector('[data-tour=branch-manager-dialog]')&&window.opened.length===1",
    );
    assert.equal(
      await execute(
        "return (await db.documents.get(window.opened[0])).branchName",
      ),
      "Revision B",
    );
    // An editor-open failure must not create a second branch on retry.
    await execute("window.manager();window.failOpen=true");
    await until("document.querySelector('[data-tour=branch-create-open]')");
    await input("Open failure");
    await execute(
      "document.querySelector('[data-tour=branch-create-open]').click()",
    );
    await until(
      "document.querySelector('[data-tour=branch-manager-dialog] input')?.value===''&&!document.querySelector('[data-tour=branch-manager-dialog] input').disabled",
    );
    assert.equal(
      await execute(
        "return (await db.documents.toArray()).filter(d=>d.branchName==='Open failure').length",
      ),
      1,
    );
    assert.equal(
      await execute(
        "return Boolean(document.querySelector('[data-tour=branch-manager-dialog]'))",
      ),
      true,
    );
    await execute("window.failOpen=false");
    // The topmost comparison dialog is the guide target, rather than its parent manager.
    await execute(
      "const branch=(await db.documents.toArray()).find(d=>d.branchName==='Revision A');const chapter=await db.chapters.get(branch.id+'.1');chapter.content[0].content[0].text='Changed branch';await db.chapters.put(chapter);window.tour('branch-comparison')",
    );
    await until("document.querySelector('[data-tour-panel]')");
    await execute("window.step('branch-compare')");
    await until(
      "document.querySelector('[data-tour-panel][data-tour-step=branch-compare]')",
    );
    await execute(
      "[...document.querySelectorAll('[data-tour=branch-manager-dialog] p')].find(p=>p.textContent==='Revision A').parentElement.parentElement.querySelector('[data-tour=branch-compare-action]').click()",
    );
    await until(
      "document.querySelector('[data-comparison-entry]')&&document.querySelector('[data-tour-next]').textContent.includes('Next')",
    );
    await next();
    await until(
      "document.querySelector('[data-tour-panel][data-tour-step=branch-navigation]')",
    );
    assert.equal(
      await execute(
        "return document.querySelector('[data-tour-panel]').checkVisibility()",
      ),
      true,
    );
    await next();
    await until(
      "document.querySelector('[data-tour-panel][data-tour-step=branch-content]')",
    );
    assert.equal(
      await execute(
        "return document.querySelector('[data-tour-panel]').checkVisibility()",
      ),
      true,
    );
    await next();
    await until("!document.querySelector('[data-tour-panel]')");
    await execute(
      "window.comparedBranch=(await db.documents.toArray()).find(d=>d.branchName==='Revision A');await db.documents.update(window.comparedBranch.id,{branchName:'R'.repeat(64)})",
    );
    await until("document.querySelector('[data-comparison-stale]')");
    await execute(
      "document.querySelector('[data-comparison-stale] button').click()",
    );
    await until(
      "document.querySelector('[data-tour=branch-comparison-dialog] h2')?.textContent.includes('R'.repeat(64))&&!document.querySelector('[data-comparison-stale]')",
    );
    await screenshot("nested-comparison");
    await bounds("[data-tour=branch-comparison-dialog]");
    await win.setSize(390, 420);
    await until("innerWidth<450");
    await screenshot("comparison-short");
    await bounds("[data-tour=branch-comparison-dialog]");
    await execute(
      "const dialog=document.querySelector('[data-tour=branch-comparison-dialog]');dialog.scrollTop=dialog.scrollHeight",
    );
    assert.equal(
      await execute(
        "const d=document.querySelector('[data-tour=branch-comparison-dialog]');const footer=d.querySelector('[data-comparison-footer]').getBoundingClientRect();return footer.bottom<=innerHeight",
      ),
      true,
    );
    assert.equal(
      await execute(
        "const d=document.querySelector('[data-tour=branch-comparison-dialog]');const close=[...d.querySelector('[data-comparison-footer]').querySelectorAll('button')].at(-1);const r=close.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===close",
      ),
      true,
      "The Close button remains clickable above notifications",
    );
    await screenshot("comparison-short-footer");
    console.log(
      "PASS: actual empty Forms page, shared input persistence, first-document arrival, deletion/restoration and profile retry; optional empty-data guides; nested comparison guide; Create, Enter and Create and open; persisted branch after open failure; usable modal bounds below titlebar on short/narrow windows.",
    );
    console.log("Artifacts:", artifacts);
  })
  .catch((error) => {
    console.error(error);
    console.error("Artifacts:", artifacts);
    exitCode = 1;
  })
  .finally(async () => {
    win?.destroy();
    server?.closeAllConnections();
    await vite?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    app.exit(exitCode);
  });
