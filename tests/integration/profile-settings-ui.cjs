// Isolated renderer checks for the actual Profile page; no real accounts or files.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const artifacts = mkdtempSync(
  path.join(os.tmpdir(), "hightex-profile-settings-"),
);
app.setPath("userData", artifacts);
let vite, server, win;
let preventedCloses = 0;
const html = `<!doctype html><html><body><div id="root" class="workspace mx-auto max-w-5xl space-y-6 p-8"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {Profile} from '/src/pages/profile.tsx';
import {ProfileCV} from '/src/pages/profile-cv.tsx';
import {UserContext} from '/src/context/user-context.tsx';
import {AuthModalProvider} from '/src/context/auth-modal-context.tsx';
import {useAuthModal} from '/src/context/auth-modal-context.tsx';
import {LoginModal} from '/src/components/login-modal.tsx';
import {ConfirmProvider} from '/src/context/confrim-context.tsx';
import {TooltipProvider} from '/src/components/ui/tooltip.tsx';
import {Toaster} from 'sonner';
import '/src/App.css';
import '/src/css/workspace.css';
window.config={get:()=>({language:'en'}),onChange:()=>()=>{}};
window.fixtureOnline=true;
Object.defineProperty(navigator,'onLine',{get:()=>window.fixtureOnline});
window.setOnline=online=>{window.fixtureOnline=online;window.dispatchEvent(new Event(online?'online':'offline'))};
window.savedLocal={name:'Local Writer',nim:'001',advisorName:'Advisor',advisorNip:'002',committee:{},cv:'<p>Saved local CV</p>'};
window.cachedCloud={name:'Cached Writer',nim:'C001',cv:'<p>Saved offline CV<script>window.compromised=true;</scr'+'ipt><img src=x onerror="window.compromised=true"></p>'};
window.accountData={session:{sessionId:'session-a',accountId:'12',serverUrl:'http://fixture/api/'},name:'Account Writer',nim:'C001',email:'account@fixture.test',roles:['student'],cv:'<p>Server CV</p>',picturePath:null};
window.compromised=false;window.updates=[];window.loads=0;window.localSaves=0;window.failLocalLoad=false;window.failUpdate=false;window.draftBusy=false;
window.application={setProfileDraftBusy:async busy=>{window.draftBusy=busy}};
window.authCalls=[];window.browserState={status:'idle'};
window.session={signIn:async()=>{window.authCalls.push('direct');window.setUser(true);return {ok:true,data:{id:'12',name:'Account Writer',roles:[]}}},browser:{start:async()=>{window.authCalls.push('browser');window.browserState={status:'waiting',expiresAt:Date.now()+300000};return {ok:true,data:window.browserState}},status:async()=>window.browserState,cancel:async()=>{window.authCalls.push('cancel');window.browserState={status:'idle'}}}};
window.profile={get:async()=>{if(window.failLocalLoad)throw Error('Failed read');return {...window.savedLocal,isCloud:false}},picture:async()=>false,cachedCloud:async()=>window.cachedCloud,set:async profile=>{window.localSaves++;if(window.delaySave)await new Promise(resolve=>window.finishSave=resolve);window.savedLocal={...window.savedLocal,...profile};return window.savedLocal},setPicture:async()=>{}};
window.hightex={onboarding:{acknowledgeProfileSetup:async()=>{}},lecturers:{list:async()=>({data:[]})}};
window.workspaces={onChange:()=>()=>{},state:async()=>({activeId:window.mode,profiles:[{id:window.mode,name:window.mode==='local'?'My Local':'My Cloud',type:window.mode,accountId:window.mode==='cloud'?'12':null}],migrationComplete:true})};
window.account={load:async()=>{window.loads++;if(!window.fixtureOnline)return {ok:false,error:'request_failed'};return {ok:true,data:structuredClone(window.accountData)}},picture:async()=>({ok:true,data:null}),update:async input=>{window.updates.push(input);if(window.failUpdate)return {ok:false,error:'validation',fields:{cv:['Fixture rejects CV']}};window.accountData={...window.accountData,cv:input.cv??window.accountData.cv};window.cachedCloud={name:window.accountData.name,nim:window.accountData.nim,cv:window.accountData.cv};return {ok:true,data:structuredClone(window.accountData)}},settings:async()=>({ok:true,data:null})};
const actor={id:'12',name:'Account Writer',roles:[{name:'student'}]};
function LoginActions(){window.openLogin=useAuthModal().openLogin;return React.createElement(LoginModal)}
function Providers({router,authenticated}){const [user,setUser]=React.useState(authenticated?actor:false);window.setUser=enabled=>setUser(enabled?actor:false);return React.createElement(UserContext.Provider,{value:{user,refresh:async()=>{}}},React.createElement(AuthModalProvider,null,React.createElement(ConfirmProvider,null,React.createElement(TooltipProvider,null,React.createElement(RouterProvider,{router}),React.createElement(Toaster),React.createElement(LoginActions)))))}
const root=createRoot(document.getElementById('root'));let mounted=0;
window.mountProfile=(mode,online=true,authenticated=true,route='/profile')=>{window.mode=mode;window.fixtureOnline=online;window.router=createMemoryRouter([{path:'/profile',element:React.createElement(Profile)},{path:'/profile/cv',element:React.createElement(ProfileCV)},{path:'/elsewhere',element:React.createElement('p',{'data-elsewhere':true},'Other page')}],{initialEntries:[route]});root.render(React.createElement(React.StrictMode,null,React.createElement(Providers,{key:++mounted,router:window.router,authenticated})))};
window.mountProfile('local');
</script></body></html>`;
const execute = (code) => win.webContents.executeJavaScript(code, true);
async function until(code) {
  const deadline = Date.now() + 20000;
  while (!(await execute(`Boolean(${code})`))) {
    if (Date.now() > deadline) throw Error("Timed out: " + code);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
const click = (label) =>
  execute(
    `(()=>{const button=Array.from(document.querySelectorAll('button')).find(item=>item.textContent.trim()===${JSON.stringify(label)});if(!button)throw Error('Missing button: '+${JSON.stringify(label)});button.click()})()`,
  );
const typeName = (value) =>
  execute(
    `(()=>{const input=document.querySelector('[data-tour="default-profile-identity"] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}))})()`,
  );
const cvSelector = '[role="textbox"][aria-labelledby="cloud-cv-label"]';
const typeCV = (text) =>
  execute(
    `(()=>{const input=document.querySelector(${JSON.stringify(cvSelector)});input.textContent=${JSON.stringify(text)};input.dispatchEvent(new Event('input',{bubbles:true}))})()`,
  );
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
    server = createServer(async (request, response) => {
      if (request.url === "/") {
        response.setHeader("content-type", "text/html");
        response.end(await vite.transformIndexHtml("/", html));
      } else
        vite.middlewares(request, response, () => {
          response.writeHead(404);
          response.end();
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    win = new BrowserWindow({
      show: false,
      width: 1100,
      height: 900,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    win.webContents.on("console-message", (event) => {
      if (event.level === "error") console.error(event.message);
    });
    win.webContents.on("will-prevent-unload", () => {
      preventedCloses++;
    });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
    await until(
      `document.querySelector('[data-tour=default-profile-identity] input') && document.querySelector('[data-profile-cv-link]')`,
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-tour="default-profile-save"]').disabled`,
      ),
      true,
    );
    await typeName("Unsaved writer");
    await until(
      `!document.querySelector('[data-tour="default-profile-save"]').disabled`,
    );
    win.close();
    const closeDeadline = Date.now() + 5000;
    while (!preventedCloses && Date.now() < closeDeadline)
      await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(preventedCloses, 1, "dirty profile prevents native close");
    assert.equal(win.isDestroyed(), false);
    await execute(`window.router.navigate('/elsewhere')`);
    await until(`document.querySelector('[role="dialog"]')`);
    await click("Stay");
    await until(`!document.querySelector('[role="dialog"]')`);
    assert.equal(
      await execute(
        `document.querySelector('[data-tour="default-profile-identity"] input').value`,
      ),
      "Unsaved writer",
    );
    await execute(`window.delaySave=true`);
    await click("Save profile");
    await until(`window.draftBusy && typeof window.finishSave==='function'`);
    await execute(`window.router.navigate('/elsewhere')`);
    await until(
      `document.querySelector('[role="dialog"]')?.textContent.includes('operation in progress')`,
    );
    assert.equal(
      await execute(
        `document.querySelector('[role="dialog"]').textContent.includes('Discard changes')`,
      ),
      false,
    );
    await execute(`window.finishSave()`);
    await until(`document.querySelector('[data-elsewhere]')`);
    assert.equal(await execute(`window.savedLocal.name`), "Unsaved writer");
    await execute(`window.delaySave=false;window.mountProfile('local')`);
    await until(
      `document.querySelector('[data-tour=default-profile-identity] input')`,
    );
    await typeName("Discard me");
    await execute(`window.router.navigate('/elsewhere')`);
    await until(`document.querySelector('[role="dialog"]')`);
    await click("Discard changes");
    await until(`document.querySelector('[data-elsewhere]')`);
    assert.equal(await execute(`window.savedLocal.name`), "Unsaved writer");
    await execute(`window.mountProfile('local')`);
    await until(`document.querySelector('[data-profile-cv-link]')`);
    assert.equal(
      await execute(`Boolean(document.querySelector('#workspace-cv'))`),
      false,
    );
    await execute(`document.querySelector('a[href="/profile/cv"]').click()`);
    await until(
      `document.querySelector('#workspace-cv')?.textContent==='Saved local CV'`,
    );
    assert.equal(
      await execute(
        `Boolean(document.querySelector('[data-profile-cv-page]'))`,
      ),
      true,
    );
    await execute(
      `document.querySelector('#workspace-cv').textContent='Updated global CV';document.querySelector('#workspace-cv').dispatchEvent(new Event('input',{bubbles:true}))`,
    );
    await execute(`document.querySelector('a[href="/profile"]').click()`);
    await until(`document.querySelector('[role="dialog"]')`);
    await click("Stay");
    await until(`!document.querySelector('[role="dialog"]')`);
    await execute(
      `document.querySelector('[data-tour="workspace-cv-save"]').click()`,
    );
    await until(
      `window.savedLocal.cv==='Updated global CV' && !window.draftBusy`,
    );
    assert.equal(await execute(`window.savedLocal.name`), "Unsaved writer");
    await execute(`document.querySelector('a[href="/profile"]').click()`);
    await until(
      `document.querySelector('[data-profile-cv-link]') && !document.querySelector('#workspace-cv')`,
    );
    await execute(`window.mountProfile('cloud',false,false)`);
    await until(
      `document.querySelector('[data-profile-cv-link]') && document.body.textContent.includes('Cached Writer')`,
    );
    assert.equal(
      await execute(`Boolean(document.querySelector('#cloud-cv'))`),
      false,
    );
    await execute(`document.querySelector('a[href="/profile/cv"]').click()`);
    await until(
      `document.querySelector(${JSON.stringify(cvSelector)})?.textContent==='Saved offline CV'`,
    );
    assert.equal(
      await execute(
        `document.querySelector(${JSON.stringify(cvSelector)}).contentEditable`,
      ),
      "false",
    );
    assert.equal(
      await execute(`window.loads`),
      0,
      "offline opening never fetches account",
    );
    assert.equal(await execute(`window.compromised`), false);
    await execute(`window.setUser(true);window.setOnline(true)`);
    await until(
      `document.querySelector(${JSON.stringify(cvSelector)})?.textContent==='Server CV' && document.querySelector(${JSON.stringify(cvSelector)}).isContentEditable`,
    );
    await typeCV("Draft Cloud CV");
    await execute(`window.setOnline(false);window.setUser(false)`);
    await until(
      `document.querySelector(${JSON.stringify(cvSelector)}).contentEditable==='false' && document.body.textContent.includes('unsaved changes are kept')`,
    );
    assert.equal(
      await execute(
        `document.querySelector(${JSON.stringify(cvSelector)}).textContent`,
      ),
      "Draft Cloud CV",
    );
    assert.equal(await execute(`window.updates.length`), 0);
    await execute(`window.setUser(true);window.setOnline(true)`);
    await until(
      `document.querySelector(${JSON.stringify(cvSelector)}).isContentEditable`,
    );
    assert.equal(
      await execute(
        `document.querySelector(${JSON.stringify(cvSelector)}).textContent`,
      ),
      "Draft Cloud CV",
    );
    await execute(`window.failUpdate=true`);
    await click("Save CV and photo");
    await until(`document.body.textContent.includes('Fixture rejects CV')`);
    assert.equal(await execute(`window.accountData.cv`), "<p>Server CV</p>");
    await execute(`window.failUpdate=false`);
    await click("Save CV and photo");
    await until(
      `window.accountData.cv==='Draft Cloud CV' && !window.draftBusy`,
    );
    assert.equal(await execute(`window.updates.length`), 2);
    await execute(`window.router.navigate('/elsewhere')`);
    await until(`document.querySelector('[data-elsewhere]')`);
    await execute(`window.mountProfile('cloud',false,false,'/profile/cv')`);
    await until(
      `document.querySelector(${JSON.stringify(cvSelector)})?.textContent==='Draft Cloud CV'`,
    );
    writeFileSync(
      path.join(artifacts, "cloud-offline.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await execute("window.setOnline(true);window.openLogin()");
    await until("document.querySelector('input[type=password]')");
    await click("Sign in with browser");
    await until(
      "document.body.textContent.includes('Complete sign-in in your browser')",
    );
    await click("Cancel browser sign-in");
    await until("!document.querySelector('input[type=password]').disabled");
    await execute(
      `(()=>{for(const [type,value] of [['email','account@fixture.test'],['password','fixture-password']]){const input=document.querySelector('input[type='+type+']');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))}})()`,
    );
    await click("Sign in");
    await until(
      `!document.querySelector('input[type=password]') && document.querySelector(${JSON.stringify(cvSelector)}).isContentEditable`,
    );
    assert.deepEqual(await execute("window.authCalls"), [
      "browser",
      "cancel",
      "direct",
    ]);
    console.log(
      "PASS: separate Local/Cloud CV pages from Profile; shared paper editor; identity preserved on CV save; draft stay/discard; pending-save protection; native close prevention; Cloud offline cache and sanitization; draft retained across offline/session expiry; explicit save and validation recovery; browser login cancellation and direct re-login.",
    );
    console.log("Artifacts:", artifacts);
  })
  .catch(async (error) => {
    console.error(error);
    if (win && !win.isDestroyed())
      console.error(
        await execute("document.body.innerText.slice(0,2500)").catch(
          () => "Unavailable",
        ),
      );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (win && !win.isDestroyed()) win.destroy();
    server?.close();
    await vite?.close();
    app.exit(process.exitCode || 0);
  });
