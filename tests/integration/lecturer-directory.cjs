// Isolated Electron/Vite fixture; no accounts or production server access.
const { app, BrowserWindow, ipcMain } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const ts = require("typescript");
const profile = mkdtempSync(path.join(os.tmpdir(), "hightex-lecturers-"));
app.setPath("userData", profile);
let win, vite, server;
let remoteVersion = "a".repeat(64),
  requests = 0;
const original = [
  { id: "1", name: "Lecturer Alpha, M.Kom.", nip: "000123" },
  { id: "2", name: "Lecturer Beta, M.T.", nip: "000456" },
];
let remote = original;
const saved = new Map();
const fixture = `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {AdvisorFields} from '/src/components/advisor-fields.tsx';
import {CommitteeFields} from '/src/components/committee-fields.tsx';
import {useLecturerDirectory} from '/src/hooks/use-lecturer-directory.ts';
import {documentFormData} from '/src/forms/model.ts';
import {t} from '/src/utils/lang.ts';import '/src/App.css';
window.config={get:()=>({language:'id'})};window.fixtureOnline=false;
Object.defineProperty(navigator,'onLine',{get:()=>window.fixtureOnline});
window.labels={primary:t('settings.profile.advisor.name.label'),secondary:t('settings.profile.second_advisor.name.label'),chair:t('editor.expandable.setting.leaded_by'),examiner:t('editor.expandable.setting.primary_examiner_name'),add:t('settings.profile.second_advisor.enable_label'),refresh:t('lecturers.refresh')};
function Fixture(){
 const [profile,setProfile]=React.useState(()=>JSON.parse(localStorage.getItem('profile')||'null')||{name:'Student',nim:'123',advisorName:'',advisorNip:'',cv:'',committee:{}});
 const [intern,setIntern]=React.useState({advisorName:'Manual KP',advisorNip:'KP001'});
 const directory=useLecturerDirectory();window.directory=directory;window.profileValue=profile;window.internValue=intern;
 React.useEffect(()=>{localStorage.setItem('profile',JSON.stringify(profile));},[profile]);
 window.formValue=documentFormData({id:'fixture',title:'Title',category:'1',keywords:{indonesian:[],english:[]},altTitle:'',config:{},profile});
 return React.createElement('main',{className:'mx-auto max-w-xl space-y-5 p-6'},
  React.createElement(AdvisorFields,{profile,onChange:patch=>setProfile(p=>({...p,...patch}))}),
  React.createElement(CommitteeFields,{value:profile.committee,onChange:committee=>setProfile(p=>({...p,committee}))}),
  React.createElement('div',{'data-intern':true},React.createElement(AdvisorFields,{profile:intern,intern:true,onChange:patch=>setIntern(p=>({...p,...patch}))})));
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
</script></body></html>`;
const preload = path.join(profile, "preload.cjs");
writeFileSync(
  preload,
  `const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('hightex',{lecturers:{cached:()=>ipcRenderer.invoke('directory:cached'),refresh:force=>ipcRenderer.invoke('directory:refresh',force)}});`,
);
async function execute(code) {
  return win.webContents.executeJavaScript(`(async()=>{${code}})()`);
}
async function until(code) {
  const end = Date.now() + 45000;
  while (!(await execute(`return Boolean(${code})`))) {
    if (Date.now() > end) throw Error("Timed out: " + code);
    await new Promise((r) => setTimeout(r, 70));
  }
}
async function choose(label, query, text) {
  await execute(
    `const button=[...document.querySelectorAll('button[role=combobox]')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)});button.click();`,
  );
  await until("document.querySelector('[cmdk-input]')");
  await execute(
    `const input=document.querySelector('[cmdk-input]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(query)});input.dispatchEvent(new Event('input',{bubbles:true}));`,
  );
  await until(
    `[...document.querySelectorAll('[cmdk-item]')].some(e=>e.textContent.includes(${JSON.stringify(text)}))`,
  );
  await execute(
    `[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes(${JSON.stringify(text)})).click();`,
  );
  await until("!document.querySelector('[cmdk-input]')");
}

