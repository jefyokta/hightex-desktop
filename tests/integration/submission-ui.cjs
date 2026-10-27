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
import {RemoteDocuments} from '/src/pages/remote.tsx';
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
window.hightex={categories:async()=>window.categoriesMissing?[]:[category],cloud:{academic:{locked:async()=>window.linked,load:async()=>academic()},context:async()=>context,list:async()=>{if(window.cloudLoadFails)throw Error('cloud_error:http_500');return ({commits:window.hasCloud?[{type:'current',document_id:'server-a',sha256:'a'.repeat(64)}]:[]})},push:async input=>{window.cloudPushes.push({force:input.force,replace:input.replace});return {status:'saved',changed:true,serverDocumentId:'server-a',sha256:'b'.repeat(64)};},binding:async()=>window.linked?{serverDocumentId:'server-a'}:null},submission:{
 context:async()=>({ok:true,data:context}),
 recipients:async()=>({ok:true,data:{session:context,items:[{id:'24',name:'Advisor A',roles:{primary_advisor:'Pembimbing I'}},{id:'25',name:'Advisor B',roles:{secondary_advisor:'Pembimbing II'}}]}}),
 list:async()=>({ok:true,data:{session:context,audience:window.audience,items:window.rows}}),
 history:async()=>({ok:true,data:{session:context,documentId:'server-a',ownerId:'12',items:window.rows}}),
 detail:async()=>{window.calls.detail++;return {ok:true,data:{submission:window.rows[0],comments:[{id:'c1',author:'Advisor A',text:'<img src=x onerror="window.changed=true"> Perbaiki bab 1',createdAt:null}]}}},
 workflow:{pending:async()=>window.attempt,
 prepare:async input=>{window.calls.prepare++;window.frozen=await readSnapshot(input.file,{kind:'local',filename:'fixture.hightex'});window.attempt={id:'attempt',recipientId:input.recipientId,recipientName:'Advisor A',serverUrl:context.serverUrl,accountId:'12',localDocumentId:'local-a',documentId:'server-a',title:input.document.title,sha256:window.frozen.sha256,baseline:[],state:'uploaded'};return window.attempt;},
 submit:async()=>{window.calls.submit++;if(window.uncertain){window.attempt={...window.attempt,state:'uncertain'};return window.attempt;}window.rows=[{id:'1',documentId:'server-a',title:doc.title,studentName:'Student A',ownerId:'12',recipientId:window.attempt?.recipientId??'24',recipientName:'Advisor A',recipientRoles:{primary_advisor:'Pembimbing I'},snapshotPurgedAt:null,status:'waiting_for_review',createdAt:'2026-10-21T00:00:00Z',reviewedAt:null}];window.attempt={...window.attempt,state:'submitted',submissionId:'1'};return window.attempt;},
 reconcile:async()=>{window.calls.check++;return window.attempt;},discard:async()=>{window.attempt=null;}}}};
