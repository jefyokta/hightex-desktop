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
let win, vite, server, db;
let directoryRequests = 0;
let cloudStatus = 200;
let cloudPayload = {
  schema_version: 1,
  version: "a".repeat(64),
  data: [{ id: "12", name: "Cloud Lecturer", nip: "000987" }],
};
let cloudSession = null;
const fixture =
  "<!doctype html><html><body><div id=\"root\"></div><script type=\"module\">\nimport React from 'react'; import {createRoot} from 'react-dom/client';\nimport {MemoryRouter,Routes,Route,Link} from 'react-router-dom';\nimport {AdvisorFields} from '/src/components/advisor-fields.tsx';\nimport {CommitteeFields} from '/src/components/committee-fields.tsx';\nimport {Lecturers} from '/src/pages/lecturers.tsx';\nimport {useLecturerDirectory} from '/src/hooks/use-lecturer-directory.ts';\nimport {documentFormData} from '/src/forms/model.ts';\nimport {Toaster} from 'sonner';\nimport {UserContext} from '/src/context/user-context.tsx';\nimport {AuthModalProvider,useAuthModal} from '/src/context/auth-modal-context.tsx';\nimport {t} from '/src/utils/lang.ts'; import '/src/App.css';\nwindow.config={get:()=>({language:'id'})};\nwindow.fixtureOnline=false;Object.defineProperty(navigator,'onLine',{get:()=>window.fixtureOnline});\nwindow.labels={primary:t('settings.profile.advisor.name.label'),chair:t('editor.expandable.setting.leaded_by'),examiner:t('editor.expandable.setting.primary_examiner_name'),add:t('lecturers.add'),save:t('lecturers.save'),remove:t('lecturers.delete')};\nconst h=React.createElement;\nfunction LoginFixture(){\n const {loginOpen,closeLogin}=useAuthModal();\n return loginOpen?h('div',{'data-fixture-login':true},\n   h('button',{onClick:async()=>{const user=await window.fixtureCloud.login();window.fixtureUser(user);closeLogin();}},'Konfirmasi login'),\n   h('button',{onClick:closeLogin},'Batal login')):null;\n}\nfunction Fixture(){\n const [user,setUser]=React.useState(false);window.fixtureUser=setUser;\n const [profile,setProfile]=React.useState(()=>JSON.parse(localStorage.getItem('profile')||'null')||{name:'Student',nim:'123',advisorName:'',advisorNip:'',cv:'',committee:{}});\n const [intern,setIntern]=React.useState({advisorName:'Manual KP',advisorNip:'KP001'});\n const directory=useLecturerDirectory();\n window.directory=directory;window.profileValue=profile;\n React.useEffect(()=>{localStorage.setItem('profile',JSON.stringify(profile));},[profile]);\n window.formValue=documentFormData({id:'fixture',title:'Title',category:'1',keywords:{indonesian:[],english:[]},altTitle:'',config:{},profile});\n const profileView=h('section',{className:'space-y-5'},\n   h(AdvisorFields,{profile,onChange:patch=>setProfile(p=>({...p,...patch}))}),\n   h(CommitteeFields,{value:profile.committee,onChange:committee=>setProfile(p=>({...p,committee}))}),\n   h('div',{'data-intern':true},h(AdvisorFields,{profile:intern,intern:true,onChange:patch=>setIntern(p=>({...p,...patch}))}))\n );\n return h(UserContext.Provider,{value:{user,refresh:async()=>{}}},h('main',{className:'mx-auto max-w-5xl space-y-6 p-6'},\n   h('nav',{className:'flex gap-4'},h(Link,{to:'/fixture'},'Profil'),h(Link,{to:'/dashboard/lecturers'},'Data dosen')),\n   h(Routes,null,\n     h(Route,{path:'/dashboard/lecturers',element:h(Lecturers)}),\n     h(Route,{path:'/fixture',element:profileView})\n   ),\n   h(LoginFixture),h(Toaster)\n ));\n}\ncreateRoot(document.getElementById('root')).render(h(React.StrictMode,null,h(AuthModalProvider,null,h(MemoryRouter,{initialEntries:['/dashboard/lecturers']},h(Fixture)))));\n</script></body></html>";
