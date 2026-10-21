// Opt-in: env -u ELECTRON_RUN_AS_NODE electron tests/integration/submission-ui.cjs
// Actual React components and exporter, fixture APIs, isolated Electron profile.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const profile = mkdtempSync(path.join(os.tmpdir(), "hightex-submission-ui-"));
app.setPath("userData", profile);
let vite, server, win;
const html = `<!doctype html><html><body style="margin:0"><main id="root" style="max-width:760px;margin:auto;padding:24px"></main><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,MemoryRouter,Routes,Route} from 'react-router-dom';
import {ConfirmProvider} from '/src/context/confrim-context.tsx';
import {StudentSubmission} from '/src/components/submission/student-submission.tsx';
import {SubmissionReviewResult} from '/src/components/submission/review-result.tsx';
import {SubmissionListView} from '/src/components/submission/submission-list.tsx';
import {UserContext} from '/src/context/user-context.tsx';
import {Setting} from '/src/components/editor/expandable-items/setting.tsx';
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {readSnapshot} from '/src/review/snapshot-reader.ts';
import '/src/App.css';
window.config={get:()=>({language:'id'})};
const context={sessionId:'cloud-session',serverUrl:'http://fixture/api/',accountId:'12'};
const category={id:1,name:'Skripsi',variant:'thesis',chapters:[{chapter:'1',title:'Pendahuluan'}]};
const db=HighTexDB.getInstance();await db.open();
const doc={id:'local-a',title:'Dokumen mahasiswa',altTitle:'Student document',category:'1',config:{},keywords:{indonesian:[],english:[]},profile:{name:'Student A',nim:'A001',advisorName:'Advisor',advisorNip:'NIP',cv:'<p>CV Student A</p>'}};
await db.documents.put(doc);await db.chapters.put({id:'local-a.1',content:[{type:'paragraph',content:[{type:'text',text:'Saved chapter A'}]}]});
window.calls={prepare:0,submit:0,check:0,detail:0};window.attempt=null;window.rows=[];window.editorOpen=false;window.linked=true;window.uncertain=false;window.frozen=null;window.changed=false;window.hasCloud=true;window.audience='student';window.roles=['student'];window.serverIncomplete=false;
const academic=()=>({session:context,serverDocumentId:'server-a',author:{name:window.serverIncomplete?'':'Student Server',nim:'SERVER001',advisorName:'Server Advisor',advisorNip:'SERVER-NIP',secondAdvisor:undefined},committee:{leader:'Server Chair',member_1:'Server Examiner One',member_2:'Server Examiner Two',kaprodi:{name:'Server Program Head',nip:'HEAD'},dekan:{name:'Server Dean',nip:'DEAN'}}});
window.hightex={categories:async()=>[category],cloud:{academic:{locked:async()=>window.linked,load:async()=>academic()},context:async()=>context,list:async()=>({commits:window.hasCloud?[{type:'current',document_id:'server-a',sha256:'a'.repeat(64)}]:[]}),binding:async()=>window.linked?{serverDocumentId:'server-a'}:null},submission:{
 context:async()=>({ok:true,data:context}),
 list:async()=>({ok:true,data:{session:context,audience:window.audience,items:window.rows}}),
 history:async()=>({ok:true,data:{session:context,documentId:'server-a',ownerId:'12',items:window.rows}}),
 detail:async()=>{window.calls.detail++;return {ok:true,data:{submission:window.rows[0],comments:[{id:'c1',author:'Advisor A',text:'<img src=x onerror="window.changed=true"> Perbaiki bab 1',createdAt:null}]}}},
 workflow:{pending:async()=>window.attempt,
 prepare:async input=>{window.calls.prepare++;window.frozen=await readSnapshot(input.file,{kind:'local',filename:'fixture.hightex'});window.attempt={id:'attempt',serverUrl:context.serverUrl,accountId:'12',localDocumentId:'local-a',documentId:'server-a',title:input.document.title,sha256:window.frozen.sha256,baseline:[],state:'uploaded'};return window.attempt;},
 submit:async()=>{window.calls.submit++;if(window.uncertain){window.attempt={...window.attempt,state:'uncertain'};return window.attempt;}window.rows=[{id:'1',documentId:'server-a',title:doc.title,studentName:'Student A',ownerId:'12',status:'waiting_for_review',createdAt:'2026-10-21T00:00:00Z',reviewedAt:null}];window.attempt={...window.attempt,state:'submitted',submissionId:'1'};return window.attempt;},
 reconcile:async()=>{window.calls.check++;return window.attempt;},discard:async()=>{window.attempt=null;}}}};
window.editor={has:async()=>window.editorOpen};
const root=createRoot(document.getElementById('root'));let revision=0;
window.mount=kind=>{revision++;const child=kind==='settings'?React.createElement(Routes,null,React.createElement(Route,{path:'/document/:id',element:React.createElement(Setting,{key:revision})})):kind==='result'?React.createElement(SubmissionReviewResult,{key:revision,documentId:'server-a',submissionId:'1'}):kind==='page'?React.createElement(UserContext.Provider,{value:{user:{id:'12',name:'Account Student',roles:window.roles.map(name=>({name}))},refresh:async()=>{}}},React.createElement(SubmissionListView,{key:revision})):React.createElement(StudentSubmission,{key:revision,onUpdated(){}});root.render(React.createElement(React.StrictMode,null,React.createElement(kind==='settings'?MemoryRouter:BrowserRouter,kind==='settings'?{initialEntries:['/document/local-a']}:null,React.createElement(ConfirmProvider,null,child))));};
window.reset=async kind=>{window.calls={prepare:0,submit:0,check:0,detail:0};window.attempt=null;window.rows=[];window.editorOpen=kind==='editor';window.linked=kind!=='unlinked';window.uncertain=kind==='timeout';window.serverIncomplete=kind==='invalid';category.variant=kind==='kp'?'intern':'thesis';await db.documents.put({...doc,profile:{...doc.profile,name:kind==='invalid'?'':doc.profile.name}});window.mount();};
window.localSettings=async()=>{window.linked=false;await db.documents.put(doc);window.mount('settings');};
window.mount();window.ready=true;
</script></body></html>`;
const execute = (code) => win.webContents.executeJavaScript(code);
const until = async (code) => {
  const start = Date.now();
  while (!(await execute(code))) {
    if (Date.now() - start > 30000) throw Error(`Timed out: ${code}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};
const clickText = (text) =>
  execute(
    `(()=>{const button=Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(text)});if(!button)throw Error('Button missing');button.click();})()`,
  );
const loaded = () =>
  until(
    `Boolean(document.getElementById('submission-document')) && !Array.from(document.querySelectorAll('button')).find(button=>button.getAttribute('aria-label')==='Muat ulang')?.disabled`,
  );
const startSubmission = async () => {
  await clickText("Simpan dan ajukan review");
  await until(`Boolean(document.querySelector('[role="dialog"]'))`);
  await clickText("Confirm");
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
      width: 1100,
      height: 900,
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
    await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
    await until("window.ready===true");
    await loaded();
    writeFileSync(
      path.join(profile, "form.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await startSubmission();
    await until(
      `document.body.textContent.includes('Pengajuan terkonfirmasi')`,
    );
    await until(`document.querySelector('[role="dialog"]')===null`);
    assert.deepEqual(await execute("window.calls"), {
      prepare: 1,
      submit: 1,
      check: 0,
      detail: 0,
    });
    assert.equal(
      await execute(`window.frozen.document.profile.name`),
      "Student Server",
    );
    assert.equal(
      await execute(`window.frozen.chapters[0].content[0].content[0].text`),
      "Saved chapter A",
    );
    assert.equal(
      await execute(
        `document.querySelector('a[href="/dashboard/submissions/server-a/1"]')!==null`,
      ),
      true,
    );
    writeFileSync(
      path.join(profile, "submitted.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    for (const kind of ["unlinked", "kp"]) {
      await execute(`window.reset(${JSON.stringify(kind)})`);
      await loaded();
      assert.equal(
        await execute(
          `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Simpan dan ajukan review').disabled`,
        ),
        true,
      );
      assert.equal(await execute("window.calls.prepare"), 0);
    }
    await execute(`window.reset('editor')`);
    await loaded();
    await clickText("Simpan dan ajukan review");
    await until(
      `document.body.textContent.includes('Tutup editor dokumen terlebih dahulu')`,
    );
    assert.equal(await execute("window.calls.prepare"), 0);
    await execute(`window.reset('invalid')`);
    await loaded();
    await startSubmission();
    await until(
      `document.body.textContent.includes('nama serta NIM harus tersedia')`,
    );
    assert.equal(await execute("window.calls.prepare"), 0);
    await execute(`window.reset('timeout')`);
    await loaded();
    await startSubmission();
    await until(
      `document.body.textContent.includes('Hasil pengajuan belum diketahui')`,
    );
    await execute("window.mount()");
    await until(
      `document.body.textContent.includes('Hasil pengajuan belum diketahui')`,
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Ajukan versi tersimpan')`,
      ),
      false,
    );
    await clickText("Periksa hasil pengajuan");
    await until("window.calls.check===1");
    assert.equal(await execute("window.calls.submit"), 1);
    await execute(
      `window.rows=[{id:'1',documentId:'server-a',title:'A',status:'reviewed',reviewedAt:null}];window.mount('result')`,
    );
    await until(`document.body.textContent.includes('Perbaiki bab 1')`);
    assert.equal(
      await execute(
        `document.querySelector('img')===null && window.changed===false`,
      ),
      true,
    );
    assert.ok(await execute("window.calls.detail>=1"));
    await execute(
      `window.attempt=null;window.hasCloud=false;window.mount('page')`,
    );
    await until(
      `document.querySelector('a[href="/dashboard/submissions/server-a/1"]')!==null`,
    );
    assert.ok(
      await execute(
        `document.body.textContent.includes('Riwayat pengajuan dokumenmu')`,
      ),
    );
    await execute(
      `window.audience='advisor';window.roles=['advisor'];window.mount('page')`,
    );
    await until(
      `document.body.textContent.includes('Submission mahasiswa bimbingan')`,
    );
    assert.equal(
      await execute(
        `document.body.textContent.includes('Ajukan dokumen saya')`,
      ),
      false,
    );
    await execute(
      `window.hasCloud=true;window.roles=['advisor','student'];window.mount('page')`,
    );
    await until(
      `document.body.textContent.includes('Ajukan dokumen saya') && document.body.textContent.includes('Submission mahasiswa bimbingan')`,
    );
    await execute(`window.serverIncomplete=false;window.mount('settings')`);
    await until(
      `document.body.textContent.includes('diisi otomatis dari server')`,
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('input')).find(input=>input.value==='Student Server')?.matches(':disabled')`,
      ),
      true,
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('input')).find(input=>input.value==='Server Program Head')?.matches(':disabled')`,
      ),
      true,
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('input')).find(input=>input.value==='Server Dean')?.matches(':disabled')`,
      ),
      true,
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('input')).find(input=>input.value==='Dokumen mahasiswa')?.matches(':disabled')`,
      ),
      false,
    );
    writeFileSync(
      path.join(profile, "cloud-settings.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await execute(`window.localSettings()`);
    await until(
      `Array.from(document.querySelectorAll('input')).some(input=>input.value==='Student A')`,
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('input')).find(input=>input.value==='Student A')?.matches(':disabled')`,
      ),
      false,
    );
    console.log(
      JSON.stringify({
        submissionUI: "passed",
        frozenExport: true,
        linkedAndKPGuards: true,
        editorAndAuthorValidation: true,
        uncertainRemount: true,
        reviewCommentsEscaped: true,
        webHistoryWithoutCloud: true,
        multiRoleContexts: true,
        cloudAcademicAutofillAndLocks: true,
        localAuthorStillEditable: true,
        artifacts: profile,
      }),
    );
  })
  .then(async () => {
    win?.destroy();
    server?.close();
    await vite?.close();
    app.exit(0);
  })
  .catch(async (error) => {
    console.error(error.stack ?? String(error));
    win?.destroy();
    server?.close();
    await vite?.close();
    app.exit(1);
  });