window.editor={has:async()=>window.editorOpen};
window.advisorActor=false;window.reviewComments=[];window.reviewPending=null;window.reviewActions=[];window.reviewUncertain=false;window.releaseReceipt=false;window.historyRequests=[];
window.hightex.submission.advisor={
 directory:async()=>({ok:true,data:{session:context,queue:window.rows.filter(row=>row.status!=='reviewed'),students:[{id:'12',name:'Student A',nim:'A001',advisorRole:'primary',documents:window.rows.length?[{id:'server-a',title:'Dokumen mahasiswa'}]:[]}]}}),
 history:async input=>{window.historyRequests.push(input);return input.documentId==='server-a'?{ok:true,data:{session:context,documentId:'server-a',ownerId:'12',title:'Dokumen mahasiswa',items:window.rows}}:{ok:false,error:{code:'forbidden'}};},
 state:async()=>{if(window.releaseReceipt&&window.reviewPending){window.reviewComments.push({id:'late',author:'Advisor A',authorId:'24',text:window.reviewPending.comment,createdAt:null});window.reviewPending=null;window.releaseReceipt=false;}const row=window.rows[0];if(!row)return {ok:false,error:{code:'not_found'}};const comments=row.status==='reviewed'?(await window.hightex.submission.detail()).data.comments.concat(window.reviewComments):window.advisorActor?window.reviewComments:[];return {ok:true,data:{session:{...context,accountId:window.advisorActor?'24':'12'},submission:row,comments,canReview:window.advisorActor,active:row.status!=='reviewed',pending:window.reviewPending}};},
 action:async input=>{window.reviewActions.push(input);await new Promise(resolve=>setTimeout(resolve,60));if(input.action==='start')window.rows[0].status='on_review';else if(input.action==='complete'){window.rows[0].status='reviewed';window.rows[0].reviewedAt=new Date().toISOString();}else if(window.reviewUncertain){window.reviewPending={...input,baselineCommentIds:window.reviewComments.map(comment=>comment.id)};}else window.reviewComments.push({id:String(window.reviewComments.length+10),author:'Advisor A',authorId:'24',text:input.comment,createdAt:null});return window.hightex.submission.advisor.state();}
};
const root=createRoot(document.getElementById('root'));let revision=0;
window.mount=kind=>{revision++;const child=kind==='settings'?React.createElement(Routes,null,React.createElement(Route,{path:'/document/:id',element:React.createElement(Setting,{key:revision})})):kind==='cloud'?React.createElement(UserContext.Provider,{value:{user:{id:'12'},refresh:async()=>{}}},React.createElement(RemoteDocuments,{key:revision})):kind==='result'?React.createElement(SubmissionReviewResult,{key:revision,documentId:'server-a',submissionId:'1'}):kind==='page'?React.createElement(UserContext.Provider,{value:{user:{id:'12',name:'Account Student',roles:window.roles.map(name=>({name}))},refresh:async()=>{}}},React.createElement(SubmissionListView,{key:revision})):React.createElement(StudentSubmission,{key:revision,onUpdated(){}});root.render(React.createElement(React.StrictMode,null,React.createElement(kind==='settings'?MemoryRouter:BrowserRouter,kind==='settings'?{initialEntries:['/document/local-a']}:null,React.createElement(ConfirmProvider,null,child))));};
window.reset=async kind=>{window.cloudPushes=[];window.categoriesMissing=kind==='category';window.cloudLoadFails=kind==='load-failed';window.calls={prepare:0,submit:0,check:0,detail:0};window.attempt=null;window.rows=[];window.editorOpen=kind==='editor';window.linked=kind!=='unlinked';window.uncertain=kind==='timeout';window.serverIncomplete=kind==='invalid';category.variant=kind==='kp'?'intern':'thesis';await db.documents.put({...doc,profile:{...doc.profile,name:kind==='invalid'?'':doc.profile.name}});window.mount();};
window.clearDocuments=()=>db.documents.clear();
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
    `(()=>{const button=Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(text)});if(!button)throw Error('Button missing: '+${JSON.stringify(text)});button.click();})()`,
  );
const loaded = () =>
  until(
    `Boolean(document.getElementById('submission-document')) && !Array.from(document.querySelectorAll('button')).find(button=>button.getAttribute('aria-label')==='Muat ulang')?.disabled`,
  );