const preload = path.join(profile, "preload.cjs");
writeFileSync(
  preload,
  `const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('fixtureCloud',{login:()=>ipcRenderer.invoke('fixture:login'),logout:()=>ipcRenderer.invoke('fixture:logout')});contextBridge.exposeInMainWorld('hightex',{lecturers:{fetchCloud:()=>ipcRenderer.invoke('directory:cloud'),list:()=>ipcRenderer.invoke('directory:list'),save:input=>ipcRenderer.invoke('directory:save',input),remove:id=>ipcRenderer.invoke('directory:remove',id),import:(data,filename)=>ipcRenderer.invoke('directory:import',data,filename)}});`,
);
async function execute(code) {
  return win.webContents.executeJavaScript(`(async()=>{${code}})()`);
}
async function until(code) {
  const end = Date.now() + 15000;
  while (!(await execute(`return Boolean(${code})`))) {
    if (Date.now() > end) throw Error("Timed out: " + code);
    await new Promise((r) => setTimeout(r, 70));
  }
}
async function input(selector, value) {
  await execute(
    `const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));`,
  );
}
async function clickText(text, selector = "button") {
  await execute(
    `const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!el)throw Error('Missing button');el.click();`,
  );
  await execute(
    "await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
  );
}
async function openPicker(label, query) {
  await until(
    `[...document.querySelectorAll('button[role=combobox]')].some(e=>e.getAttribute('aria-label')===${JSON.stringify(label)})`,
  );
  await execute(
    `[...document.querySelectorAll('button[role=combobox]')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}).click();`,
  );
  await until("document.querySelector('[cmdk-input]')");
  await input("[cmdk-input]", query);
}
async function choose(label, query, text) {
  await openPicker(label, query);
  await until(
    `[...document.querySelectorAll('[cmdk-item]')].some(e=>e.textContent.includes(${JSON.stringify(text)}))`,
  );
  await execute(
    `[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes(${JSON.stringify(text)})).click();`,
  );
  await until("!document.querySelector('[cmdk-input]')");
}
async function saveEditor(name, nip) {
  await until("document.querySelector('[role=dialog] form')");
  if (name !== null) await input("[role=dialog] form input[id$='-name']", name);
  await input("[role=dialog] form input[id$='-nip']", nip);
  await clickText(
    (await execute("return window.labels")).save,
    "[role=dialog] button",
  );
  await until("!document.querySelector('[role=dialog] form')");
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
        directoryRequests++;
        assert.equal(req.headers.authorization, "Bearer fixture-token");
        assert.equal(req.headers.cookie, undefined);
        res.setHeader("Content-Type", "application/json");
        if (cloudStatus === 413) {
          res.setHeader("Content-Length", String(17 * 1024 * 1024));
          res.writeHead(200);
          res.end();
          return;
        }
        if (cloudStatus === 302) {
          res.writeHead(302, { Location: "/unexpected-redirect" });
          res.end();
          return;
        }
        res.writeHead(cloudStatus);
        res.end(JSON.stringify(cloudPayload));
        return;
      }
      vite.middlewares(req, res, () => {
        res.statusCode = 404;
        res.end();
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const modules = new Map();
    function loadModule(filename) {
      filename = path.resolve(filename);
      if (modules.has(filename)) return modules.get(filename);
      const exports = {};
      modules.set(filename, exports);
      vm.runInNewContext(
        ts.transpileModule(readFileSync(filename, "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
          },
        }).outputText,
        {
          exports,
          URL,
          fetch,
          TextDecoder,
          AbortSignal,
          process,
          require: (name) =>
            name.startsWith(".")
              ? loadModule(path.resolve(path.dirname(filename), name + ".ts"))
              : require(name),
        },
      );
      return exports;
    }
    const { LocalLecturerDirectory } = loadModule(
      path.resolve(
        __dirname,
        "../../electron/service/lecturer-directory-client.ts",
      ),
    );
    const { LocalLecturer } = loadModule(
      path.resolve(__dirname, "../../electron/database/models/lecturer.ts"),
    );
    const Database = require("better-sqlite3");
    const { randomUUID } = require("node:crypto");
    const createLecturerStorage = (database) => {
      const model = new LocalLecturer(database);
      model.boot();
      const toEntity = (entry) => {
        const source = entry.source ?? { type: "unknown" };
        return {
          id: entry.id,
          name: entry.name,
          nip: entry.nip,
          source_type: source.type,
          source_detail:
            source.type === "cloud"
              ? source.url
              : source.type === "file"
                ? (source.filename ?? null)
                : null,
        };
      };
      const fromEntity = (row) => ({
        id: row.id,
        name: row.name,
        nip: row.nip,
        source:
          row.source_type === "cloud"
            ? { type: "cloud", url: row.source_detail ?? "" }
            : row.source_type === "file"
              ? {
                  type: "file",
                  ...(row.source_detail ? { filename: row.source_detail } : {}),
                }
              : { type: row.source_type },
      });
      const storage = {
        read: () => model.orderBy("rowid", "ASC").get().map(fromEntity),
        save: (entry) => {
          const row = toEntity(entry);
          const { id, ...fields } = row;
          if (model.find(id)) model.where("id", id).update(fields);
          else model.create(row);
        },
        remove: (id) => model.where("id", id).delete(),
        insert: (entries) =>
          database.transaction(() => {
            for (const entry of entries) model.create(toEntity(entry));
          })(),
        createId: randomUUID,
      };
      return {
        model,
        storage,
        migrate: (entries) =>
          database.transaction(() => {
            for (const entry of entries)
              model.create(toEntity(entry), "IGNORE");
          })(),
      };
    };
    const filename = path.join(profile, "hightex.db");
    db = new Database(filename);
    // Upgrade a real pre-provenance table without losing old blank-NIP rows.
    db.exec(
      "CREATE TABLE local_lecturers (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, nip TEXT NOT NULL DEFAULT '')",
    );
    db.prepare("INSERT INTO local_lecturers (id,name,nip) VALUES (?,?,?)").run(
      "local:old",
      "Old blank NIP",
      "",
    );
    let local = createLecturerStorage(db);
    let client = new LocalLecturerDirectory(local.storage);

    assert.equal(client.list().data[0].source.type, "unknown");
    assert.equal(client.list().data[0].nip, "");
    client.remove("local:old");
    // One-time migration preserves manually created entries; deleted entries stay deleted.
    local.migrate([
      { id: "local:legacy", name: "Legacy manual entry", nip: "00001" },
    ]);
    assert.equal(client.list().data[0].nip, "00001");
    client.remove("local:legacy");

    // A storage error midway through a bulk insertion rolls back the whole import.
    db.exec(
      "CREATE TRIGGER reject_import BEFORE INSERT ON local_lecturers WHEN NEW.name = 'Reject row' BEGIN SELECT RAISE(ABORT, 'Fixture disk failure'); END",
    );
    assert.throws(() =>
      client.import([
        { name: "Good row", nip: "001" },
        { name: "Reject row", nip: "002" },
      ]),
    );
    assert.equal(client.list().data.length, 0);
    db.exec("DROP TRIGGER reject_import");
    ipcMain.handle("directory:list", () => client.list());
    ipcMain.handle("directory:save", (_, input) => client.save(input));
    ipcMain.handle("directory:remove", (_, id) => client.remove(id));
    ipcMain.handle("directory:import", (_, data, filename) =>
      client.import(data, filename),
    );
    const { LecturerCloudClient } = loadModule(
      path.resolve(
        __dirname,
        "../../electron/service/lecturer-cloud-client.ts",
      ),
    );
    const { requestCloudLecturers } = loadModule(
      path.resolve(
        __dirname,
        "../../electron/service/lecturer-cloud-transport.ts",
      ),
    );
    const cloud = new LecturerCloudClient(
      {
        importCloud: (rows, url) => client.importCloud(rows, url),
      },
      {
        session: () => cloudSession,
        request: requestCloudLecturers,
        unauthenticated: () => {
          cloudSession = null;
          void execute("window.fixtureUser(false)");
        },
      },
    );
    ipcMain.handle("directory:cloud", () => cloud.fetch());
    ipcMain.handle("fixture:login", () => {
      cloudSession = {
        sessionId: "fixture-" + Date.now(),
        serverUrl: origin + "/api/",
        accountId: "student-a",
        token: "fixture-token",
      };
      return { id: "student-a", name: "Fixture Student" };
    });
    ipcMain.handle("fixture:logout", () => {
      cloudSession = null;
    });
    win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 1100,
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
    await until("window.directory && !window.directory.loading");
    assert.equal(
      await execute("return document.querySelector('[role=dialog]')"),
      null,
      "Directory is a page, not a modal",
    );
    assert.equal(
      await execute("return document.body.textContent.includes('hightex.db')"),
      false,
      "Database paths must not be displayed",
    );
    assert.equal(
      Object.hasOwn(client.list(), "storagePath"),
      false,
      "Database paths must not be exposed by IPC",
    );
    assert.equal(
      await execute("return window.directory.data.length"),
      0,
      "No installer roster",
    );
    const labels = await execute("return window.labels");

    await clickText("Profil", "nav a");
    // Add directly from the picker, including the current search as the initial name.
    await openPicker(labels.primary, "Lecturer Alpha, M.Kom.");
    await clickText(labels.add, "[cmdk-item]");
    await until("document.querySelector('[role=dialog] form')");
    assert.equal(
      await execute(
        "return document.querySelector('[role=dialog] form input').value",
      ),
      "Lecturer Alpha, M.Kom.",
    );
    await saveEditor(null, "000123");
    await until(
      "window.profileValue.advisorNip==='000123' && window.directory.data.length===1",
    );

    await clickText("Kelola data dosen", "a");
    await until("document.querySelector('[data-lecturer-directory-manager]')");
    // Add another lecturer on the directory page; blank NIP cannot be saved.
    await clickText(labels.add, "[data-lecturer-directory-manager] button");
    await until("document.querySelector('[role=dialog] form')");
    assert.equal(
      await execute(
        `return document.querySelector('[role=dialog] input[id$="-nip"]').required`,
      ),
      true,
    );
    assert.equal(
      await execute(
        "return document.querySelector('[role=dialog] button[type=submit]').disabled",
      ),
      true,
    );
    assert.equal(
      await execute(
        "return document.querySelectorAll('[role=dialog] form select').length",
      ),
      0,
      "Manual entry has no source selector",
    );
    assert.equal(
      await execute(
        "return document.querySelectorAll('[role=dialog] form input').length",
      ),
      2,
    );
    await saveEditor("Lecturer Beta, M.T.", "000456");
    await until("window.directory.data.length===2");
    assert.equal(
      await execute(
        "return window.directory.data.find(e=>e.name==='Lecturer Beta, M.T.').source.type",
      ),
      "manual",
    );
    await clickText("Profil", "nav a");
    await execute("document.querySelector('details').open=true");
    await choose(labels.chair, "Beta", "Lecturer Beta");
    await choose(labels.examiner, "000123", "Lecturer Alpha");
    assert.equal(
      await execute("return window.profileValue.committee.examiner1.id"),
      undefined,
      "Local IDs are not backend assignment IDs",
    );
    assert.equal(
      await execute("return window.formValue.people.examiner1.nip"),
      "000123",
    );

    const before = await execute("return JSON.stringify(window.profileValue)");
    await clickText("Kelola data dosen", "a");
    // Editing directory data must not change the selected document/profile copy.
    await execute(
      `document.querySelector('button[aria-label="Edit Lecturer Alpha, M.Kom."]').click()`,
    );
    await saveEditor("Lecturer Alpha Corrected, M.Kom.", "009999");
    await until("window.directory.data[0].nip==='009999'");
    assert.equal(
      await execute("return JSON.stringify(window.profileValue)"),
      before,
    );

    // Online/focus events must never download a directory or rewrite local entries.
    await execute(
      "window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('focus'))",
    );
    assert.equal(directoryRequests, 0);
    await clickText("Profil", "nav a");
    await choose(labels.primary, "009999", "Lecturer Alpha Corrected");
    await until("window.profileValue.advisorNip==='009999'");
    const selected = await execute(
      "return JSON.stringify(window.profileValue)",
    );

    await clickText("Kelola data dosen", "a");
    // A malformed file is rejected before any directory changes.
    await clickText("Impor JSON", "[data-lecturer-directory-manager] button");
    async function upload(data) {
      await execute(
        `const file=new File([${JSON.stringify(JSON.stringify(data))}],'lecturers.json',{type:'application/json'});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('[role=dialog] input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));`,
      );
    }
    await upload([{ name: "Invalid numeric NIP", nip: 123 }]);
    await until("document.querySelector('[role=dialog] [role=alert]')");
    assert.equal(await execute("return window.directory.data.length"), 2);
    await clickText("Batal", "[role=dialog] button");

    // Imported IDs are ignored, duplicate NIPs are skipped, and a large list is paginated.
    const imported = Array.from({ length: 125 }, (_, i) => ({
      id: "server-" + i,
      name: "Imported " + i,
      nip: String(i).padStart(8, "0"),
    }));
    await clickText("Impor JSON", "[data-lecturer-directory-manager] button");
    await upload({
      data: [...imported, { name: "Do not overwrite", nip: "009999" }],
    });
    await until("document.querySelector('[role=dialog] [role=status]')");
    await clickText("Impor dosen", "[role=dialog] button");
    await until(
      "!document.querySelector('[role=dialog]') && window.directory.data.length===127",
    );
    assert.equal(
      await execute("return JSON.stringify(window.profileValue)"),
      selected,
    );
    assert.equal(
      await execute(
        "return window.directory.data.find(e=>e.nip==='009999').name",
      ),
      "Lecturer Alpha Corrected, M.Kom.",
    );
    assert.equal(
      await execute(
        "return window.directory.data.every(e=>e.id.startsWith('local:'))",
      ),
      true,
    );
    assert.equal(
      await execute(
        "return document.querySelectorAll('[data-lecturer-row]').length",
      ),
      100,
    );
    await clickText("Berikutnya", "[data-lecturer-directory-manager] button");
    assert.equal(
      await execute(
        "return document.querySelectorAll('[data-lecturer-row]').length",
      ),
      27,
    );
    await input("[data-lecturer-directory-manager] input", "Imported 124");
    await until("document.querySelectorAll('[data-lecturer-row]').length===1");
    await input("[data-lecturer-directory-manager] input", "");
    await until(
      "document.querySelectorAll('[data-lecturer-row]').length===100",
    );
    writeFileSync(
      path.join(profile, "directory-imported.png"),
      (await win.webContents.capturePage()).toPNG(),
    );

    assert.equal(
      await execute(
        "return window.directory.data.find(e=>e.name==='Imported 124').source.filename",
      ),
      "lecturers.json",
    );
    await input("[data-lecturer-directory-manager] select", "file");
    await until(
      "document.querySelectorAll('[data-lecturer-source=file]').length===100",
    );
    await input("[data-lecturer-directory-manager] select", "cloud");
    await until("document.querySelectorAll('[data-lecturer-row]').length===0");
    await input("[data-lecturer-directory-manager] select", "manual");
    await until("document.querySelectorAll('[data-lecturer-row]').length===2");
    await input("[data-lecturer-directory-manager] select", "all");
    await until(
      "document.querySelectorAll('[data-lecturer-row]').length===100",
    );
    await execute("window.scrollTo(0,0)");
    writeFileSync(
      path.join(profile, "directory-page.png"),
      (await win.webContents.capturePage()).toPNG(),
    );

    // Reopen the real database, then reload the renderer while retaining all imported rows.
    db.close();
    db = new Database(filename);
    local = createLecturerStorage(db);
    client = new LocalLecturerDirectory(local.storage);
    assert.equal(client.list().data.length, 127);
    await win.reload();
    await until(
      "window.directory && !window.directory.loading && window.directory.data.length===127",
    );

    // Delete both entries through the management UI.
    for (const lecturer of [
      "Lecturer Alpha Corrected, M.Kom.",
      "Lecturer Beta, M.T.",
    ]) {
      await execute(
        `[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===${JSON.stringify("Hapus " + lecturer)}).click()`,
      );
      await until("document.querySelector('[role=dialog]')");
      await clickText(labels.remove, "[role=dialog] button");
      await until("!document.querySelector('[role=dialog]')");
    }
    assert.equal(await execute("return window.directory.data.length"), 125);
    assert.equal(
      await execute("return JSON.stringify(window.profileValue)"),
      selected,
    );
    for (const row of client.list().data) client.remove(row.id);

    // Reload with the same real disk-backed store: empty stays empty; documents remain.
    await win.reload();
    await until("window.directory && !window.directory.loading");
    assert.equal(await execute("return window.directory.data.length"), 0);
    assert.equal(
      await execute("return JSON.stringify(window.profileValue)"),
      selected,
    );
    await clickText("Profil", "nav a");
    assert.equal(
      await execute(
        "return document.querySelector('[data-intern] input').value",
      ),
      "Manual KP",
    );
    assert.equal(directoryRequests, 0);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS total FROM local_lecturers").get().total,
      0,
    );
    writeFileSync(
      path.join(profile, "directory.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    // Explicit login-and-download is the only trigger; cancellation never requests data.
    await clickText("Kelola data dosen", "a");
    assert.equal(
      await execute(
        "return document.querySelector('[data-lecturer-cloud] button').disabled",
      ),
      true,
    );
    await execute(
      "window.fixtureOnline=true;window.dispatchEvent(new Event('online'))",
    );
    await until(
      "!document.querySelector('[data-lecturer-cloud] button').disabled",
    );
    assert.equal(directoryRequests, 0);
    await clickText("Login dan ambil data dosen");
    await until("document.querySelector('[data-fixture-login]')");
    await clickText("Batal login");
    await until("!document.querySelector('[data-fixture-login]')");
    assert.equal(directoryRequests, 0);

    // Add a local row to prove both successful and failed cloud fetches preserve it.
    await clickText(labels.add, "[data-lecturer-directory-manager] button");
    await saveEditor("Keep local", "001122");
    await clickText("Login dan ambil data dosen");
    await clickText("Konfirmasi login");
    await until(
      "window.directory.data.length===2 && !document.querySelector('[data-lecturer-cloud] button').disabled",
    );
    assert.equal(directoryRequests, 1);
    assert.equal(
      await execute(
        "return document.querySelector('[data-lecturer-source=cloud] a').getAttribute('href')",
      ),
      origin + "/api/lecturers",
    );
    assert.equal(
      await execute(
        "return window.directory.data.find(e=>e.name==='Keep local').source.type",
      ),
      "manual",
    );
    assert.equal(
      await execute("return JSON.stringify(window.profileValue)"),
      selected,
    );
    await clickText("Ambil dari Cloud");
    await until(
      "!document.querySelector('[data-lecturer-cloud] button').disabled",
    );
    assert.equal(directoryRequests, 2);
    assert.equal(await execute("return window.directory.data.length"), 2);

    for (const status of [403, 500, 413, 302]) {
      cloudStatus = status;
      await clickText("Ambil dari Cloud");
      await until(
        "!document.querySelector('[data-lecturer-cloud] button').disabled && document.querySelector('[data-lecturer-cloud] [role=alert]')",
      );
      assert.equal(await execute("return window.directory.data.length"), 2);
    }
    cloudStatus = 200;
    cloudPayload = {
      schema_version: 1,
      version: "a".repeat(64),
      data: [{ id: "14", name: "No NIP", nip: "" }],
    };
    await clickText("Ambil dari Cloud");
    await until(
      "!document.querySelector('[data-lecturer-cloud] button').disabled && document.querySelector('[data-lecturer-cloud] [role=alert]')",
    );
    assert.equal(await execute("return window.directory.data.length"), 2);
    cloudStatus = 401;
    await clickText("Ambil dari Cloud");
    await until(
      "document.querySelector('[data-lecturer-cloud] button').textContent.includes('Login dan ambil')",
    );
    assert.equal(cloudSession, null);
    assert.equal(await execute("return window.directory.data.length"), 2);
    const requestsBeforeReload = directoryRequests;
    await win.reload();
    await until("window.directory && !window.directory.loading");
    assert.equal(await execute("return window.directory.data.length"), 2);
    assert.equal(
      directoryRequests,
      requestsBeforeReload,
      "Offline restart never downloads",
    );
    assert.equal(
      await execute(
        "return document.querySelector('[data-lecturer-cloud] button').disabled",
      ),
      true,
    );
    writeFileSync(
      path.join(profile, "directory-cloud.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    console.log(
      "PASS: login intent and cancellation, authenticated Bearer fetch, automatic Cloud source URL, duplicate skipping, preserved local/profile data, 401/403/HTTP/invalid/oversized/redirect rejection, and offline persistence after logout.",
    );
    console.log(
      "PASS: empty offline first launch, picker add, local CRUD, required/literal NIP, selection without server IDs, unchanged profile/form snapshots, SQLite persistence, atomic JSON imports, duplicate handling, page navigation, source metadata/filtering, no database paths, pagination/search, persisted empty directory, and no server directory requests.",
    );
    console.log("Artifacts:", profile);
  })
  .then(async () => {
    win?.destroy();
    if (db?.open) db.close();
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
    if (db?.open) db.close();
    server?.closeAllConnections();
    await vite?.close();
    server?.close();
    app.exit(1);
  });
