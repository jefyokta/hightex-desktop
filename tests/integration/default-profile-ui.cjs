// Opt-in isolated UI test for the real document settings and local-default preview.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const profile = mkdtempSync(path.join(os.tmpdir(), "hightex-default-profile-"));
app.setPath("userData", profile);
let win, server, vite;
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route,useNavigate} from 'react-router-dom';
import {Setting} from '/src/components/editor/expandable-items/setting.tsx';import {TooltipProvider} from '/src/components/ui/tooltip.tsx';import {HighTexDB} from '/src/editor/storage/hightex-db.ts';import '/src/App.css';
window.config={get:()=>({language:'id'}),onChange:()=>()=>{}};
window.locked=false;window.hightex={categories:async()=>[{id:1,name:'Skripsi',variant:'thesis',chapters:[]},{id:2,name:'KP',variant:'intern',chapters:[]}],cloud:{academic:{locked:async()=>window.locked},context:async()=>{throw Error('Offline fixture')}}};
window.defaults={name:'Default Writer',nim:'456',advisorName:'New Advisor',advisorNip:'00011',committee:{chair:{name:'New Chair',nip:'00013'}}};window.profile={get:async()=>structuredClone(window.defaults)};
const db=HighTexDB.getInstance();await db.open();window.db=db;
for(const id of ['demo','intern','locked'])await db.documents.put({id,title:'Profile fixture',altTitle:'',category:id==='intern'?'2':'1',config:{},keywords:{indonesian:[],english:[]},profile:{name:'Writer',nim:'123',advisorName:'Old Advisor',advisorNip:'00001',secondAdvisor:{name:'Keep Second',nip:'00002'},committee:{chair:{name:'Old Chair',nip:'00003'},examiner1:{name:'Keep Examiner',nip:'00004'}},cv:'Original CV'}});
function Probe(){window.navigate=useNavigate();return null}
createRoot(document.getElementById('root')).render(React.createElement(TooltipProvider,null,React.createElement(MemoryRouter,{initialEntries:['/document/demo']},React.createElement(Probe),React.createElement('div',{'data-editor-titlebar':true,className:'fixed inset-x-0 top-0 z-[3000] h-14 bg-white'},'Profile fixture'),React.createElement('main',{className:'h-dvh overflow-hidden pt-14'},React.createElement(Routes,null,React.createElement(Route,{path:'/document/:id',element:React.createElement(Setting)}))))));
</script></body></html>`;
const execute = (code) =>
  win.webContents.executeJavaScript(
    `(async()=>await eval(${JSON.stringify(code)}))()`,
  );
async function until(code) {
  const end = Date.now() + 20000;
  while (!(await execute(`Boolean(${code})`))) {
    if (Date.now() > end) throw Error("Timed out: " + code);
    await new Promise((r) => setTimeout(r, 40));
  }
}
async function action(label) {
  await execute(
    `(()=>{const buttons=Array.from(document.querySelectorAll('[data-default-profile-preview] button'));const target=buttons.find(button=>button.textContent.trim()===${JSON.stringify(label)});if(!target)throw Error(JSON.stringify(buttons.map(button=>button.textContent)));target.click();})()`,
  );
}
async function openPreview() {
  await execute(
    `document.querySelector('[data-tour="document-profile-default"]').click()`,
  );
  await until(`document.querySelector('[data-default-profile-preview]')`);
}
async function snapshot(id = "demo") {
  return execute(
    `window.db.documents.get(${JSON.stringify(id)}).then(doc=>JSON.stringify(doc))`,
  );
}
app
  .whenReady()
  .then(async () => {
    const { createServer: createVite } = await import("vite");
    const react = (await import("@vitejs/plugin-react")).default;
    const tailwind = (await import("@tailwindcss/vite")).default;
    vite = await createVite({
      root,
      configFile: false,
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
          res.writeHead(404);
          res.end();
        });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    win = new BrowserWindow({
      width: 1280,
      height: 820,
      show: false,
      webPreferences: {
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
      `document.querySelector('[data-tour="document-profile-default"]')`,
    );
    const before = await snapshot();
    await openPreview();
    await new Promise((r) => setTimeout(r, 200));
    writeFileSync(
      path.join(profile, "preview.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-profile-change=secondAdvisor] [role=checkbox]').getAttribute('aria-checked')`,
      ),
      "false",
    );
    assert.equal(
      await execute(
        `document.querySelector('[data-profile-change=examiner1] [role=checkbox]').getAttribute('aria-checked')`,
      ),
      "false",
    );
    assert.ok(
      await execute(
        `(()=>{const d=document.querySelector('[data-default-profile-preview]').getBoundingClientRect();return d.top>=56&&d.bottom<=innerHeight})()`,
      ),
    );
    await action("Batal");
    await until(`!document.querySelector('[data-default-profile-preview]')`);
    assert.equal(await snapshot(), before);
    assert.equal(
      await execute(
        `document.querySelector('[data-tour="document-settings-save"]').disabled`,
      ),
      true,
    );
    await openPreview();
    await execute(
      `document.querySelector('[data-profile-change=name] [role=checkbox]').click();document.querySelector('[data-profile-change=nim] [role=checkbox]').click()`,
    );
    await action("Terapkan ke draf");
    await until(
      `!document.querySelector('[data-default-profile-preview]') && !document.querySelector('[data-tour="document-settings-save"]').disabled`,
    );
    assert.equal(await snapshot(), before);
    await execute(
      `document.querySelector('[data-tour="document-settings-save"]').click()`,
    );
    await until(
      `document.querySelector('[data-tour="document-settings-save"]').disabled`,
    );
    const saved = JSON.parse(await snapshot());
    assert.equal(saved.profile.name, "Writer");
    assert.equal(saved.profile.advisorNip, "00011");
    assert.equal(saved.profile.committee.chair.name, "New Chair");
    assert.equal(saved.profile.committee.examiner1.name, "Keep Examiner");
    assert.equal(saved.profile.secondAdvisor.name, "Keep Second");
    assert.equal(saved.profile.cv, "Original CV");
    await execute(`window.defaults=${JSON.stringify(saved.profile)}`);
    await openPreview();
    assert.ok(
      await execute(
        `document.querySelector('[data-default-profile-preview]').textContent.includes('Tidak ada perubahan')`,
      ),
    );
    await action("Tutup");
    await until(`!document.querySelector('[data-default-profile-preview]')`);
    await execute(
      `window.defaults={name:'Intern Writer',nim:'789',advisorName:'Overwrite Advisor',advisorNip:'999',committee:{}};window.navigate('/document/intern');`,
    );
    await until(
      `document.querySelector('[data-tour="document-profile-default"]') && document.querySelector('[data-tour="document-settings-save"]').disabled`,
    );
    await openPreview();
    assert.deepEqual(
      await execute(
        `Array.from(document.querySelectorAll('[data-profile-change]')).map(row=>row.dataset.profileChange)`,
      ),
      ["name", "nim"],
    );
    win.setSize(540, 640);
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(
      await execute(
        `(()=>{const r=document.querySelector('[data-default-profile-preview]').getBoundingClientRect();return r.top>=56&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()`,
      ),
    );
    writeFileSync(
      path.join(profile, "preview-mobile.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await action("Batal");
    await until(`!document.querySelector('[data-default-profile-preview]')`);
    await execute(`window.locked=true;window.navigate('/document/locked')`);
    await until(
      `document.querySelector('[data-tour="document-profile"]') && !document.querySelector('[data-tour="document-profile-default"]')`,
    );
    console.log(
      "PASS: review/cancel, selective draft-only apply, empty-default protection, explicit save, preserved CV/roles, unchanged state, manual internship advisors, cloud lock and bounded mobile dialog. Artifacts: " +
        profile,
    );
  })
  .catch(async (error) => {
    console.error(error);
    if (win)
      console.error(
        await execute(
          `document.querySelector('[data-default-profile-preview]')?.outerHTML.slice(-6000)`,
        ).catch(() => ""),
      );
    process.exitCode = 1;
  })
  .finally(async () => {
    win?.destroy();
    await vite?.close();
    server?.close();
    app.exit(process.exitCode || 0);
  });