const chooseRecipient = async (name = "Advisor A") => {
  await execute(`document.getElementById('submission-recipient').click()`);
  await until(`Boolean(document.querySelector('[role="option"]'))`);
  await execute(
    `Array.from(document.querySelectorAll('[role="option"]')).find(option=>option.textContent.includes(${JSON.stringify(name)})).click()`,
  );
};
const startSubmission = async () => {
  await chooseRecipient();
  await clickText("Simpan dan ajukan review");
  await until(`Boolean(document.querySelector('[role="dialog"]'))`);
  await clickText("Confirm");
  await until(`document.querySelector('[role="dialog"]')===null`);
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
    assert.equal(
      await execute(
        `document.getElementById('submission-readiness').textContent.includes('Pilih pembimbing tujuan')`,
      ),
      true,
    );
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
    assert.equal(await execute("window.attempt.recipientId"), "24");
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
    for (const [kind, reason] of [
      ["unlinked", "Tautkan dokumen"],
      ["kp", "Pengajuan KP"],
      ["category", "Kategori dokumen"],
      ["load-failed", "Status pengajuan belum berhasil dimuat"],
    ]) {
      await execute(`window.reset(${JSON.stringify(kind)})`);
      await loaded();
      assert.equal(
        await execute(
          `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Simpan dan ajukan review').disabled`,
        ),
        true,
      );
      assert.equal(
        await execute(
          `document.getElementById('submission-readiness').textContent.includes(${JSON.stringify(reason)})`,
        ),
        true,
      );
      assert.equal(
        await execute(
          `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Simpan dan ajukan review').getAttribute('aria-describedby')`,
        ),
        "submission-readiness",
      );
    }
    await execute(
      `window.reset('normal').then(()=>{window.rows=[{id:'1',documentId:'server-a',title:'A',recipientId:'24',status:'waiting_for_review'}];window.mount()})`,
    );
    await loaded();
    await chooseRecipient();
    assert.equal(
      await execute(
        `document.getElementById('submission-readiness').textContent.includes('Masih ada submission')`,
      ),
      true,
    );
    await execute(
      `window.reset('normal').then(async()=>{await window.clearDocuments();window.mount()})`,
    );
    await loaded();
    assert.equal(
      await execute(
        `document.getElementById('submission-readiness').textContent.includes('Buat atau impor dokumen lokal')`,
      ),
      true,
    );
    await execute(`window.reset('editor')`);
    await loaded();
    await chooseRecipient();
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
      `window.rows[0].snapshotPurgedAt='2026-10-28T00:00:00Z';window.mount('result')`,
    );
    await until(
      `document.body.textContent.includes('File arsip sudah dibersihkan') && document.body.textContent.includes('Perbaiki bab 1')`,
    );
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
    // Advisor controls use the same result card; history remains readable after completion.
    await execute(
      `window.roles=['advisor'];window.rows=[{id:'1',documentId:'server-a',title:'Dokumen mahasiswa',ownerId:'12',studentName:'Student A',status:'waiting_for_review',reviewedAt:null}];window.mount('page')`,
    );
    await until(`document.body.textContent.includes('Mahasiswa bimbingan')`);
    await clickText("Lihat riwayat");
    await clickText("Dokumen mahasiswa");
    await until(
      `document.querySelector('a[href="/dashboard/submissions/server-a/1"]')!==null && window.historyRequests.length===1`,
    );
    assert.equal(await execute(`window.historyRequests[0].studentId`), "12");
    await execute(`window.advisorActor=true;window.mount('result')`);
    await until(`document.body.textContent.includes('Mulai review')`);
    await execute(
      `(()=>{const button=Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Mulai review');button.click();button.click();})()`,
    );
    await until(
      `Boolean(document.getElementById('review-comment')) && !document.getElementById('review-comment').disabled`,
    );
    assert.equal(
      await execute(
        `window.reviewActions.filter(action=>action.action==='start').length`,
      ),
      1,
    );
    const enterComment = async (value) =>
      execute(
        `(()=>{const input=document.getElementById('review-comment');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
    await enterComment("😀".repeat(201));
    await until(`document.body.textContent.includes('201/200')`);
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Kirim komentar').disabled`,
      ),
      true,
    );
    await enterComment("Perbaiki bab 1 😀");
    await until(`document.body.textContent.includes('16/200')`);
    await execute(
      `(()=>{const button=Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Kirim komentar');button.click();button.click();})()`,
    );
    await until(
      `window.reviewComments.length===1 && document.getElementById('review-comment').value==='' && !document.getElementById('review-comment').disabled`,
    );
    assert.equal(
      await execute(
        `window.reviewActions.filter(action=>action.action==='comment').length`,
      ),
      1,
    );
    await until(
      `document.body.textContent.includes('Perbaiki bab 1 😀') && !document.body.textContent.includes('Belum ada komentar review.')`,
    );
    await execute(
      `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
    );
    writeFileSync(
      path.join(profile, "advisor-review.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await clickText("Selesaikan review");
    await until(`Boolean(document.querySelector('[role="dialog"]'))`);
    await clickText("Cancel");
    await until(`document.querySelector('[role="dialog"]')===null`);
    assert.equal(
      await execute(
        `window.reviewActions.filter(action=>action.action==='complete').length`,
      ),
      0,
    );
    await clickText("Selesaikan review");
    await until(`Boolean(document.querySelector('[role="dialog"]'))`);
    await execute(
      `Array.from(document.querySelectorAll('[role="dialog"] button')).find(button=>button.textContent.trim()==='Selesaikan review').click()`,
    );
    await until(
      `window.rows[0].status==='reviewed' && document.getElementById('review-comment')===null`,
    );
    assert.equal(
      await execute(
        `window.reviewActions.filter(action=>action.action==='complete').length`,
      ),
      1,
    );
    await execute(`window.advisorActor=false;window.mount('result')`);
    await until(`document.body.textContent.includes('Perbaiki bab 1 😀')`);
    assert.equal(
      await execute(`document.getElementById('review-comment')===null`),
      true,
    );
    // A delayed comment stays locked across remounts, and refresh never repeats the POST.
    await execute(
      `window.advisorActor=true;window.rows[0].status='on_review';window.reviewUncertain=true;window.mount('result')`,
    );
    await until(
      `Boolean(document.getElementById('review-comment')) && !document.getElementById('review-comment').disabled`,
    );
    await enterComment("Komentar dengan respons terlambat");
    await clickText("Kirim komentar");
    await until(
      `document.body.textContent.includes('Hasil aksi belum terkonfirmasi')`,
    );
    const sent = await execute(`window.reviewActions.length`);
    await execute(`window.mount('result')`);
    await until(`document.getElementById('review-comment')?.disabled===true`);
    assert.equal(
      await execute(`document.getElementById('review-comment').value`),
      "Komentar dengan respons terlambat",
    );
    await clickText("Muat ulang");
    await until(
      `!Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Muat ulang').disabled`,
    );
    assert.equal(await execute(`window.reviewActions.length`), sent);
    await execute(`window.releaseReceipt=true`);
    await clickText("Muat ulang");
    await until(
      `!document.getElementById('review-comment').disabled && document.getElementById('review-comment').value===''`,
    );
    assert.equal(await execute(`window.reviewActions.length`), sent);
    await execute(
      `window.advisorActor=false;window.rows[0].status='on_review';window.mount('result')`,
    );
    await until(
      `document.body.textContent.includes('Komentar hasil review tersedia setelah review selesai.')`,
    );
    assert.equal(
      await execute(
        `document.getElementById('review-comment')===null && !document.body.textContent.includes('Komentar dengan respons terlambat')`,
      ),
      true,
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
    await execute(`window.reset('normal').then(()=>window.mount('cloud'))`);
    await until(
      `document.getElementById('cloud-doc-select') && !Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Simpan versi')?.disabled`,
    );
    await execute(`document.querySelector('details').open=true`);
    await clickText("Force push dokumen lokal");
    await until(`Boolean(document.querySelector('[role="dialog"]'))`);
    await clickText("Cancel");
    await until(`document.querySelector('[role="dialog"]')===null`);
    assert.equal(await execute(`window.cloudPushes.length`), 0);
    await clickText("Force push dokumen lokal");
    await until(`Boolean(document.querySelector('[role="dialog"]'))`);
    await clickText("Confirm");
    await until(
      `window.cloudPushes.length===1 && !Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Simpan versi')?.disabled`,
    );
    assert.equal(await execute(`window.cloudPushes[0].force`), true);
    await clickText("Simpan versi");
    await until(
      `window.cloudPushes.length===2 && !Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Simpan versi')?.disabled`,
    );
    assert.equal(await execute(`window.cloudPushes[1].force`), false);
    writeFileSync(
      path.join(profile, "cloud-desktop.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    win.setSize(480, 900);
    await execute(
      `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
    );
    assert.equal(
      await execute(
        `document.documentElement.scrollWidth <= window.innerWidth`,
      ),
      true,
    );
    writeFileSync(
      path.join(profile, "cloud-mobile.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    console.log(
      JSON.stringify({
        submissionUI: "passed",
        submissionDisabledReasons: true,
        cloudForceConfirmationAndCancellation: true,
        cloudResponsiveLayout: true,
        frozenExport: true,
        linkedAndKPGuards: true,
        editorAndAuthorValidation: true,
        uncertainRemount: true,
        reviewCommentsEscaped: true,
        webHistoryWithoutCloud: true,
        multiRoleContexts: true,
        cloudAcademicAutofillAndLocks: true,
        localAuthorStillEditable: true,
        advisorHistoryAndReview: true,
        advisorDuplicateAndUnicodeGuards: true,
        advisorPendingRecovery: true,
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
    if (win && !win.isDestroyed())
      console.error(
        await execute("document.body.innerText.slice(0,1200)").catch(
          () => "UI unavailable",
        ),
      );
    win?.destroy();
    server?.close();
    await vite?.close();
    app.exit(1);
  });