app
  .whenReady()
  .then(async () => {
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
      if (req.url === "/fixture") {
        res.setHeader("Content-Type", "text/html");
        res.end(await vite.transformIndexHtml("/fixture", fixture));
        return;
      }
      if (req.url === "/api/lecturers") {
        requests++;
        assert.equal(req.headers.authorization, undefined);
        const etag = '"' + remoteVersion + '"';
        res.setHeader("ETag", etag);
        if (req.headers["if-none-match"] === etag) {
          res.writeHead(304);
          res.end();
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            schema_version: 1,
            version: remoteVersion,
            data: remote,
          }),
        );
        return;
      }
      vite.middlewares(req, res, () => {
        res.statusCode = 404;
        res.end();
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const exports = {};
    vm.runInNewContext(
      ts.transpileModule(
        readFileSync(
          path.resolve(
            __dirname,
            "../../electron/service/lecturer-directory-client.ts",
          ),
          "utf8",
        ),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
          },
        },
      ).outputText,
      { exports },
    );
    const client = new exports.LecturerDirectoryClient({
      source: () => origin + "/api/",
      read: (s) => saved.get(s),
      write: (s, value) => saved.set(s, structuredClone(value)),
      seed: {
        source: origin + "/api/",
        schema_version: 1,
        version: "a".repeat(64),
        data: original,
      },
      now: Date.now,
      request: async (source, etag) => {
        const response = await fetch(new URL("lecturers", source), {
          headers: etag ? { "If-None-Match": etag } : {},
        });
        return {
          status: response.status,
          ...(response.status === 200 ? { body: await response.json() } : {}),
        };
      },
    });
    ipcMain.handle("directory:cached", () => client.cached());
    ipcMain.handle("directory:refresh", (_, force) =>
      client.refresh(force === true),
    );
    win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 1000,
      webPreferences: {
        preload,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });
    win.webContents.on("console-message", (event) => {
      if (event.level === "error") console.error(event.message);
    });
    await win.loadURL(origin + "/fixture");
    await until(
      "window.directory?.data.length===2 && !window.directory.loading",
    );
    assert.equal(
      requests,
      0,
      "First launch must use the installer seed while offline",
    );
    const labels = await execute("return window.labels");
    assert.equal(
      await execute("return document.querySelectorAll('input').length"),
      2,
      "Only internship advisors retain manual name/NIP inputs",
    );
    await choose(labels.primary, "000123", "Lecturer Alpha");
    await execute(`document.querySelector('details').open=true;`);
    await choose(labels.chair, "000456", "Lecturer Beta");
    await choose(labels.examiner, "Alpha", "Lecturer Alpha");
    await execute(
      `[...document.querySelectorAll('button')].find(e=>e.textContent===${JSON.stringify(labels.add)}).click();`,
    );
    await choose(labels.secondary, "000456", "Lecturer Beta");
    await until("window.profileValue.secondAdvisor?.nip==='000456'");
    assert.equal(
      await execute("return window.formValue.people.chair.nip"),
      "000456",
    );
    assert.equal(
      await execute("return window.profileValue.committee.examiner1.id"),
      "1",
    );
    assert.equal(requests, 0);
    const before = await execute("return JSON.stringify(window.profileValue)");
    remote = [
      { id: "1", name: "Lecturer Alpha Corrected, M.Kom.", nip: "009999" },
      original[1],
    ];
    remoteVersion = "b".repeat(64);
    await execute(
      "window.fixtureOnline=true;window.dispatchEvent(new Event('online'));",
    );
    await until(
      "window.directory.version==='" +
        remoteVersion +
        "' && !window.directory.refreshing",
    );
    assert.equal(
      await execute("return JSON.stringify(window.profileValue)"),
      before,
      "Refreshing the directory must not rewrite existing profile snapshots",
    );
    assert.equal(requests, 1);
    await choose(labels.primary, "009999", "Lecturer Alpha Corrected");
    assert.equal(
      await execute("return window.profileValue.advisorNip"),
      "009999",
    );
    await execute("window.dispatchEvent(new Event('focus'))");
    await until("!window.directory.refreshing");
    assert.equal(requests, 1, "Fresh cache avoids polling");
    await execute(
      `[...document.querySelectorAll('button')].find(e=>e.textContent===${JSON.stringify(labels.refresh)}).click();`,
    );
    await until("!window.directory.refreshing");
    assert.equal(requests, 2, "Explicit refresh supports 304");
    await new Promise((resolve) => {
      win.webContents.once("did-finish-load", resolve);
      win.reload();
    });
    await until(
      "window.directory?.data[0]?.nip==='009999' && !window.directory.loading",
    );
    assert.equal(
      requests,
      2,
      "Offline restart uses the persisted refreshed snapshot",
    );
    assert.equal(
      await execute("return window.profileValue.advisorNip"),
      "009999",
    );
    assert.equal(
      await execute(
        "return document.querySelector('[data-intern] input').value",
      ),
      "Manual KP",
    );
    writeFileSync(
      path.join(profile, "directory.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    console.log(
      "PASS: first-launch offline seed, anonymous directory, name/NIP lookup, advisor and committee selection, manual internship, atomic refresh, unchanged document profile, conditional refresh and offline restart.",
    );
    console.log("Artifacts:", profile);
  })
  .then(async () => {
    win?.destroy();
    server?.closeAllConnections();
    await vite?.close();
    await new Promise((resolve) =>
      server ? server.close(resolve) : resolve(),
    );
    app.exit(0);
  })
  .catch(async (error) => {
    console.error(error.stack ?? error);
    if (win)
      console.error(
        await execute("return document.body.innerText").catch(() => ""),
      );
    win?.destroy();
    server?.closeAllConnections();
    await vite?.close();
    server?.close();
    app.exit(1);
  });
