// Actual account/login components, fixture APIs, isolated profile.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const profile = mkdtempSync(path.join(os.tmpdir(), "hightex-account-ui-"));
app.setPath("userData", profile);
let vite, server, win;
const html = `<!doctype html><html><head><style>#root>aside{position:fixed;inset:0 auto 0 0;width:240px}#root>header{margin-bottom:24px}</style></head><body><div id="root" class="workspace" style="margin-left:240px;padding:24px"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route,useNavigate} from 'react-router-dom';import {AccountProfile} from '/src/components/account-profile.tsx';import {CloudCVEditor} from '/src/pages/cloud/cv.tsx';import {Sidebar} from '/src/components/dashboard/sidebar.tsx';import {workspacePageLabel} from '/src/components/dashboard/navigation.ts';import {LoginModal} from '/src/components/login-modal.tsx';import {AuthModalProvider,useAuthModal} from '/src/context/auth-modal-context.tsx';import {LogoutModalProvider} from '/src/context/logout-modal-context.tsx';import {ConfirmProvider} from '/src/context/confrim-context.tsx';import {UserContext} from '/src/context/user-context.tsx';import {HighTexDB} from '/src/editor/storage/hightex-db.ts';import '/src/App.css';
window.config={get:()=>({language:'id'})};const session={sessionId:'session-a',accountId:'12',serverUrl:'http://fixture/api/'};
import '/src/css/workspace.css';
const db=HighTexDB.getInstance();await db.open();window.db=db;const local=id=>({id,title:id==='a'?'Local A':id==='b'?'Local B':'Cloud C',altTitle:'',category:'1',keywords:{indonesian:[],english:[]},config:{},profile:{name:'Local '+id,nim:'NIM '+id,advisorName:'Advisor',advisorNip:'NIP',cv:'<p>Manual CV '+id+'</p>'}});await db.documents.bulkPut(['a','b','cloud'].map(local));
window.profileData={session,name:'Server Student',nim:'SERVER001',email:'server@test',roles:['student'],cv:'<p>CV server<img src=x onerror="window.compromised=true"></p>',picturePath:null};window.calls=[];window.validation=false;window.compromised=false;window.editorOpen=false;window.authCalls=[];window.browserState={status:'idle'};
window.hightex={submission:{context:async()=>({ok:true,data:session})},cloud:{academic:{locked:async id=>id==='cloud'}}};window.editor={has:async()=>window.editorOpen};
window.fixtureOnline=true;Object.defineProperty(navigator,'onLine',{get:()=>window.fixtureOnline});window.savedPhoto=null;window.unknown=false;window.loadFailure=false;
window.account={load:async()=>window.loadFailure?{ok:false,error:'request_failed'}:{ok:true,data:window.profileData},picture:async()=>({ok:true,data:window.savedPhoto}),update:async input=>{window.calls.push(input);if(window.unknown)return {ok:false,error:'outcome_unknown'};if(window.validation)return {ok:false,error:'validation',fields:{cv:['CV tidak valid dari server']}};if(input.cv!==undefined)window.profileData={...window.profileData,cv:input.cv};if(input.image)window.savedPhoto={bytes:input.image.bytes,type:input.image.type};return {ok:true,data:window.profileData}}};
window.session={signIn:async(email,password)=>{window.authCalls.push('direct');return {ok:true,data:{id:'12',name:'Server Student',roles:[]}}},browser:{start:async()=>{window.authCalls.push('browser');window.browserState={status:'waiting',expiresAt:Date.now()+300000};return {ok:true,data:window.browserState}},status:async()=>window.browserState,cancel:async()=>{window.authCalls.push('cancel');window.browserState={status:'idle'}}}};
const Helpers=()=>{const auth=useAuthModal();window.openLogin=auth.openLogin;window.navigate=useNavigate();window.pageLabel=workspacePageLabel(location.pathname);return React.createElement(LoginModal)};
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(BrowserRouter,null,React.createElement(AuthModalProvider,null,React.createElement(LogoutModalProvider,null,React.createElement(UserContext.Provider,{value:{user:{id:'12',name:'Server Student',roles:[{name:'student'}]},refresh:async()=>{}}},React.createElement(ConfirmProvider,null,React.createElement(Sidebar),React.createElement(Routes,null,React.createElement(Route,{path:'/',element:React.createElement(AccountProfile)}),React.createElement(Route,{path:'/dashboard/cloud/cv',element:React.createElement(CloudCVEditor)})),React.createElement(Helpers))))))));window.ready=true;
</script></body></html>`;
const execute = (code) => win.webContents.executeJavaScript(code);
const until = async (code) => {
  const start = Date.now();
  while (!(await execute(code))) {
    if (Date.now() - start > 30000) throw Error("Timed out: " + code);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};
const click = (text) =>
  execute(
    `(()=>{const button=Array.from(document.querySelectorAll('button,a')).find(button=>button.textContent.trim()===${JSON.stringify(text)});if(!button)throw Error('Missing button: '+${JSON.stringify(text)});button.click()})()`,
  );
const choose = async (text) => {
  await execute(
    `document.querySelector('[role="combobox"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}))`,
  );
  await until(`Boolean(document.querySelector('[role="option"]'))`);
  await execute(
    `Array.from(document.querySelectorAll('[role="option"]')).find(option=>option.textContent.trim()===${JSON.stringify(text)}).click()`,
  );
  await until(`document.querySelector('[role="listbox"]')===null`);
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
      height: 1000,
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
    await until(
      `window.ready===true && document.body.textContent.includes('CV server')`,
    );
    assert.equal(
      await execute(
        `document.querySelector('[contenteditable]')===null && document.querySelector('input[type="file"]')===null && !window.compromised`,
      ),
      true,
    );
    await execute(`window.loadFailure=true`);
    await click("Edit CV dan foto profil");
    await until(
      `document.querySelector('[role="alert"]')?.textContent.includes('Gagal memuat profil')`,
    );
    assert.equal(
      await execute(
        `document.querySelector('[contenteditable]').contentEditable`,
      ),
      "false",
    );
    await execute(`window.loadFailure=false`);
    await click("Muat ulang");
    await until(
      `document.querySelector('[contenteditable="true"]')?.textContent.includes('CV server')`,
    );
    assert.equal(await execute(`window.pageLabel`), "cloud_cv.navigation");
    assert.equal(
      await execute(
        `document.querySelector('aside [aria-current="page"]').textContent`,
      ),
      "CV dan foto profil",
    );
    assert.equal(
      await execute(
        `document.querySelector('[contenteditable] img')===null && !window.compromised`,
      ),
      true,
    );
    await execute(
      `(()=>{const el=document.querySelector('[contenteditable]');el.innerHTML='<p>CV edited</p>';el.dispatchEvent(new Event('input',{bubbles:true}));window.validation=true})()`,
    );
    await click("Simpan profil akun");
    await until(
      `document.body.textContent.includes('CV tidak valid dari server')`,
    );
    assert.equal(
      await execute(`document.querySelector('[contenteditable]').textContent`),
      "CV edited",
    );
    await execute(`window.validation=false`);
    await click("Simpan profil akun");
    await until(
      `document.body.textContent.includes('Profil akun tersimpan di server.')`,
    );
    assert.equal(await execute(`window.calls.length`), 2);
    assert.equal(await execute(`window.calls[1].cv`), "<p>CV edited</p>");
    // Corrupt images fail conversion; PNG and GIF inputs become WEBP uploads.
    assert.equal(
      await execute(`document.querySelector('input[type="file"]').accept`),
      "image/*",
    );
    await execute(
      `(()=>{const input=document.querySelector('input[type="file"]');const files=new DataTransfer();files.items.add(new File(['svg'],'bad.svg',{type:'image/svg+xml'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`,
    );
    await until(
      `document.querySelector('[role="alert"]')?.textContent.includes('Gambar tidak dapat diproses')`,
    );
    assert.equal(await execute(`window.calls.length`), 2);
    await execute(
      `(async()=>{const canvas=document.createElement('canvas');canvas.width=6;canvas.height=8;canvas.getContext('2d').fillRect(0,0,6,8);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const input=document.querySelector('input[type="file"]');const files=new DataTransfer();files.items.add(new File([png],'photo.png'));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`,
    );
    await until(
      `document.querySelector('button[aria-label="Foto akun"] img')?.naturalWidth===6`,
    );
    await click("Batalkan foto baru");
    await until(
      `!document.querySelector('button[aria-label="Foto akun"] img')`,
    );
    // Source size may exceed 2 MB, provided the converted WEBP fits the API limit.
    await execute(
      `(()=>{const bytes=Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),c=>c.charCodeAt(0));const input=document.querySelector('input[type="file"]');const files=new DataTransfer();files.items.add(new File([bytes,new Uint8Array(2*1024*1024)],'photo.gif',{type:'image/gif'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`,
    );
    await until(
      `document.querySelector('button[aria-label="Foto akun"] img')?.naturalWidth===1`,
    );
    await click("Simpan profil akun");
    await until(
      `window.calls.length===3 && document.body.textContent.includes('Profil akun tersimpan di server.')`,
    );
    assert.equal(
      await execute(
        `window.calls[2].cv===undefined && window.calls[2].image.type==='image/webp' && window.calls[2].image.name==='photo.webp' && window.calls[2].image.bytes.length<=2*1024*1024 && new TextDecoder().decode(window.calls[2].image.bytes.slice(8,12))==='WEBP'`,
      ),
      true,
    );
    // Offline edits remain in the form, and an unknown outcome requires a reload.
    await execute(
      `window.fixtureOnline=false;window.dispatchEvent(new Event('offline'))`,
    );
    await until(
      `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Simpan profil akun').disabled`,
    );
    await execute(
      `(()=>{const el=document.querySelector('[contenteditable]');el.innerHTML='Offline draft';el.dispatchEvent(new Event('input',{bubbles:true}));window.fixtureOnline=true;window.dispatchEvent(new Event('online'));window.unknown=true})()`,
    );
    await until(
      `!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Simpan profil akun').disabled`,
    );
    await click("Simpan profil akun");
    await until(
      `document.body.textContent.includes('Hasil penyimpanan belum diketahui')`,
    );
    assert.equal(
      await execute(`document.querySelector('[contenteditable]').textContent`),
      "Offline draft",
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Simpan profil akun').disabled`,
      ),
      true,
    );
    await execute(`window.unknown=false`);
    await click("Muat ulang");
    await until(`Boolean(document.querySelector('[role="dialog"]'))`);
    await click("Cancel");
    await until(`document.querySelector('[role="dialog"]')===null`);
    assert.equal(
      await execute(
        `document.body.textContent.includes('Hasil penyimpanan belum diketahui') && document.querySelector('[contenteditable]').textContent==='Offline draft'`,
      ),
      true,
    );
    await click("Muat ulang");
    await until(`Boolean(document.querySelector('[role="dialog"]'))`);
    await click("Confirm");
    await until(`document.querySelector('[role="dialog"]')===null`);
    await until(
      `document.querySelector('[contenteditable="true"]')?.textContent==='CV edited'`,
    );
    writeFileSync(
      path.join(profile, "cloud-cv.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await execute(`window.navigate('/')`);
    await until(`Boolean(document.querySelector('[role="combobox"]'))`);
    await choose("Local A");
    await until(`document.body.textContent.includes('Nama penulis')`);
    await execute(`document.querySelector('input[type="checkbox"]').click()`);
    await click("Terapkan ke dokumen lokal");
    await until(`Boolean(document.querySelector('[role="dialog"]'))`);
    await click("Confirm");
    await until(`document.querySelector('[role="dialog"]')===null`);
    await until(
      `document.body.textContent.includes('Field terpilih sudah diterapkan')`,
    );
    assert.deepEqual(
      await execute(
        `Promise.all(['a','b'].map(id=>window.db.documents.get(id).then(doc=>({name:doc.profile.name,cv:doc.profile.cv}))))`,
      ),
      [
        { name: "Server Student", cv: "<p>Manual CV a</p>" },
        { name: "Local b", cv: "<p>Manual CV b</p>" },
      ],
    );
    await choose("Cloud C");
    await click("Terapkan ke dokumen lokal");
    await until(`Boolean(document.querySelector('[role="dialog"]'))`);
    await click("Confirm");
    await until(`document.querySelector('[role="dialog"]')===null`);
    await until(
      `document.body.textContent.includes('hanya untuk dokumen lokal')`,
    );
    assert.equal(
      await execute(
        `(async()=> (await window.db.documents.get('cloud')).profile.name)()`,
      ),
      "Local cloud",
    );
    writeFileSync(
      path.join(profile, "account-profile.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await execute(`window.openLogin()`);
    await until(`document.body.textContent.includes('Masuk melalui browser')`);
    await click("Masuk melalui browser");
    await until(
      `document.body.textContent.includes('Selesaikan login di browser')`,
    );
    assert.equal(
      await execute(
        `document.querySelector('input[type="password"]').disabled`,
      ),
      true,
    );
    await click("Batalkan login browser");
    await until(`!document.querySelector('input[type="password"]').disabled`);
    await execute(
      `(()=>{for(const [type,value] of [['email','demo@test.local'],['password','fixture-password']]){const el=document.querySelector('input[type="'+type+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))}})()`,
    );
    await click("Masuk");
    await until(`document.querySelector('input[type="password"]')===null`);
    assert.deepEqual(await execute(`window.authCalls`), [
      "browser",
      "cancel",
      "direct",
    ]);
    console.log(
      JSON.stringify({
        accountAuthUI: "passed",
        CVSanitized: true,
        validationAndSave: true,
        settingsLinkAndCloudSidebar: true,
        photoOnlySave: true,
        imagesConvertedToWebp: true,
        offlineDraftAndUnknownOutcome: true,
        failedLoadRetry: true,
        selectedDocumentOnly: true,
        cloudApplyBlocked: true,
        browserStartCancelAndDirectLogin: true,
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
    console.error(error.stack || error);
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
