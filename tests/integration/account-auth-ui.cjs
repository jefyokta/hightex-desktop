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
const html = `<!doctype html><html><body><div id="root" style="max-width:760px;margin:auto;padding:24px"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';import {AccountProfile} from '/src/components/account-profile.tsx';import {LoginModal} from '/src/components/login-modal.tsx';import {AuthModalProvider,useAuthModal} from '/src/context/auth-modal-context.tsx';import {ConfirmProvider} from '/src/context/confrim-context.tsx';import {UserContext} from '/src/context/user-context.tsx';import {HighTexDB} from '/src/editor/storage/hightex-db.ts';import '/src/App.css';
window.config={get:()=>({language:'id'})};const session={sessionId:'session-a',accountId:'12',serverUrl:'http://fixture/api/'};
const db=HighTexDB.getInstance();await db.open();window.db=db;const local=id=>({id,title:id==='a'?'Local A':id==='b'?'Local B':'Cloud C',altTitle:'',category:'1',keywords:{indonesian:[],english:[]},config:{},profile:{name:'Local '+id,nim:'NIM '+id,advisorName:'Advisor',advisorNip:'NIP',cv:'<p>Manual CV '+id+'</p>'}});await db.documents.bulkPut(['a','b','cloud'].map(local));
window.profileData={session,name:'Server Student',nim:'SERVER001',email:'server@test',roles:['student'],cv:'<p>CV server<img src=x onerror="window.compromised=true"></p>',picturePath:null};window.calls=[];window.validation=false;window.compromised=false;window.editorOpen=false;window.authCalls=[];window.browserState={status:'idle'};
window.hightex={submission:{context:async()=>({ok:true,data:session})},cloud:{academic:{locked:async id=>id==='cloud'}}};window.editor={has:async()=>window.editorOpen};
window.account={load:async()=>({ok:true,data:window.profileData}),picture:async()=>({ok:true,data:null}),update:async input=>{window.calls.push(input);if(window.validation)return {ok:false,error:'validation',fields:{cv:['CV tidak valid dari server']}};if(input.cv!==undefined)window.profileData={...window.profileData,cv:input.cv};return {ok:true,data:window.profileData}}};
window.session={signIn:async(email,password)=>{window.authCalls.push('direct');return {ok:true,data:{id:'12',name:'Server Student',roles:[]}}},browser:{start:async()=>{window.authCalls.push('browser');window.browserState={status:'waiting',expiresAt:Date.now()+300000};return {ok:true,data:window.browserState}},status:async()=>window.browserState,cancel:async()=>{window.authCalls.push('cancel');window.browserState={status:'idle'}}}};
const Helpers=()=>{const auth=useAuthModal();window.openLogin=auth.openLogin;return React.createElement(LoginModal)};
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(BrowserRouter,null,React.createElement(AuthModalProvider,null,React.createElement(UserContext.Provider,{value:{user:{id:'12',name:'Server Student',roles:[{name:'student'}]},refresh:async()=>{}}},React.createElement(ConfirmProvider,null,React.createElement(AccountProfile),React.createElement(Helpers)))))));window.ready=true;
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
    `(()=>{const button=Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(text)});if(!button)throw Error('Missing button');button.click()})()`,
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
      `window.ready===true && document.querySelector('[contenteditable]')?.textContent.includes('CV server')`,
    );
    assert.equal(
      await execute(
        `document.querySelector('img')===null && !window.compromised`,
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
