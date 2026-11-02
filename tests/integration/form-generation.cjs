// Isolated UI and native HTML-to-PDF-to-ZIP integration. No real account/data.
const { app, BrowserWindow, ipcMain } = require("electron");
const { mkdtempSync, writeFileSync, readFileSync } = require("node:fs");
const { createServer } = require("node:http");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const ts = require("typescript");
const { execFileSync } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");
const { zipSync, unzipSync } = require("fflate");
const profile = mkdtempSync(path.join(os.tmpdir(), "hightex-forms-html-"));
app.setPath("userData", profile);
app.commandLine.appendSwitch("disable-gpu");
app.on("window-all-closed", () => {});
let vite, server, win;
setTimeout(() => {
  console.error("Integration deadline exceeded");
  app.exit(1);
}, 180000).unref();
const fixture = `<!doctype html><html><body style="margin:0"><main id="root"></main><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {AppLayout} from '/src/layouts/app-layout.tsx';import {UserContext} from '/src/context/user-context.tsx';import {AuthModalProvider} from '/src/context/auth-modal-context.tsx';import {TooltipProvider} from '/src/components/ui/tooltip.tsx';import {Forms} from '/src/pages/forms.tsx';import {HighTexDB} from '/src/editor/storage/hightex-db.ts';import {documentFormData,defaultSelection} from '/src/forms/model.ts';import '/src/App.css';import '/src/css/workspace.css';
window.config={get:()=>({language:'id'})};window.hightex={};window.profile={get:async()=>({name:'Local Student',nim:'LOCAL123',advisorName:'Local Advisor',advisorNip:'LOCALNIP',cv:''})};
const db=HighTexDB.getInstance();await db.open();
const doc={id:'doc-a',title:'Implementasi _machine learning_ untuk klasifikasi',altTitle:'',category:'1',keywords:{indonesian:[],english:[]},profile:{name:'Student A',nim:'123456',advisorName:'Advisor One',advisorNip:'NIP-A',secondAdvisor:{name:'Advisor Two',nip:'NIP-B'},cv:'',committee:{chair:{id:'chair',name:'Chair Person',nip:'NIP-C'},examiner1:{id:'examiner-1',name:'Examiner One',nip:'NIP-E1'},examiner2:{id:'examiner-2',name:'Examiner Two',nip:'NIP-E2'}}},config:{kaprodi:{name:'Head Person',nip:'NIP-H'},consentDate:new Date(2026,10,2),validityDate:new Date(2026,10,3)}};
const legacy={...doc,id:'legacy',title:'Legacy document',profile:undefined,config:{member_1:'Legacy Examiner'}};
const kp={...doc,id:'kp',title:'Laporan _internship_ KP',profile:{...doc.profile,advisorName:'KP Advisor'},config:{intern:{validity:new Date(2026,10,2)}}};
await db.documents.bulkPut([doc,legacy,kp]);window.db=db;window.original=JSON.stringify(await db.documents.toArray());
localStorage.setItem('hightex:forms:v1:doc-a',JSON.stringify({version:1,stage:'proposal',internId:'kp',choices:{},inputs:{proposal:{scores:{'TA02:advisor1':['100']},minutesComment:'INJECTED COMMENT',revisions:{advisor1:{changes:'INJECTED REVISION',comment:'INJECTED COMMENT'}}}}}));
window.fixtureInput=stage=>({documentId:doc.id,stage,data:documentFormData(doc,kp,stage),selection:defaultSelection(stage)});
createRoot(document.querySelector('#root')).render(React.createElement(UserContext.Provider,{value:{user:false,refresh:async()=>{}}},React.createElement(AuthModalProvider,null,React.createElement(TooltipProvider,null,React.createElement(MemoryRouter,{initialEntries:['/dashboard/forms']},React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(AppLayout)},React.createElement(Route,{path:'/dashboard/forms',element:React.createElement(Forms)}))))))));
</script></body></html>`;
const printHTML = `<!doctype html><html><body><main id="root"></main><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {FormsPrint} from '/src/pages/forms-print.tsx';createRoot(document.querySelector('#root')).render(React.createElement(React.StrictMode,null,React.createElement(FormsPrint)));</script></body></html>`;
const preload = path.join(profile, "preload.cjs");
writeFileSync(
  preload,
  `const{contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('formPrint',{export:input=>ipcRenderer.invoke('forms:archive:export',input),init:r=>ipcRenderer.invoke('forms:init:'+r),ready:(r,i)=>ipcRenderer.send('forms:ready',r,i),error:(r,m)=>ipcRenderer.send('forms:error',r,m),onNext:(r,cb)=>{const ch='forms:next:'+r;const fn=(_,i)=>cb(i);ipcRenderer.on(ch,fn);return()=>ipcRenderer.removeListener(ch,fn)}});`,
);
const execute = async (code) => {
  let timer;
  try {
    return await Promise.race([
      win.webContents.executeJavaScript(`(async()=>{${code}})()`),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Error("Renderer evaluation timed out: " + code.slice(0, 240)),
            ),
          30000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
async function until(code, timeout = 60000) {
  const end = Date.now() + timeout;
  while (!(await execute(`return Boolean(${code})`))) {
    if (Date.now() > end) throw Error("Timed out: " + code);
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
}
async function setValue(selector, value) {
  await execute(
    `const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing field');const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));`,
  );
}
async function click(selector) {
  await execute(`document.querySelector(${JSON.stringify(selector)}).click()`);
}
function load(file, modules) {
  const sandbox = {
    exports: {},
    require: (name) => {
      if (!(name in modules)) throw Error("Unexpected import " + name);
      return modules[name];
    },
    setTimeout,
    clearTimeout,
    Intl,
    Date,
    console,
  };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText,
    sandbox,
  );
  return sandbox.exports;
}
app
  .whenReady()
  .then(async () => {
    console.log("START", profile);
    const { createServer: createVite } = await import("vite");
    const react = (await import("@vitejs/plugin-react")).default;
    const tailwind = (await import("@tailwindcss/vite")).default;
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
      const pathname = new URL(req.url, "http://local").pathname;
      if (pathname === "/fixture" || pathname === "/forms/print") {
        res.setHeader("Content-Type", "text/html");
        res.end(
          await vite.transformIndexHtml(
            req.url,
            pathname === "/fixture" ? fixture : printHTML,
          ),
        );
      } else
        vite.middlewares(req, res, () => {
          res.statusCode = 404;
          res.end();
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    console.log("SERVER", origin);
    const model = load(path.resolve(__dirname, "../../src/forms/model.ts"), {
      "../utils/document-committee": load(
        path.resolve(__dirname, "../../src/utils/document-committee.ts"),
        {},
      ),
    });
    const { FormArchiveService } = load(
      path.resolve(__dirname, "../../electron/service/form-archive-service.ts"),
      {
        electron: {
          BrowserWindow,
          ipcMain,
          dialog: {
            showSaveDialog: async () => ({
              canceled: false,
              filePath: path.join(profile, "forms.zip"),
            }),
          },
        },
        "node:crypto": require("node:crypto"),
        "node:fs/promises": require("node:fs/promises"),
        "node:path": require("node:path"),
        fflate: { zipSync },
        "../main/application": {
          Application: {
            instance: {
              preloadEntry: preload,
              resolveRendererUrl: (route) => origin + route,
            },
          },
        },
        "./config-service": {
          ConfigService: {
            get: () => ({
              export: { saveFolder: profile, exportTimeout: 120000 },
            }),
          },
        },
        "../../src/forms/model": model,
      },
    );
    const service = new FormArchiveService();
    ipcMain.handle("forms:archive:export", (_, input) => service.export(input));
    app.on("browser-window-created", (_, w) =>
      w.webContents.on("console-message", (event) => {
        if (event.level === "error") console.error("RENDERER:", event.message);
      }),
    );
    win = new BrowserWindow({
      show: false,
      width: 1440,
      height: 1100,
      webPreferences: {
        preload,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });
    await win.loadURL(origin + "/fixture");
    console.log("FIXTURE loaded");
    await until(
      "document.querySelectorAll('#forms-document option').length===4",
    );
    await setValue("#forms-document", "doc-a");
    console.log("DOCUMENT selected");
    await until(
      "document.querySelector('iframe')?.contentDocument?.body?.innerText?.includes('Advisor One.')",
    );
    console.log("PREVIEW loaded");
    assert.equal(
      await execute(
        `const doc=document.querySelector('iframe').contentDocument;return doc.querySelectorAll('img').length===1 && doc.querySelector('img').src.includes('logo-uin')`,
      ),
      true,
      "Only the UIN logo may be an image",
    );
    assert.equal(
      await execute(
        `const doc=document.querySelector('iframe').contentDocument;return !doc.querySelector('svg,canvas,object,embed,.forms-original-text,[data-form-field]') && doc.querySelectorAll('table').length>=2`,
      ),
      true,
      "Forms must be authored HTML tables, not converted PDF fragments",
    );
    assert.equal(
      await execute(
        `return document.querySelector('iframe').contentDocument.querySelector('.form-title-value em').textContent`,
      ),
      "machine learning",
    );
    assert.equal(
      await execute(
        `const text=document.querySelector('iframe').contentDocument.body.innerText;return ['NIP-C','NIP-E1','NIP-E2'].every(nip=>text.includes(nip))`,
      ),
      true,
      "Committee NIPs must come directly from the document profile",
    );
    assert.equal(
      await execute(
        `return [...document.querySelector('iframe').contentDocument.querySelectorAll('[data-faculty-blank]')].every(node=>!node.textContent.trim())`,
      ),
      true,
    );
    assert.equal(
      await execute(
        "return [...document.querySelectorAll('input[type=text],input[type=date],input[type=time],textarea')].filter(e=>!e.closest('details:not([open])') && e.checkVisibility()).length",
      ),
      0,
      "Default UX must not show an input wall",
    );
    assert.equal(
      await execute(
        "return !!document.querySelector('[aria-label=\"Nama mahasiswa\"]')",
      ),
      false,
    );
    assert.equal(
      await execute(
        "return [...document.querySelectorAll('input,textarea')].some(e=>/Perbaikan|Komentar|Nilai|Keputusan/.test(e.getAttribute('aria-label')||''))",
      ),
      false,
    );
    await until("!document.querySelector('[data-form-preview] [role=status]')");
    console.log("PROFILE NIPs verified");
    await execute(`
      window.longMinutes=window.fixtureInput('proposal');
      window.longMinutes.selection=[{code:'TA07'}];
      Object.assign(window.longMinutes.data.people.chair,{name:'Prof. Dr. Muhammad Abdullah Hidayat, S.Kom., M.Kom.',nip:'197801012003121001'});
      Object.assign(window.longMinutes.data.people.examiner1,{name:'Dr. Siti Nur Aisyah Rahmawati, S.Kom., M.T.',nip:'198201022005012002'});
      Object.assign(window.longMinutes.data.people.examiner2,{name:'Dr. Budi Santoso, M.Kom.',nip:'198303032006041003'});
      Object.assign(window.longMinutes.data.people.advisor1,{name:'Dr. Muhammad Rizky Pratama Wijayakusuma, S.Kom., M.Kom.',nip:'198404042007101004'});
      Object.assign(window.longMinutes.data.people.advisor2,{name:'Prof. Dr. Nurul Hikmah Putri Maharani, S.Kom., M.Sc.',nip:'198505052008122005'});
      window.beforeLongMinutes=await window.db.documents.get('doc-a');
      const people=window.longMinutes.data.people;
      await window.db.documents.update('doc-a',{
        profile:{...window.beforeLongMinutes.profile,advisorName:people.advisor1.name,advisorNip:people.advisor1.nip,secondAdvisor:{...people.advisor2},committee:{chair:{...people.chair},examiner1:{...people.examiner1},examiner2:{...people.examiner2}}}
      });
    `);
    await until(
      "document.querySelector('iframe')?.contentDocument?.body?.innerText?.includes('Wijayakusuma')",
    );
    console.log("LONG NAMES rendered");
    assert.equal(
      await execute(`
      const doc=document.querySelector('iframe').contentDocument;await doc.fonts.ready;
      const names=[...doc.querySelectorAll('.form-minutes-signatures .form-sign-name')];
      const nips=[...doc.querySelectorAll('.form-minutes-signatures .form-sign-nip')];
      const aligned=(nodes,edge)=>Math.max(...nodes.map(node=>node.getBoundingClientRect()[edge]))-Math.min(...nodes.map(node=>node.getBoundingClientRect()[edge]))<1;
      return names.length===6 && aligned(names.slice(0,3),'bottom') && aligned(names.slice(3),'bottom') && aligned(nips.slice(0,3),'top') && aligned(nips.slice(3),'top') && names.every(node=>node.scrollWidth<=node.clientWidth+1);
    `),
      true,
      "TA07 long names and NIPs must align across each signature row",
    );
    await execute(`
      const frame=document.querySelector('iframe');const doc=frame.contentDocument;const viewport=doc.querySelector('#forms-render');
      viewport.scrollTop=viewport.scrollHeight;const workspace=document.querySelector('#workspace-content');workspace.scrollTop=workspace.scrollHeight;
    `);
    assert.equal(
      await execute(`
      const frame=document.querySelector('iframe');const doc=frame.contentDocument;const viewport=doc.querySelector('#forms-render');const paper=doc.querySelector('.forms-paper');const workspace=document.querySelector('#workspace-content');
      const gap=viewport.getBoundingClientRect().bottom-paper.getBoundingClientRect().bottom;
      return getComputedStyle(workspace).overscrollBehaviorY==='none' && doc.defaultView.getComputedStyle(viewport).overscrollBehaviorY==='none' && Math.abs(workspace.scrollTop-(workspace.scrollHeight-workspace.clientHeight))<=1 && doc.scrollingElement.scrollHeight<=doc.scrollingElement.clientHeight+1 && document.scrollingElement.scrollHeight<=innerHeight+1 && gap>=-1 && gap<24;
    `),
      true,
      "Workspace and preview scrolling must stop at their actual bottom edges",
    );
    await execute(
      `await window.db.documents.put(window.beforeLongMinutes);document.querySelector('#workspace-content').scrollTop=0`,
    );
    await until(
      "document.querySelector('iframe')?.contentDocument?.body?.innerText?.includes('Advisor One.')",
    );
    await execute(
      `const buttons=[...document.querySelectorAll('button')];buttons.find(button=>button.textContent.trim()==='Sidang Akhir').click()`,
    );
    await until("document.querySelector('[data-view-form=TA10]')");
    assert.equal(
      await execute(
        "return !!document.querySelector('[data-view-form=B0],[data-view-form=B1]')",
      ),
      false,
      "B0/B1 must not appear for defense",
    );
    await execute(
      `const buttons=[...document.querySelectorAll('button')];buttons.find(button=>button.textContent.trim()==='Seminar Proposal').click()`,
    );
    await until(
      "document.querySelector('[data-view-form=B0]') && document.querySelector('[data-view-form=B1]')",
    );
    await click('[data-view-form="B3"]');
    await until(
      "document.querySelector('iframe')?.contentDocument?.body?.innerText?.includes('BUKTI PERBAIKAN')",
    );
    assert.equal(
      await execute("return document.querySelectorAll('textarea').length"),
      0,
    );
    await click('[data-view-form="TA07"]');
    await until(
      "document.querySelector('iframe')?.contentDocument?.body?.innerText?.includes('BERITA ACARA')",
    );
    await execute(
      "document.querySelector('[data-form-administration]').open=true",
    );
    await setValue('[aria-label="Tempat kegiatan"]', "Ruang Lokal");
    await setValue('[aria-label="Waktu kegiatan"]', "09:00");
    await until(
      "document.querySelector('iframe')?.contentDocument?.body?.innerText?.includes('Ruang Lokal')",
    );
    await execute(
      "document.querySelector('[data-form-administration]').open=false",
    );
    writeFileSync(
      path.join(profile, "desktop.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await click("button[type=submit]");
    console.log("ZIP export requested");
    await until("document.body.innerText.includes('ZIP tersimpan:')", 120000);
    const archive = unzipSync(readFileSync(path.join(profile, "forms.zip")));
    const expected = model.buildFormFiles(
      await execute("return window.fixtureInput('proposal')"),
    );
    assert.equal(Object.keys(archive).length, expected.length);
    for (const file of expected) {
      assert(archive[file.filename], file.filename);
      const pdf = await PDFDocument.load(archive[file.filename]);
      assert.equal(
        pdf.getPageCount(),
        file.pages,
        file.filename + " page count",
      );
      const size = pdf.getPage(0).getSize();
      assert(Math.abs(size.width - (file.code === "B1" ? 596.52 : 596.04)) < 1);
      assert(Math.abs(size.height - 936) < 1);
      writeFileSync(path.join(profile, file.filename), archive[file.filename]);
    }
    const text = execFileSync(
      "/opt/homebrew/bin/pdftotext",
      [path.join(profile, "TA-07.pdf"), "-"],
      { encoding: "utf8" },
    );
    for (const expected of [
      "Student A",
      "Advisor One.",
      "Chair Person.",
      "Ruang Lokal",
      "machine learning",
    ])
      assert(
        text.replace(/\s/g, "").includes(expected.replace(/\s/g, "")),
        expected,
      );
    assert(!text.includes("INJECTED"));
    assert(!text.includes("_machine learning_"));
    const b3 = execFileSync(
      "/opt/homebrew/bin/pdftotext",
      [path.join(profile, "B3-Pembimbing-I.pdf"), "-"],
      { encoding: "utf8" },
    );
    assert(!b3.includes("INJECTED"));
    assert.equal(
      await execute(
        "return JSON.stringify(await window.db.documents.toArray())===window.original",
      ),
      true,
      "Form UI must not mutate documents",
    );
    await execute(
      "await window.db.documents.update('doc-a',{profile:{...(await window.db.documents.get('doc-a')).profile,advisorName:'Advisor Updated',committee:{...(await window.db.documents.get('doc-a')).profile.committee,examiner1:{name:'Examiner Updated',nip:'NIP-E1-UPDATED'}}}})",
    );
    await until(
      "document.querySelector('iframe')?.contentDocument?.body?.innerText?.includes('Advisor Updated.') && document.querySelector('iframe')?.contentDocument?.body?.innerText?.includes('Examiner Updated.')",
    );
    await setValue("#forms-document", "legacy");
    await until("document.body.innerText.includes('Local Student')");
    await until(
      "document.querySelector('iframe')?.contentDocument?.body?.innerText?.includes('Local Advisor.')",
    );
    assert.equal(
      await execute(
        "return !!document.querySelector('[aria-label=\"Nama mahasiswa\"]')",
      ),
      false,
    );
    await setValue("#forms-document", "doc-a");
    await until(
      "document.querySelector('iframe')?.contentDocument?.body?.innerText?.includes('Ruang Lokal')",
    );
    await win.setSize(500, 950);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(
      await execute("return document.documentElement.scrollWidth<=innerWidth"),
      true,
    );
    writeFileSync(
      path.join(profile, "mobile.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    const longMinutes = await service.generate(
      await execute("return window.longMinutes"),
    );
    const longFiles = unzipSync(longMinutes);
    writeFileSync(
      path.join(profile, "ta07-long-names.pdf"),
      longFiles["TA-07.pdf"],
    );
    assert.equal(
      (await PDFDocument.load(longFiles["TA-07.pdf"])).getPageCount(),
      1,
      "Long names must still fit one TA07 page",
    );
    const defense = await service.generate(
      await execute("return window.fixtureInput('defense')"),
    );
    const defenseFiles = unzipSync(defense);
    assert(defenseFiles["TA-10.pdf"]);
    assert(!defenseFiles["B0.pdf"]);
    assert(!defenseFiles["B1.pdf"]);
    assert(!defenseFiles["TA-09.pdf"]);
    writeFileSync(path.join(profile, "defense.zip"), defense);
    console.log(
      "PASS: minimal optional administration, blank faculty fields, local legacy profile, live profile committee/NIP updates, name utility, native HTML printing, original paper size, separate PDFs in ZIP, source preservation, responsive UI, aligned long TA07 names, bounded workspace and preview scrolling, proposal-only B0/B1.",
    );
    console.log("Artifacts:", profile);
  })
  .catch(async (error) => {
    console.error(error);
    if (win)
      console.error(
        await execute("return document.body.innerText.slice(-1800)").catch(
          () => "",
        ),
      );
    process.exitCode = 1;
  })
  .finally(async () => {
    win?.destroy();
    server?.closeAllConnections();
    await vite?.close();
    await new Promise((resolve) =>
      server ? server.close(resolve) : resolve(),
    );
    app.exit(process.exitCode ?? 0);
  });
