// Real welcome dialog and guide hook, with isolated workspace/IPC fixtures.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const artifacts = mkdtempSync(path.join(os.tmpdir(), "hightex-welcome-"));
app.setPath("userData", artifacts);
let vite, server, win;
const html = `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom';
import {WorkspaceWelcomeDialog} from '/src/components/workspace-welcome-dialog.tsx';
import {AuthModalProvider,useAuthModal} from '/src/context/auth-modal-context.tsx';
import {useUIGuide} from '/src/hooks/use-ui-guide.ts';
import {Toaster,toast} from 'sonner';
import '/src/App.css';
import '/src/css/workspace.css';
const records={};const listeners=new Set();
window.failLanguage=false;window.failAck=false;
window.dismissToasts=()=>toast.dismiss();
window.application={};
window.config={get:()=>records[window.activeId].config,onChange:cb=>{listeners.add(cb);return()=>listeners.delete(cb)},set:async patch=>{if(window.failLanguage)throw Error('Write failed');Object.assign(records[window.activeId].config,patch);listeners.forEach(cb=>cb(window.config.get()))}};
window.workspaces={state:async()=>({activeId:window.activeId,profiles:[records[window.activeId].workspace],migrationComplete:true}),onChange:()=>()=>{}};
window.hightex={onboarding:{status:async()=>structuredClone(records[window.activeId].status),acknowledgeProfileSetup:async()=>{if(window.failAck)throw Error('Write failed');records[window.activeId].acks++;records[window.activeId].status.profileSetupPending=false;return structuredClone(records[window.activeId].status)},acknowledge:async()=>{}}};
window.inspect=id=>structuredClone(records[id]);
window.bindCloud=()=>{Object.assign(records[window.activeId].workspace,{pendingCloudBinding:false,accountId:'account-1'});window.dispatchEvent(new Event('workspaces:changed'))};
function Screen(){const {pathname}=useLocation();const guide=useUIGuide('workspace',pathname==='/profile'||pathname==='/workspaces');const auth=useAuthModal();window.navigate=useNavigate();window.openLogin=auth.openLogin;window.closeLogin=auth.closeLogin;window.guide=guide;return React.createElement(React.Fragment,null,React.createElement('main',{'data-page':pathname},pathname),React.createElement(WorkspaceWelcomeDialog),React.createElement(Toaster))}
const root=createRoot(document.getElementById('root'));let generation=0;
window.mountWelcome=(id,type='local',route='/dashboard',editor=false)=>{window.activeId=id;window.application.editorDocumentId=editor?'document-1':undefined;records[id]??={workspace:{id,name:id,type,accountId:null,pendingCloudBinding:type==='cloud'},config:{language:'en'},acks:0,status:{time:new Date().toISOString(),firstInstalled:true,installedVersion:'1.4.2',currentVersion:'1.4.2',previousVersion:null,versionChanged:false,seenGuides:{},profileSetupPending:true}};root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,{key:++generation,initialEntries:[route]},React.createElement(AuthModalProvider,null,React.createElement(Screen)))))};
window.mountWelcome('Local writing');
</script></body></html>`;
const execute = (code) => win.webContents.executeJavaScript(code, true);
async function until(code) {
  const deadline = Date.now() + 15000;
  while (!(await execute(`Boolean(${code})`))) {
    if (Date.now() > deadline) throw Error("Timed out: " + code);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
const welcome =
  "document.querySelector('[data-workspace-welcome][data-state=open]')";
const changeLanguage = (language) =>
  execute(
    `(()=>{const select=document.querySelector('#workspace-welcome-language');select.value=${JSON.stringify(language)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`,
  );
async function settled() {
  await execute(
    "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
  );
  await execute("new Promise(resolve=>setTimeout(resolve,200))");
}
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
      width: 900,
      height: 760,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    win.webContents.on("console-message", (event) => {
      if (event.level === "error") console.error(event.message);
    });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
    await until(welcome);
    assert.match(
      await execute(`${welcome}.textContent`),
      /Welcome to Local writing/,
    );
    await until("window.guide.status?.profileSetupPending");
    assert.equal(
      await execute("window.guide.plan"),
      null,
      "welcome precedes automatic guides",
    );
    await execute("window.failLanguage=true");
    await changeLanguage("id");
    await until(
      "document.body.textContent.includes('Your language could not be saved')",
    );
    assert.equal(
      await execute("window.inspect('Local writing').config.language"),
      "en",
    );
    await execute("window.failLanguage=false");
    await changeLanguage("id");
    await until(
      `${welcome}?.textContent.includes('Selamat datang di Local writing')`,
    );
    assert.equal(
      await execute("window.inspect('Local writing').config.language"),
      "id",
    );
    await execute("window.dismissToasts()");
    await settled();
    writeFileSync(
      path.join(artifacts, "welcome-local-id.png"),
      (await win.webContents.capturePage()).toPNG(),
    );

    await execute(
      "window.failAck=true;document.querySelector('[data-welcome-profile]').click()",
    );
    await until(
      "document.body.textContent.includes('gagal') && !document.querySelector('[data-welcome-profile]').disabled",
    );
    assert.equal(
      await execute(`Boolean(${welcome})`),
      true,
      "failed acknowledgment preserves welcome",
    );
    await execute(
      "window.failAck=false;document.querySelector('[data-welcome-profile]').click()",
    );
    await until(
      "document.querySelector('[data-page=\"/profile\"]') && !document.querySelector('[data-workspace-welcome]')",
    );
    assert.equal(await execute("window.inspect('Local writing').acks"), 1);
    await settled();
    assert.equal(
      await execute("window.guide.plan"),
      null,
      "profile form is not covered by an automatic tour",
    );
    await execute("window.navigate('/dashboard')");
    await until("window.guide.plan?.mode==='welcome'");
    assert.equal(await execute(`Boolean(${welcome})`), false);
    await execute("window.guide.startTour()");
    await until("window.guide.phase==='tour'");
    await execute("window.navigate('/workspaces')");
    await until("document.querySelector('[data-page=\"/workspaces\"]')");
    await settled();
    assert.equal(
      await execute("window.guide.phase"),
      "tour",
      "an active tour survives its workspace-management step",
    );
    await execute("window.mountWelcome('Local writing')");
    await until("window.guide.status?.profileSetupPending===false");
    assert.equal(
      await execute(`Boolean(${welcome})`),
      false,
      "welcome stays dismissed after remount",
    );
    assert.equal(await execute("window.config.get().language"), "id");
    await execute("window.guide.replay()");
    await until("window.guide.plan?.mode==='replay'");
    await execute("window.navigate('/profile')");
    await until("document.querySelector('[data-page=\"/profile\"]')");
    await settled();
    assert.equal(
      await execute("window.guide.plan.mode"),
      "replay",
      "manual replay remains available on profile pages",
    );

    await execute("window.mountWelcome('Second workspace')");
    await until(
      `${welcome}?.textContent.includes('Welcome to Second workspace')`,
    );
    await execute("document.querySelector('[data-welcome-later]').click()");
    await until(`!${welcome}`);
    await execute("window.mountWelcome('Second workspace')");
    await until("window.guide.status?.profileSetupPending===false");
    assert.equal(await execute(`Boolean(${welcome})`), false);
    assert.equal(await execute("window.inspect('Second workspace').acks"), 1);

    await execute("window.mountWelcome('Cloud writing','cloud')");
    await until("window.guide.status?.profileSetupPending");
    await settled();
    assert.equal(
      await execute(`Boolean(${welcome})`),
      false,
      "unbound Cloud waits for sign-in",
    );
    await execute("window.openLogin();window.bindCloud()");
    await settled();
    assert.equal(
      await execute(`Boolean(${welcome})`),
      false,
      "welcome waits for login modal to close",
    );
    await execute("window.closeLogin()");
    await until(welcome);
    assert.equal(
      await execute(
        "document.querySelector('[data-welcome-profile]').textContent.trim()",
      ),
      "Review my profile",
    );
    win.setSize(560, 620);
    await execute(
      "document.documentElement.classList.add('dark');window.dismissToasts()",
    );
    await settled();
    assert.equal(
      await execute(
        `(()=>{const box=${welcome}.getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight&&box.left>=0&&box.right<=innerWidth})()`,
      ),
      true,
      "dialog fits a small viewport",
    );
    writeFileSync(
      path.join(artifacts, "welcome-cloud-dark.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await execute("document.querySelector('[data-welcome-profile]').click()");
    await until(
      "document.querySelector('[data-page=\"/profile\"]') && !document.querySelector('[data-workspace-welcome]')",
    );

    await execute("window.mountWelcome('Direct profile','local','/profile')");
    await until("window.guide.status?.profileSetupPending");
    assert.equal(
      await execute(`Boolean(${welcome})`),
      false,
      "direct profile navigation remains usable",
    );
    await execute("window.navigate('/dashboard')");
    await until(welcome);
    await execute(
      "window.mountWelcome('Editor window','local','/dashboard',true)",
    );
    await until("window.guide.status?.profileSetupPending");
    await settled();
    assert.equal(
      await execute(`Boolean(${welcome})`),
      false,
      "editor windows never show the workspace welcome",
    );
    console.log(
      "PASS: welcome before guides; Local/Cloud profile routes; instant persisted language and failure recovery; acknowledgment retry; once per workspace; skip; Cloud login ordering; small dark viewport; direct Profile and editor exclusions.",
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
