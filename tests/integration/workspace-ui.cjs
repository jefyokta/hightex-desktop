// Opt-in: env -u ELECTRON_RUN_AS_NODE electron tests/integration/workspace-ui.cjs
// Uses an isolated profile, fixture documents and IPC stubs; no real accounts or files.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { assertGuideVisuals } = require("./guide-visual-assertions.cjs");
const profile = mkdtempSync(path.join(os.tmpdir(), "hightex-workspace-"));
app.setPath("userData", profile);
let vite, server, win;
const html = `<!doctype html><html><body style="margin:0"><main id="root"></main><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,useNavigate} from 'react-router-dom';
import {AppLayout} from '/src/layouts/app-layout.tsx';
import {Dashboard} from '/src/pages/local.tsx';
import {Citation} from '/src/pages/citation.tsx';
import {Forms} from '/src/pages/forms.tsx';
import {Settings} from '/src/pages/settings.tsx';
import {Lecturers} from '/src/pages/lecturers.tsx';
import {RemoteDocuments} from '/src/pages/remote.tsx';
import {ConfirmProvider} from '/src/context/confrim-context.tsx';
import {MultiSelectProvider} from '/src/context/multi-select-context.tsx';
import {UserContext} from '/src/context/user-context.tsx';
import {AuthModalProvider} from '/src/context/auth-modal-context.tsx';
import {TooltipProvider} from '/src/components/ui/tooltip.tsx';
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {emptyAuthorProfile} from '/src/utils/document-profile.ts';
import {Toaster} from 'sonner';
import {GUIDE_RELEASES} from '/src/data/ui-guides.ts';
window.release130=GUIDE_RELEASES.find(release=>release.version==='1.3.0');GUIDE_RELEASES.splice(1);window.restoreRelease130=()=>GUIDE_RELEASES.splice(1,GUIDE_RELEASES.length-1,window.release130);
window.addRelease=()=>GUIDE_RELEASES.push({version:'1.3.0',guides:[{...GUIDE_RELEASES[0].guides[0],id:'fixture-1-3-0',name:'guide.features.formatting.name',revision:1,steps:[GUIDE_RELEASES[0].guides[0].steps[0],GUIDE_RELEASES[0].guides[3].steps[0]]},{...GUIDE_RELEASES[0].guides[1],id:'fixture-second',name:'guide.features.chapterTree.name',revision:1}]});
window.workspaceGuides=GUIDE_RELEASES[0].guides.filter(guide=>guide.scope==='workspace');
window.workspaceSeen=Object.fromEntries(window.workspaceGuides.map(guide=>[guide.id,guide.revision]));
import '/src/App.css';
const listeners=new Set();const config={language:'id',theme:'light',export:{saveDialog:true,saveFolder:''},zotero:{enabled:false}};
window.config={get:()=>config,ready:async()=>config,onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},set:async patch=>{Object.assign(config,patch);listeners.forEach(fn=>fn(config));return config}};
window.changeLanguage=language=>window.config.set({language});window.changeTheme=theme=>{document.documentElement.classList.toggle('dark',theme==='dark')};
window.profileSaves=0;window.profile={get:async()=>emptyAuthorProfile(),set:async()=>{window.profileSaves++},picture:async()=>false};
window.opened=[];window.editor={open:async(id)=>{window.opened.push(id)},has:async()=>false};
window.pdf=[];window.exports=[];window.cancelExport=false;
window.ipcRenderer={invoke:async(channel,...args)=>{if(channel==='hightex:pdf'){window.pdf.push(args);return null}if(channel==='hightex:export'){window.exports.push(args[1]);return {canceled:window.cancelExport}}return []}};
window.hightex={version:async()=>'1.3.0',categories:async()=>[{id:1,name:'Skripsi',variant:'thesis',chapters:[{chapter:'1',title:'Pendahuluan'}]},{id:2,name:'Proposal',variant:'proposal',chapters:[{chapter:'1',title:'Pendahuluan'}]}],onPdfProgress:()=>()=>{}};
window.categoryUpdates=0;window.categoryUpdateFails=false;window.hightex.refreshCategories=async()=>{window.categoryUpdates++;if(window.categoryUpdateFails)throw Error('Offline');return window.hightex.categories()};
window.installation={time:'2026-01-01T00:00:00.000Z',firstInstalled:false,installedVersion:'1.2.0',currentVersion:'1.2.0',previousVersion:'1.2.0',versionChanged:false,seenGuides:{...window.workspaceSeen}};
window.formExports=0;window.hightex.forms={export:async()=>{window.formExports++;return null}};
window.hightex.onboarding={status:async()=>structuredClone(window.installation),acknowledge:async guides=>{for(const guide of guides)window.installation.seenGuides[guide.id]=Math.max(window.installation.seenGuides[guide.id]??0,guide.revision);return structuredClone(window.installation)}};
window.licenseSources=[];window.file={getPath:async()=>'/fixture.hightex',openExternal:async url=>{window.licenseSources.push(url)}};
const db=HighTexDB.getInstance();await db.open();window.db=db;
const titles=['Analisis kebutuhan sistem informasi akademik','Perancangan pengalaman pengguna perpustakaan digital','Evaluasi kualitas layanan administrasi kampus','Sistem rekomendasi buku dengan _collaborative filtering_','Analisis sentimen ulasan pengguna aplikasi','Penerapan machine learning untuk klasifikasi dokumen','Model pengelolaan arsip digital perguruan tinggi','Perancangan sistem informasi layanan mahasiswa berbasis web'];
await db.documents.bulkPut(titles.map((title,index)=>({id:'doc'+index,title,altTitle:index===0?'Academic information systems':'',category:index%2?'2':'1',updatedAt:new Date(2026,9,index+1),keywords:{indonesian:index===2?['_aksesibilitas_']:[],english:[]},config:{},profile:{...emptyAuthorProfile(),name:'Penulis',nim:'123',cv:'original cv'}})));
await db.cite.clear();await db.cite.put({key:'example',bib:'@book{example,title={Research methods},author={Jane Doe},year={2026}}'});
const update=db.updateDocument.bind(db);window.failSave=false;db.updateDocument=async(...args)=>{if(window.failSave)throw Error('Fixture save failure');return update(...args)};
function Probe(){window.navigate=useNavigate();return null}
const root=createRoot(document.getElementById('root'));let mountId=0;window.mountWorkspace=()=>root.render(React.createElement(UserContext.Provider,{key:++mountId,value:{user:false,refresh:async()=>{}}},React.createElement(AuthModalProvider,null,React.createElement(TooltipProvider,null,React.createElement(MultiSelectProvider,null,React.createElement(ConfirmProvider,null,React.createElement(MemoryRouter,{initialEntries:['/dashboard']},React.createElement(Probe),React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(AppLayout)},React.createElement(Route,{path:'/dashboard',element:React.createElement(Dashboard)}),React.createElement(Route,{path:'/dashboard/projects/local',element:React.createElement(Dashboard)}),React.createElement(Route,{path:'/dashboard/citation',element:React.createElement(Citation)}),React.createElement(Route,{path:'/dashboard/forms',element:React.createElement(Forms)}),React.createElement(Route,{path:'/dashboard/lecturers',element:React.createElement(Lecturers)}),React.createElement(Route,{path:'/settings',element:React.createElement(Settings)}),React.createElement(Route,{path:'/dashboard/projects/cloud',element:React.createElement(RemoteDocuments)})))),React.createElement(Toaster)))))));
window.mountWorkspace();
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
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}
const clickText = (text) =>
  execute(
    `(()=>{const item=Array.from(document.querySelectorAll('button,[role=menuitem]')).find(item=>item.textContent.trim()===${JSON.stringify(text)} && !item.closest('[data-state=closed]'));if(!item)throw Error('Missing action '+${JSON.stringify(text)});item.click()})()`,
  );
const advanceGuide = async (step, next = "Berikutnya") => {
  await until(
    `!Array.from(document.querySelectorAll('[data-tour-panel] button')).find(button=>button.textContent.trim()===${JSON.stringify(next)})?.disabled`,
  );
  await clickText(next);
  await until(
    `document.querySelector('[data-tour-panel][data-tour-step="${step}"]') && document.querySelector('[data-tour-highlight]')`,
  );
};
const setValue = (selector, value) =>
  execute(
    `(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw Error('Missing field '+${JSON.stringify(selector)});const prototype=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`,
  );
const menu = async (id) => {
  await until(`!document.querySelector('[role=menu][data-state=open]')`);
  await execute(
    `(()=>{const trigger=document.querySelector('[data-document-id="${id}"] button[aria-haspopup=menu]');trigger.focus();trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));})()`,
  );
  await until(`document.querySelector('[role=menu][data-state=open]')!==null`);
};
const rows = () =>
  execute(
    `Array.from(document.querySelectorAll('[data-document-id]')).map(item=>item.dataset.documentId)`,
  );
const closeDialog = () => until(`!document.querySelector('[role=dialog]')`);
const screenshot = async (name) => {
  await execute(
    "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  writeFileSync(
    path.join(profile, name + ".png"),
    (await win.webContents.capturePage()).toPNG(),
  );
};
app
  .whenReady()
  .then(async () => {
    const { createServer: createVite } = await import("vite");
    const { default: react } = await import("@vitejs/plugin-react");
    const { default: tailwind } = await import("@tailwindcss/vite");
    vite = await createVite({
      configFile: false,
      root: path.resolve(__dirname, "../.."),
      cacheDir: path.join(profile, "vite"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": path.resolve(__dirname, "../../src") } },
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
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    win = new BrowserWindow({
      show: false,
      width: 1360,
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
    await until(`document.querySelectorAll('[data-document-id]').length===8`);
    await execute("document.fonts.ready");
    await screenshot("workspace-desktop");
    assert.ok(
      await execute(
        `Array.from(document.querySelectorAll('select')).every(item=>{const css=getComputedStyle(item);return parseFloat(css.paddingLeft)>=12&&parseFloat(css.paddingRight)>=36&&css.appearance==='none'})`,
      ),
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-document-id=doc3] em').textContent`,
      ),
      "collaborative filtering",
    );
    assert.equal(
      await execute(`document.querySelector('aside em').textContent`),
      "collaborative filtering",
    );
    assert.equal(
      await execute(
        `getComputedStyle(document.querySelector('.workspace')).backgroundColor`,
      ),
      await execute(
        `getComputedStyle(document.querySelector('#workspace-content')).backgroundColor`,
      ),
    );

    assert.deepEqual(await rows(), [
      "doc7",
      "doc6",
      "doc5",
      "doc4",
      "doc3",
      "doc2",
      "doc1",
      "doc0",
    ]);
    const titlesFirst =
      "Perancangan sistem informasi layanan mahasiswa berbasis web";
    assert.equal(
      await execute(`document.querySelector('aside button[title]').title`),
      titlesFirst,
    );
    assert.equal(
      await execute(
        `document.querySelector('aside [aria-current=page]').textContent.trim()`,
      ),
      "Dokumen lokal",
    );
    await execute(
      `document.querySelector('[data-document-id=doc7] .workspace-document-title').click()`,
    );
    assert.equal(await execute("window.opened.at(-1)"), "doc7");
    await setValue("input[type=search]", "AKSESIBILITAS");
    await until(`document.querySelectorAll('[data-document-id]').length===1`);
    assert.deepEqual(await rows(), ["doc2"]);
    await setValue("input[type=search]", "zzzz");
    await until(
      `document.body.textContent.includes('Dokumen tidak ditemukan')`,
    );
    await clickText("Hapus filter");
    await until(`document.querySelectorAll('[data-document-id]').length===8`);
    await setValue('select[aria-label="Kategori dokumen"]', "1");
    assert.equal(
      await execute(
        `document.querySelector('select[aria-label="Kategori dokumen"] option:checked').textContent`,
      ),
      "Skripsi · Tugas Akhir",
    );
    await until(`document.querySelectorAll('[data-document-id]').length===4`);
    await setValue('select[aria-label="Urutkan dokumen"]', "title");
    assert.deepEqual(await rows(), ["doc0", "doc4", "doc2", "doc6"]);
    await setValue('select[aria-label="Kategori dokumen"]', "all");
    await setValue('select[aria-label="Urutkan dokumen"]', "updated");
    await menu("doc7");
    await until(`document.querySelector('[role=menu]')!==null`);
    await clickText("Ubah detail dokumen");
    await until(`document.querySelector('[role=dialog] textarea')!==null`);
    await setValue("[role=dialog] textarea", "Judul yang belum disimpan");
    await clickText("Batal");
    await until(
      `document.body.textContent.includes('Buang perubahan yang belum disimpan?')`,
    );
    await clickText("Lanjut mengedit");
    assert.equal(
      await execute(`document.querySelector('[role=dialog] textarea').value`),
      "Judul yang belum disimpan",
    );
    await clickText("Batal");
    await clickText("Buang perubahan");
    await closeDialog();
    assert.equal(
      await execute(`window.db.documents.get('doc7').then(doc=>doc.title)`),
      titlesFirst,
    );
    await menu("doc7");
    await clickText("Ubah detail dokumen");
    await until(`document.querySelector('[role=dialog] textarea')!==null`);
    await setValue("[role=dialog] textarea", "Judul baru tersimpan");
    await execute(
      `window.failSave=true;window.db.documents.get('doc7').then(doc=>window.db.documents.update('doc7',{profile:{...doc.profile,cv:'newer cv'}}))`,
    );
    await clickText("Simpan perubahan");
    await until(`document.querySelector('[role=dialog] [role=alert]')!==null`);
    assert.equal(
      await execute(`document.querySelector('[role=dialog] textarea').value`),
      "Judul baru tersimpan",
    );
    await execute("window.failSave=false");
    await clickText("Simpan perubahan");
    await closeDialog();
    await until(
      `document.querySelector('[data-document-id=doc7]').textContent.includes('Judul baru tersimpan')`,
    );
    assert.equal(
      await execute(
        `window.db.documents.get('doc7').then(doc=>doc.profile.cv)`,
      ),
      "newer cv",
    );
    await clickText("Dokumen baru");
    await until(`document.querySelector('[role=dialog] textarea')!==null`);
    assert.equal(
      await execute(
        `document.querySelector('[role=dialog] button[type=submit]').disabled`,
      ),
      true,
    );
    await setValue("[role=dialog] textarea", "Penelitian baru");
    await setValue("[role=dialog] select", "2");
    await clickText("Buat & mulai menulis");
    await closeDialog();
    await until(`document.querySelectorAll('[data-document-id]').length===9`);
    assert.equal(
      await execute(
        `window.db.documents.get(window.opened.at(-1)).then(doc=>doc.title)`,
      ),
      "Penelitian baru",
    );
    await menu("doc7");
    await clickText("Ekspor .hightex");
    await until("window.exports.length===1");
    await menu("doc7");
    await clickText("Ekspor PDF");
    await until("window.pdf.length===1");
    assert.equal(await execute("window.pdf[0][0]"), "doc7");
    await menu("doc2");
    await clickText("Ubah detail dokumen");
    await until(`document.querySelector('[role=dialog] em')!==null`);
    assert.equal(
      await execute(`document.querySelector('[role=dialog] em').textContent`),
      "aksesibilitas",
    );
    await clickText("Batal");
    await closeDialog();
    await clickText("Pilih dokumen");
    await setValue('select[aria-label="Kategori dokumen"]', "1");
    await until(`document.querySelectorAll('[data-document-id]').length===4`);
    await execute(
      `document.querySelector('[data-document-id] [role=checkbox]').focus()`,
    );
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Space" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Space" });
    await until(
      `document.querySelector('[role=checkbox]').getAttribute('aria-checked')==='mixed'`,
    );
    assert.equal(
      await execute(
        `document.querySelector('[role=checkbox] .lucide-minus').getBoundingClientRect().width>0`,
      ),
      true,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(
      await execute(
        `getComputedStyle(document.querySelector('[role=checkbox]')).backgroundColor===getComputedStyle(document.querySelector('[data-document-id] [role=checkbox]')).backgroundColor`,
      ),
      true,
    );
    assert.equal(
      await execute(
        `getComputedStyle(document.querySelector('[role=checkbox] .lucide-check')).display`,
      ),
      "none",
    );
    await screenshot("workspace-checkboxes");
    await execute(`document.querySelector('[role=checkbox]').click()`);
    await until(
      `document.querySelectorAll('[data-document-id] [role=checkbox][aria-checked=true]').length===4`,
    );
    await clickText("Hapus");
    await until(`document.querySelector('[role=dialog]')!==null`);
    await clickText("Batal");
    await closeDialog();
    assert.equal(
      await execute(
        `document.querySelectorAll('[data-document-id] [role=checkbox][aria-checked=true]').length`,
      ),
      4,
    );
    await clickText("Hapus");
    await until(`document.querySelector('[role=dialog]')!==null`);
    await execute(
      `Array.from(document.querySelectorAll('[role=dialog] button')).find(item=>item.textContent.trim()==='Hapus').click()`,
    );
    await closeDialog();
    await until("window.db.documents.count().then(count=>count===5)");
    await clickText("Hapus filter");
    await execute(`window.changeTheme('dark')`);
    await screenshot("workspace-dark");
    await execute(`window.changeLanguage('en')`);
    await until(`document.body.textContent.includes('Your documents')`);
    assert.equal(
      await execute(
        `document.querySelector('aside [aria-current=page]').textContent.trim()`,
      ),
      "Local documents",
    );
    await execute(`window.changeLanguage('id');window.changeTheme('light')`);
    win.setSize(540, 900);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await screenshot("workspace-mobile");
    assert.ok(
      await execute("document.documentElement.scrollWidth<=window.innerWidth"),
    );
    await execute(
      `document.querySelector('button[aria-label="Buka navigasi"]').click()`,
    );
    await until(`document.querySelector('[role=dialog] aside')!==null`);
    await execute(
      `Array.from(document.querySelectorAll('[role=dialog] aside button')).find(item=>item.textContent.trim()==='Formulir').click()`,
    );
    await closeDialog();
    await until(
      `document.querySelector('#workspace-content h1')?.textContent.includes('Formulir')`,
    );
    await execute(`window.navigate('/dashboard/citation')`);
    await until(`document.body.textContent.includes('Research methods')`);
    await screenshot("workspace-references");
    await execute(`window.navigate('/dashboard/projects/cloud')`);
    await until(`document.body.textContent.includes('Dokumenmu, kapan saja')`);
    await execute(`window.navigate('/dashboard')`);
    await until(`document.querySelectorAll('[data-document-id]').length===5`);

    win.setSize(1360, 940);
    await execute(
      `window.installation.firstInstalled=true;window.installation.seenGuides={};window.mountWorkspace()`,
    );
    await until(`document.querySelector('[data-guide-announcement]')`);
    assert.equal(
      await execute(
        `document.querySelectorAll('[data-guide-announcement] [data-guide-id]').length`,
      ),
      4,
    );
    assert.equal(
      await execute(`!!document.querySelector('[data-tour-panel]')`),
      false,
    );
    await assertGuideVisuals(execute, true);
    await screenshot("workspace-welcome-summary");
    await execute(`window.changeTheme('dark')`);
    await assertGuideVisuals(execute, true);
    await screenshot("workspace-welcome-summary-dark");
    await execute(`window.changeTheme('light')`);
    await clickText("Lanjut tur");
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=documents]') && document.querySelector('[data-tour-highlight]')`,
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-tour-panel]').getAttribute('aria-modal')`,
      ),
      "false",
    );
    assert.deepEqual(
      await execute(
        `Array.from(document.querySelector('[data-tour-panel] select').options).map(item=>item.textContent.trim())`,
      ),
      [
        "Membuat dan membuka dokumen",
        "Mencari dan memilih dokumen",
        "Mengelola referensi",
        "Detail dan ekspor dokumen",
      ],
    );
    await assertGuideVisuals(execute);
    await screenshot("workspace-welcome-guide");
    await execute(`window.changeTheme('dark')`);
    await assertGuideVisuals(execute);
    await screenshot("workspace-welcome-guide-dark");
    await execute(`window.changeTheme('light')`);
    for (const step of ["document-import", "document-open", "organize"])
      await advanceGuide(step);
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=organize]') && document.querySelector('[data-tour-highlight]')`,
    );
    await clickText("Fokus ke kontrol");
    assert.equal(await execute("document.activeElement.type"), "search");
    await setValue("input[type=search]", "Judul baru");
    await until(`document.querySelectorAll('[data-document-id]').length===1`);
    await execute(
      `document.querySelector('select[aria-label="Urutkan dokumen"]').focus()`,
    );
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Tab" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Tab" });
    assert.ok(
      await execute(
        `!!document.activeElement.closest('[data-tour-panel],[data-tour="document-filters"]')`,
      ),
    );
    for (const step of [
      "document-category",
      "document-sort",
      "document-select",
      "references",
    ])
      await advanceGuide(step);
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=references]') && document.querySelector('[data-tour="reference-add"]')`,
    );
    await screenshot("workspace-guide-references");
    await execute(
      `document.querySelector('[data-tour="reference-add"]').click()`,
    );
    await until(
      `document.querySelector('[role=dialog]:not([data-tour-panel]):not([data-state=closed])') && getComputedStyle(document.querySelector('[data-tour-overlay]')).visibility==='hidden'`,
    );
    await clickText("Batal");
    await until(
      `!document.querySelector('[role=dialog]:not([data-tour-panel]):not([data-state=closed])') && getComputedStyle(document.querySelector('[data-tour-overlay]')).visibility==='visible'`,
    );
    for (const step of [
      "reference-zotero",
      "reference-search",
      "reference-library",
      "exports",
    ])
      await advanceGuide(step);
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=exports]') && document.querySelector('[data-tour="document-actions"]')`,
    );
    await menu("doc7");
    await until(
      `getComputedStyle(document.querySelector('[data-tour-overlay]')).visibility==='hidden'`,
    );
    await execute(
      `document.querySelector('[role=menu]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`,
    );
    await until(
      `!document.querySelector('[role=menu][data-state=open]') && getComputedStyle(document.querySelector('[data-tour-overlay]')).visibility==='visible'`,
    );
    await screenshot("workspace-guide-exports");
    await advanceGuide("export-many");
    await advanceGuide("export-location");
    await clickText("Selesai");
    await closeDialog();
    assert.deepEqual(
      await execute("window.installation.seenGuides"),
      await execute("window.workspaceSeen"),
    );
    await execute("window.mountWorkspace()");
    await until(`document.querySelectorAll('[data-document-id]').length===5`);
    await execute(
      "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
    );
    assert.equal(
      await execute(`!!document.querySelector('[role=dialog]')`),
      false,
    );

    await execute(`window.navigate('/settings')`);
    await until(
      `document.querySelector('[data-tour="category-settings"] button')`,
    );
    assert.ok(
      await execute(`document.body.textContent.includes('Jepi Okta Mipa')`),
    );
    await execute(`document.querySelector('[data-license-open]').click()`);
    await until(
      `document.querySelector('[data-license-dialog] [data-license-text]')`,
    );
    assert.ok(
      await execute(
        `document.querySelector('[data-license-text]').textContent.includes('Copyright (C) 2026 Jepi Okta Mipa and contributors.')`,
      ),
    );
    assert.ok(
      await execute(
        `document.querySelector('[data-license-text]').textContent.includes('GNU GENERAL PUBLIC LICENSE') && document.querySelector('[data-license-text]').textContent.includes('WITHOUT ANY WARRANTY')`,
      ),
    );
    await execute(
      `document.querySelector('[data-license-text]').scrollTop=document.querySelector('[data-license-text]').scrollHeight`,
    );
    assert.ok(
      await execute(
        `document.querySelector('[data-license-text]').scrollTop>0`,
      ),
      "the complete offline license must scroll within its dialog",
    );
    assert.ok(
      await execute(
        `(()=>{const rect=document.querySelector('[data-license-dialog]').getBoundingClientRect();return rect.top>=0 && rect.bottom<=innerHeight})()`,
      ),
    );
    await execute(`window.changeLanguage('en')`);
    await until(
      `document.querySelector('[data-license-dialog]').textContent.includes('Software license')`,
    );
    await execute(`document.querySelector('[data-license-source]').click()`);
    assert.deepEqual(await execute(`window.licenseSources`), [
      "https://github.com/jefyokta/hightex-desktop",
    ]);
    await execute(`window.changeLanguage('id')`);
    await until(
      `document.querySelector('[data-license-dialog]').textContent.includes('Lisensi perangkat lunak')`,
    );
    await screenshot("desktop-license-offline");
    await execute(
      `Array.from(document.querySelectorAll('[data-license-dialog] button')).find(button=>button.textContent.trim()==='Tutup').click()`,
    );
    await until(`!document.querySelector('[data-license-dialog]')`);
    assert.equal(await execute("window.categoryUpdates"), 0);
    await execute(
      `window.categoryUpdateFails=true;document.querySelector('[data-tour="category-settings"] button').click()`,
    );
    await until(
      `document.querySelector('[data-tour="category-settings"] [role=alert]')`,
    );
    assert.equal(await execute("window.categoryUpdates"), 1);
    await execute(
      `window.categoryUpdateFails=false;document.querySelector('[data-tour="category-settings"] button').click()`,
    );
    await until(
      `document.querySelector('[data-tour="category-settings"] [role=status]')`,
    );
    assert.equal(await execute("window.categoryUpdates"), 2);
    await execute(`window.navigate('/dashboard')`);
    await until(`document.querySelector('[data-document-id]')`);

    // Manual replay selects features by stable ID and never marks unopened ones seen.
    await execute(
      `delete window.installation.seenGuides.references;delete window.installation.seenGuides['document-exports']`,
    );
    await clickText("Panduan penggunaan");
    await until(`document.querySelector('[data-guide-announcement] select')`);
    await setValue("[data-guide-announcement] select", "references");
    await execute(`window.changeLanguage('en')`);
    await until(
      `document.querySelector('[data-guide-announcement]')?.textContent.includes('Feature guides')`,
    );
    await clickText("Start guide");
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=references]') && document.querySelector('[data-tour-highlight]')`,
    );
    for (const step of [
      "reference-zotero",
      "reference-search",
      "reference-library",
    ])
      await advanceGuide(step, "Next");
    await clickText("Done");
    await closeDialog();
    assert.equal(await execute("window.installation.seenGuides.references"), 2);
    assert.equal(
      await execute(
        `window.installation.seenGuides['document-exports']===undefined`,
      ),
      true,
    );
    await execute(
      `window.changeLanguage('id');window.installation.firstInstalled=false;window.mountWorkspace()`,
    );
    await until(`document.querySelector('[data-guide-announcement]')`);
    assert.deepEqual(
      await execute(
        `Array.from(document.querySelectorAll('[data-guide-id]')).map(item=>item.dataset.guideId)`,
      ),
      ["document-exports"],
    );
    await clickText("Lewati panduan");
    await closeDialog();
    await execute(
      `window.installation.currentVersion='1.2.1';window.mountWorkspace()`,
    );
    await until(`document.querySelectorAll('[data-document-id]').length===5`);
    await execute(
      "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
    );
    assert.equal(
      await execute(`!!document.querySelector('[role=dialog]')`),
      false,
    );

    // A release summary appears before the tour; skipping marks all new features.
    await execute(
      `window.addRelease();window.installation.currentVersion='1.3.0';window.mountWorkspace()`,
    );
    await until(
      `document.querySelector('[data-guide-announcement]')?.textContent.includes('Yang baru di HighTex')`,
    );
    assert.deepEqual(
      await execute(
        `Array.from(document.querySelectorAll('[data-guide-id]')).map(item=>item.dataset.guideId)`,
      ),
      ["fixture-1-3-0", "fixture-second"],
    );
    assert.equal(
      await execute(`!!document.querySelector('[data-tour-panel]')`),
      false,
    );
    await screenshot("workspace-update-summary");
    await clickText("Lewati panduan");
    await closeDialog();
    assert.equal(
      await execute(`window.installation.seenGuides['fixture-1-3-0']`),
      1,
    );
    assert.equal(
      await execute(`window.installation.seenGuides['fixture-second']`),
      1,
    );
    await execute("window.mountWorkspace()");
    await until(`document.querySelectorAll('[data-document-id]').length===5`);
    await execute(
      "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
    );
    assert.equal(
      await execute(`!!document.querySelector('[role=dialog]')`),
      false,
    );
    await clickText("Panduan penggunaan");
    await until(
      `document.querySelector('[data-guide-announcement] select')?.options.length===6`,
    );
    assert.deepEqual(
      await execute(
        `Array.from(document.querySelector('[data-guide-announcement] select').options).slice(0,2).map(item=>item.textContent.trim())`,
      ),
      ["Memformat tulisan", "Panel bab dan referensi"],
    );
    await setValue("[data-guide-announcement] select", "references");
    await clickText("Mulai panduan");
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=references]') && document.querySelector('[data-tour-highlight]')`,
    );
    await setValue("[data-tour-panel] select", "fixture-1-3-0");
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=documents]') && document.querySelector('[data-tour="document-create"]')`,
    );
    win.setSize(540, 900);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.ok(
      await execute(
        `(()=>{const box=document.querySelector('[data-tour-panel]').getBoundingClientRect();return box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight})()`,
      ),
    );
    await screenshot("workspace-guide-mobile");
    await clickText("Berikutnya");
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=exports]') && document.querySelector('[data-tour-highlight]')`,
    );
    assert.equal(
      await execute(`document.querySelector('[data-tour-panel] select').value`),
      "fixture-1-3-0",
    );
    await clickText("Selesai");
    await closeDialog();

    // Do not interrupt an existing dialog or lose the automatic announcement.
    await execute(
      `delete window.installation.seenGuides.references;const blocker=document.createElement('div');blocker.id='fixture-blocker';blocker.setAttribute('role','dialog');document.body.append(blocker);window.mountWorkspace()`,
    );
    await until(`document.querySelectorAll('[data-document-id]').length===5`);
    assert.equal(
      await execute(`!!document.querySelector('[data-guide-announcement]')`),
      false,
    );
    await execute(`document.querySelector('#fixture-blocker').remove()`);
    await until(`document.querySelector('[data-guide-announcement]')`);
    await clickText("Lewati panduan");
    await closeDialog();
    // Real 1.3.0 release: fallback controls, live targets, localization and no automatic edits.
    win.setSize(1360, 940);
    const profileBefore = await execute(
      "window.db.documents.toArray().then(docs=>JSON.stringify(docs))",
    );
    await execute(
      `window.restoreRelease130();window.installation.currentVersion='1.3.0';window.mountWorkspace()`,
    );
    await until(`document.querySelector('[data-guide-announcement]')`);
    assert.deepEqual(
      await execute(
        `Array.from(document.querySelectorAll('[data-guide-id]')).map(item=>item.dataset.guideId)`,
      ),
      ["form-generation", "lecturer-directory"],
    );
    await clickText("Lanjut tur");
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=forms-document]') && document.querySelector('#forms-document') && document.querySelector('[data-tour-highlight]')`,
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('[data-tour-panel] button')).find(button=>button.textContent.trim()==='Berikutnya').disabled`,
      ),
      true,
    );
    await execute(`document.querySelector('[data-tour-panel]').focus()`);
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Right" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Right" });
    assert.equal(
      await execute(
        `document.querySelector('[data-tour-panel]').dataset.tourStep`,
      ),
      "forms-document",
    );
    // The tour waits for the user's selection; it never chooses a document on their behalf.
    assert.equal(
      await execute(`document.querySelector('#forms-document').value`),
      "",
    );
    await setValue("#forms-document", "doc7");
    await until(
      `document.querySelector('[data-tour="forms-stage"]') && !Array.from(document.querySelectorAll('[data-tour-panel] button')).find(button=>button.textContent.trim()==='Berikutnya').disabled`,
    );
    await clickText("Berikutnya");
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=forms-stage]')?.textContent.includes('B0/B1')`,
    );
    await screenshot("release130-forms-stage");
    for (const step of [
      "forms-selection",
      "forms-data",
      "forms-preview",
      "forms-export",
    ]) {
      await clickText("Berikutnya");
      await until(
        `document.querySelector('[data-tour-panel][data-tour-step=${step}]') && document.querySelector('[data-tour-highlight]')`,
      );
    }
    assert.equal(
      await execute(
        `document.querySelector('[data-tour="forms-export"]').disabled`,
      ),
      false,
    );
    await screenshot("release130-forms-export");
    await clickText("Berikutnya");
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=profile-identity]') && document.querySelector('[data-tour="default-profile-identity"]') && document.querySelector('[data-tour-highlight]')`,
    );
    await clickText("Berikutnya");
    await until(
      `document.querySelector('[data-tour-panel][data-tour-step=profile-advisors]') && document.querySelector('[data-tour-highlight]')`,
    );
    await execute(`window.changeLanguage('en')`);
    await until(
      `document.querySelector('[data-tour-panel]')?.textContent.includes('Choose advisors from the directory')`,
    );
    await screenshot("release130-lecturers-en");
    await execute(`window.changeLanguage('id')`);
    for (const step of [
      "lecturer-manage",
      "profile-committee",
      "default-profile-save",
    ]) {
      await clickText("Berikutnya");
      await until(
        `document.querySelector('[data-tour-panel][data-tour-step=${step}]') && document.querySelector('[data-tour-highlight]')`,
      );
    }
    await clickText("Selesai");
    await until(
      `!document.querySelector('[data-tour-panel]') && document.querySelector('[data-document-id]')`,
    );
    assert.equal(await execute("window.profileSaves"), 0);
    assert.equal(await execute("window.formExports"), 0);
    assert.equal(
      await execute(
        "window.db.documents.toArray().then(docs=>JSON.stringify(docs))",
      ),
      profileBefore,
    );
    assert.equal(
      await execute(`window.installation.seenGuides['form-generation']`),
      1,
    );
    assert.equal(
      await execute(`window.installation.seenGuides['lecturer-directory']`),
      3,
    );
    // No-document fallback remains usable on a narrow window.
    await execute(`window.db.documents.clear()`);
    await clickText("Panduan penggunaan");
    await until(`document.querySelector('[data-guide-announcement] select')`);
    await setValue("[data-guide-announcement] select", "form-generation");
    await clickText("Mulai panduan");
    await until(
      `document.querySelector('[data-tour="forms-empty"]') && document.querySelector('[data-tour-panel]')?.textContent.includes('Belum ada dokumen')`,
    );
    win.setSize(540, 900);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.ok(
      await execute(
        `(()=>{const r=document.querySelector('[data-tour-panel]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`,
      ),
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('[data-tour-panel] button')).find(button=>button.textContent.trim()==='Berikutnya').disabled`,
      ),
      true,
    );
    await screenshot("release130-forms-empty-mobile");
    await execute(
      `document.querySelector('[data-tour-panel] button[aria-label="Lewati panduan"]').click()`,
    );
    await until(`!document.querySelector('[data-tour-panel]')`);
    win.setSize(1360, 940);
    for (const feature of ["document-filters", "document-exports"]) {
      await clickText("Panduan penggunaan");
      await until(`document.querySelector('[data-guide-announcement] select')`);
      await setValue("[data-guide-announcement] select", feature);
      await clickText("Mulai panduan");
      await until(
        `document.querySelector('[data-tour-panel]') && document.querySelector('[data-tour="document-empty"]') && document.querySelector('[data-tour-highlight]')`,
      );
      assert.equal(
        await execute(
          `Array.from(document.querySelectorAll('[data-tour-panel] button')).find(button=>button.textContent.trim()==='Berikutnya').disabled`,
        ),
        true,
      );
      await execute(
        `document.querySelector('[data-tour-panel] button[aria-label="Lewati panduan"]').click()`,
      );
      await until(`!document.querySelector('[data-tour-panel]')`);
    }
    assert.equal(
      await execute("window.categoryUpdates"),
      2,
      "guides do not refresh categories automatically",
    );
    console.log(
      "PASS: 14 baseline workspace steps, document-dependent empty-state gates, category refresh on explicit click, offline failure and successful retry.",
    );
    console.log(
      "PASS: real 1.3.0 forms and lecturer tours, fallback before document selection, live targets, local default save guidance, English/Indonesian, route restoration, empty mobile state and no automatic profile/document writes or exports.",
    );
    console.log(
      "PASS: automatic feature summaries, skip-all-seen, ID-based feature selection, visited-only manual replay, localized steps, current-release-first, deferred announcements, no repeat on ordinary updates, italic Indonesian titles/keywords, neutral workspace surfaces.",
    );
    console.log(
      "PASS: dashboard search/filter/sort, recent order, open/create, draft cancellation, failed save retry, current profile preservation, export routing, scoped bulk selection/deletion/cancellation, live language, dark theme, responsive drawer and secondary pages.",
    );
    console.log(
      "PASS: theme-matched tour and announcement, temporary dimmed backdrop, readable primary actions and preserved spotlight interactions.",
    );
    console.log(
      "PASS: offline GPL license, creator/copyright notice, bounded license scrolling, live English/Indonesian labels and source-code link.",
    );
    console.log("Screenshots: " + profile);
  })
  .catch(async (error) => {
    console.error(error);
    if (win)
      console.error(
        await execute("document.body.innerText.slice(-4000)").catch(() => ""),
      );
    process.exitCode = 1;
  })
  .finally(async () => {
    win?.destroy();
    await vite?.close();
    await new Promise((resolve) =>
      server ? server.close(resolve) : resolve(),
    );
    app.exit(process.exitCode ?? 0);
  });
