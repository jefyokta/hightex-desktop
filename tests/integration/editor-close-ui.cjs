// Opt-in: env -u ELECTRON_RUN_AS_NODE electron tests/integration/editor-close-ui.cjs
// Real editor, IndexedDB, close IPC and archive writes; isolated profile and stubbed native choices.
// --no-screenshots runs the interactions without requiring compositor capture.
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const { unzipSync, strFromU8, zipSync, strToU8 } = require("fflate");
const { createServer } = require("node:http");
const root = path.resolve(__dirname, "../..");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "hightex-editor-close-"));
app.setPath("userData", profile);
app.on("window-all-closed", () => {});
let vite, server, win, EditorWindow;
app.on("browser-window-created", (_event, window) => {
  window.webContents.on("console-message", (event) => {
    if (event.level === "error") console.error("EDITOR:", event.message);
  });
});
let prompts = 0,
  errors = 0,
  saveDialogs = 0;
let choice = 2,
  cancelSave = false,
  cancelLocate = false,
  locatePath,
  openDialogs = 0,
  locateFinished = 0,
  conflictChoice = 2,
  conflicts = 0,
  savePath = path.join(profile, "document.hightex");
const preload = path.join(profile, "preload.cjs");
fs.writeFileSync(
  preload,
  `const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('editor',{
sourceFile:(id,path)=>ipcRenderer.invoke('editor:source-file',id,path),
locateSource:()=>ipcRenderer.invoke('editor:locate-source'),
reloadSource:()=>ipcRenderer.invoke('editor:reload-source'),
open:id=>ipcRenderer.invoke('editor:open',id),
has:id=>ipcRenderer.invoke('editor:has',id),
flush:id=>ipcRenderer.invoke('editor:flush',id),
ready:(buffer,source)=>ipcRenderer.invoke('editor:ready',buffer,source),
save:(buffer,name,mode)=>ipcRenderer.invoke('editor:save',buffer,name,mode),
onCloseState:callback=>{const fn=(_event,locked)=>callback(locked);ipcRenderer.on('editor:close-state',fn);return()=>ipcRenderer.removeListener('editor:close-state',fn)},
onFlush:callback=>{const fn=(_event,...args)=>callback(...args);ipcRenderer.on('editor:flush',fn);return()=>ipcRenderer.removeListener('editor:flush',fn)},
completeFlush:(request,error,snapshot)=>ipcRenderer.send('editor:flush:result:'+request,error,snapshot)
});contextBridge.exposeInMainWorld('ipcRenderer',{invoke:(...args)=>ipcRenderer.invoke(...args)});contextBridge.exposeInMainWorld('fixtureFiles',{read:path=>ipcRenderer.invoke('fixture:read-file',path)});`,
);
const html = `<!doctype html><html><body style="margin:0"><main id="root"></main><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';
import{MemoryRouter,Routes,Route,Outlet,useParams}from'react-router-dom';
import{Editor}from'/src/pages/editor.tsx';
import{EditorChrome}from'/src/components/editor/editor-chrome.tsx';
import{ExpandableSideBarContextProvider}from'/src/hooks/use-expandable-sidebar.tsx';
import{EditorProvider,useCurrentEditor}from'/src/hooks/use-editor.tsx';
import{ParamsContextProvider}from'/src/hooks/use-params.tsx';
import{ConfigContextProvider}from'/src/context/config-context.tsx';
import{TooltipProvider}from'/src/components/ui/tooltip.tsx';
import{EditorFlushSlave}from'/src/slaves/editor-flush.tsx';
import{Setting}from'/src/components/editor/expandable-items/setting.tsx';
import{HighTexDB}from'/src/editor/storage/hightex-db.ts';
import{Document}from'/src/editor/document/index.ts';
import{getEditorChapter}from'/src/editor/event/index.ts';
import{documentSaving}from'/src/editor/document/files/saving.ts';
import{ConfirmProvider}from'/src/context/confrim-context.tsx';
import{Toaster}from'sonner';
import'/src/App.css';
const config={language:'id',theme:'light',editor:{scrollBar:true,spellCheck:false},export:{saveDialog:true}};
window.config={get:()=>config,ready:async()=>{},onChange:()=>()=>{}};
window.session={onChange:()=>()=>{}};
window.file={showInFolder:async()=>{}};
window.profile={get:async()=>({name:'Writer',nim:'123',advisorName:'Advisor',advisorNip:'00001',cv:'',isCloud:false}),picture:async()=>false,onChange:()=>()=>{}};
window.hightex={readFile:path=>window.fixtureFiles.read(path),categories:async()=>[{id:1,name:'Thesis',variant:'thesis',chapters:[{chapter:'1',title:'Introduction'}]}],cloud:{academic:{locked:async()=>false}}};
window.db=HighTexDB.getInstance();await window.db.open();
window.saveState=()=>documentSaving.read();
const id=location.pathname.split('/').at(-1);
if(!await window.db.documents.get(id))await window.db.documents.put({id,title:'Close fixture',altTitle:'',category:'1',config:{},keywords:{indonesian:[],english:[]},profile:{name:'Writer',nim:'123',advisorName:'Advisor',advisorNip:'00001'}});
function Probe(){window.currentEditor=useCurrentEditor().editor;window.boundChapter=window.currentEditor?getEditorChapter(window.currentEditor):null;window.currentDocument=Document.instance;return null}
function Shell(){return React.createElement(ConfirmProvider,null,React.createElement(Toaster),React.createElement(EditorChrome,null,React.createElement(EditorProvider,null,React.createElement(ParamsContextProvider,null,React.createElement(Probe),React.createElement(ExpandableSideBarContextProvider,null,React.createElement(Outlet),React.createElement(Setting)),React.createElement(EditorFlushSlave)))))}
createRoot(document.getElementById('root')).render(React.createElement(ConfigContextProvider,null,React.createElement(TooltipProvider,null,React.createElement(MemoryRouter,{initialEntries:['/document/'+id+'/1']},React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(Shell)},React.createElement(Route,{path:'/document/:id/:chapter?/:version?',element:React.createElement(Editor)})))))));
</script></body></html>`;
function load(file, modules = {}) {
  const absolute = path.join(root, file);
  const sandbox = {
    exports: {},
    require: (name) =>
      modules[name] ??
      require(
        name.startsWith(".")
          ? path.resolve(path.dirname(absolute), name)
          : name,
      ),
    process,
    Buffer,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
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
const execute = (code) =>
  win.webContents.executeJavaScript(`(async()=>{${code}})()`);
async function until(fn, label) {
  const deadline = Date.now() + 20000;
  while (!(await fn())) {
    if (Date.now() > deadline) throw Error("Timed out: " + label);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}
async function open(id, filePath) {
  win = await EditorWindow.open(id, filePath);
  await until(
    () => EditorWindow.getFromWindow(win)?.initialized,
    "archive baseline",
  );
  await until(
    () =>
      execute(
        'return !!window.currentEditor?.isEditable && window.boundChapter?.getDocumentId() === "' +
          id +
          '"',
      ),
    "bound editor",
  );
}
async function closeAndStay() {
  const before = prompts + errors + saveDialogs;
  win.close();
  await until(
    () =>
      prompts + errors + saveDialogs > before &&
      !win.isDestroyed() &&
      execute("return !document.body.inert"),
    "close canceled",
  );
  assert.equal(win.isDestroyed(), false);
}
async function captureScreenshot(name) {
  if (process.argv.includes("--no-screenshots")) return;
  await execute("await new Promise(resolve=>setTimeout(resolve,220))");
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(profile, name), image.toPNG());
}
(async () => {
  try {
    await app.whenReady();
    const { createServer: createVite } = await import("vite");
    const { default: react } = await import("@vitejs/plugin-react");
    const { default: tailwind } = await import("@tailwindcss/vite");
    vite = await createVite({
      root,
      configFile: false,
      cacheDir: path.join(profile, "vite"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": path.join(root, "src") } },
      server: { middlewareMode: true, hmr: false },
      appType: "custom",
    });
    server = createServer(async (req, res) => {
      if (req.url.startsWith("/document/")) {
        res.setHeader("Content-Type", "text/html");
        res.end(await vite.transformIndexHtml("/", html));
      } else
        vite.middlewares(req, res, () => {
          res.statusCode = 404;
          res.end();
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const archive = load("electron/utilities/archive-fingerprint.ts");
    const guard = load("electron/utilities/editor-close-guard.ts");
    const importer = await import("@hightex/importer");
    const nativeHost = {
        app,
        BrowserWindow,
        ipcMain,
        dialog: {
          showMessageBox: async (_window, options) => {
            if (options.title === "File berubah di luar HighTex") {
              conflicts++;
              return { response: conflictChoice };
            }
            if (options.type === "error") {
              errors++;
              return { response: 0 };
            }
            prompts++;
            return { response: choice };
          },
          showSaveDialog: async () => {
            saveDialogs++;
            return { canceled: cancelSave, filePath: savePath };
          },
          showOpenDialog: async () => {
            openDialogs++;
            return { canceled: cancelLocate, filePaths: locatePath ? [locatePath] : [] };
          },
        },
      };
    const fileService = load("electron/service/document-file-service.ts", {
      electron: nativeHost,
      "./config-service": { ConfigService: { getKey: () => "id" } },
      "../utilities/archive-fingerprint": archive,
    });
    ({ EditorWindow } = load("electron/windows/editor-window.ts", {
      "@hightex/importer": importer,
      electron: nativeHost,
      "../service/document-file-service": fileService,
      "./../main/application": {
        Application: {
          isDev: false,
          instance: {
            preloadEntry: preload,
            resolveRendererUrl: (route) =>
              "http://127.0.0.1:" + server.address().port + "/" + route,
          },
        },
      },
      "../../src/workspaces/editor-navigation": load(
        "src/workspaces/editor-navigation.ts",
      ),
      "../utilities/archive-fingerprint": archive,
      "../utilities/editor-close-guard": guard,
      "../service/config-service": { ConfigService: { getKey: () => "id" } },
      "../service/logger-service": {
        LoggerService: {
          write: (...args) => console.error("Fixture main error:", ...args),
        },
      },
    }));
    load("electron/handlers/editor-handler.ts", {
      "@main/windows/editor-window": { EditorWindow },
      "@main/utilities/ipc-main": { IPCMain: { handle: (name, handler) => ipcMain.handle(name, async (event, ...args) => {
        // Materialize Electron's native frame in its host context before entering vm.
        void event.sender.mainFrame;
        try {
          return await handler(event, ...args);
        } finally {
          if (name === "editor:locate-source") locateFinished++;
        }
      }) } },
      "../workspaces/runtime": { WorkspaceRuntime: { switching: false } },
    }).EditorHandler.register({});
    ipcMain.handle("fixture:read-file", (_event, file) => fs.promises.readFile(file));
    ipcMain.handle("hightex:export", async (_event, buffer, fileName, options) => {
      assert.equal(options.showDialog, true);
      const filePath = path.join(profile, path.basename(fileName));
      fs.writeFileSync(filePath, buffer);
      return { canceled: false, filePath };
    });
    if (!process.argv.includes("--save-workflow-only")) {
    // A loading/failed document can still be explicitly dismissed.
    choice = 0;
    win = await EditorWindow.open("loading");
    win.close();
    await until(() => win.isDestroyed(), "loading editor closes explicitly");
    assert.equal(saveDialogs, 0);
    prompts = 0;
    choice = 2;
    await open("clean");
    win.close();
    await until(() => win.isDestroyed(), "clean closes");
    assert.equal(prompts, 0);
    await open("dirty");
    await execute(
      'await window.db.cite.put({key:"fixture-cite",documentId:"dirty",bib:"@book{fixture,title={Fixture},author={Author},year={2026}}"});window.currentEditor.commands.insertContentAt(window.currentEditor.state.doc.content.size, {type:"paragraph",content:[{type:"text",text:"Close flush marker"},{type:"cite",attrs:{cite:"fixture-cite"}}]})',
    );
    assert.ok(
      await execute(
        'return window.currentEditor.getText().includes("Close flush marker")',
      ),
    );
    await closeAndStay();
    assert.equal(prompts, 1);
    assert.equal(saveDialogs, 0);
    choice = 0;
    cancelSave = true;
    await closeAndStay();
    assert.equal(saveDialogs, 1);
    assert.equal(fs.existsSync(savePath), false);
    cancelSave = false;
    savePath = profile;
    await closeAndStay();
    assert.equal(errors, 1);
    savePath = path.join(profile, "document.hightex");
    win.close();
    await until(() => win.isDestroyed(), "saved closes");
    const bytes = fs.readFileSync(savePath);
    const entries = unzipSync(bytes);
    assert.ok(
      strFromU8(entries["files/chapters/1.json"]).includes(
        "Close flush marker",
      ),
    );
    await open("dirty", savePath);
    assert.equal(
      await execute('return (await window.db.documents.get("dirty")).file'),
      savePath,
      "save-on-close records the archive path",
    );
    const previousPrompts = prompts;
    win.close();
    await until(() => win.isDestroyed(), "reopened clean closes");
    assert.equal(prompts, previousPrompts);
    await open("dirty", savePath);
    await execute(
      'const doc=await window.db.documents.get("dirty");await window.db.documents.update("dirty",{config:{...doc.config,kaprodi:{name:"Updated Head",nip:"00002"}}})',
    );
    choice = 1;
    win.close();
    await until(() => win.isDestroyed(), "discard closes");
    assert.equal(prompts, previousPrompts + 1);
    assert.deepEqual(fs.readFileSync(savePath), bytes);
    await open("dirty", savePath);
    assert.equal(
      await execute('return (await window.db.documents.get("dirty")).config.kaprodi?.name'),
      undefined,
      "reopening restores the source file after discard",
    );
    assert.ok(await execute('return (await window.db.documents.toArray()).some(doc=>doc.id!=="dirty"&&doc.config.kaprodi?.name==="Updated Head"&&!doc.file)'), "the differing autosave is preserved as a recovery copy");
    win.close();
    await until(() => win.isDestroyed(), "file restored clean close");
    assert.equal(prompts, previousPrompts + 1, "normalized citation IDs do not make the reopened document dirty");
    await open("dirty", savePath);
    const beforeMissing = saveDialogs;
    fs.unlinkSync(savePath);
    choice = 0;
    win.close();
    await until(() => win.isDestroyed(), "missing archive recreated");
    assert.ok(fs.existsSync(savePath));
    assert.equal(saveDialogs, beforeMissing + 1, "a missing source asks for a save location");
    // Unsaved settings drafts are compared without implicitly saving the panel.
    await open("draft");
    await until(
      () =>
        execute(
          'return !!document.querySelector("[data-tour=editor-document-settings] input")',
        ),
      "settings panel",
    );
    await execute(
      `const field=document.querySelector('[data-tour="editor-document-settings"] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'Unsaved draft title');field.dispatchEvent(new Event('input',{bubbles:true}));`,
    );
    choice = 2;
    await closeAndStay();
    assert.equal(
      await execute('return (await window.db.documents.get("draft")).title'),
      "Close fixture",
    );
    choice = 0;
    cancelSave = true;
    await closeAndStay();
    assert.equal(
      await execute('return (await window.db.documents.get("draft")).title'),
      "Close fixture",
      "canceling archive save leaves the settings draft uncommitted",
    );
    cancelSave = false;
    savePath = path.join(profile, "draft.hightex");
    win.close();
    await until(() => win.isDestroyed(), "draft saved");
    assert.equal(
      JSON.parse(
        strFromU8(unzipSync(fs.readFileSync(savePath))["manifest.json"]),
      ).document.title.id,
      "Unsaved draft title",
    );
    await open("draft", savePath);
    assert.equal(
      await execute('return (await window.db.documents.get("draft")).title'),
      "Unsaved draft title",
    );
    const count = prompts;
    win.close();
    await until(() => win.isDestroyed(), "draft clean reopen");
    assert.equal(prompts, count);
    }

    // Save As uses the current editor snapshot, keeps the old file, and changes future saves.
    await open("save-as");
    await until(() => execute("return window.saveState().ready"), "save status ready");
    savePath = path.join(profile, "original.hightex");
    const shortcut = async (saveAs = false) => {
      await execute(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',metaKey:true,shiftKey:${saveAs},bubbles:true,cancelable:true}))`);
    };
    await shortcut();
    await until(() => execute(`return (await window.db.documents.get('save-as')).file===${JSON.stringify(savePath)}`), "initial save shortcut");
    await until(() => execute("return !window.saveState().saving&&!document.querySelector('[data-tour=editor-save]').disabled"), "initial save complete");
    const originalPath = savePath;
    const originalBytes = fs.readFileSync(originalPath);
    const beforeCancel = saveDialogs;
    cancelSave = true;
    await shortcut(true);
    await until(() => saveDialogs === beforeCancel + 1 && execute("return !document.querySelector('[data-tour=editor-save]').disabled"), "Save As canceled");
    assert.equal(await execute("return (await window.db.documents.get('save-as')).file"), originalPath);
    cancelSave = false;
    savePath = path.join(profile, "copy.hightex");
    await execute('window.currentEditor.commands.insertContentAt(window.currentEditor.state.doc.content.size,{type:"paragraph",content:[{type:"text",text:"Save As marker"}]})');
    await shortcut(true);
    await until(() => execute(`return (await window.db.documents.get('save-as')).file===${JSON.stringify(savePath)}`), "Save As changes active path");
    await until(() => execute("return !document.querySelector('[data-tour=editor-save]').disabled"), "Save As complete");
    assert.deepEqual(fs.readFileSync(originalPath), originalBytes);
    assert.ok(strFromU8(unzipSync(fs.readFileSync(savePath))["files/chapters/1.json"]).includes("Save As marker"));

    const movedPath = path.join(profile, "moved.hightex");
    fs.renameSync(savePath, movedPath);
    const liveContent = await execute("return JSON.stringify(window.currentEditor.getJSON())");
    const locate = async () => {
      const before = openDialogs;
      await execute(`document.querySelector('[data-tour="editor-save-menu"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}))`);
      await until(() => execute(`return [...document.querySelectorAll('[role=menuitem]')].some(item=>item.textContent.includes('Temukan file sumber'))`), "locate menu");
      await execute(`[...document.querySelectorAll('[role=menuitem]')].find(item=>item.textContent.includes('Temukan file sumber')).click()`);
      await until(() => locateFinished === before + 1, "locate dialog complete");
    };
    if (!process.argv.includes("--save-workflow-only")) {
    cancelLocate = true;
    await locate();
    assert.equal(await execute("return (await window.db.documents.get('save-as')).file"), savePath);
    cancelLocate = false;
    const foreignPath = path.join(profile, "foreign.hightex");
    const foreign = unzipSync(originalBytes);
    const foreignManifest = JSON.parse(strFromU8(foreign["manifest.json"]));
    foreignManifest.document.id = "another-document";
    foreign["manifest.json"] = strToU8(JSON.stringify(foreignManifest));
    fs.writeFileSync(foreignPath, zipSync(foreign));
    locatePath = foreignPath;
    await locate();
    await until(() => execute("return !document.querySelector('[role=menu]')"), "wrong source rejected");
    assert.equal(EditorWindow.getFromWindow(win).document.filePath, savePath, "another document cannot be linked");
    }
    cancelLocate = false;
    locatePath = movedPath;
    await locate();
    await until(() => execute(`return (await window.db.documents.get('save-as')).file===${JSON.stringify(movedPath)}`), "moved source reconnected");
    assert.equal(await execute("return JSON.stringify(window.currentEditor.getJSON())"), liveContent);
    await execute('window.currentEditor.commands.insertContentAt(window.currentEditor.state.doc.content.size,{type:"paragraph",content:[{type:"text",text:"After move marker"}]})');
    await shortcut();
    await until(() => strFromU8(unzipSync(fs.readFileSync(movedPath))["files/chapters/1.json"]).includes("After move marker"), "Save follows moved source");
    assert.equal(fs.existsSync(savePath), false, "Save does not recreate the old path");
    await until(() => execute("return !window.saveState().saving&&!window.saveState().modified"), "saved status matches the whole document");
    await execute("await window.db.setVar('location','Changed after Save','save-as')");
    await until(() => execute("return window.saveState().modified"), "variables mark the file modified");
    await shortcut();
    await until(() => execute("return !window.saveState().saving&&!window.saveState().modified"), "variable save clears modified status");
    await execute("await window.db.cite.put({key:'saved-status-reference',documentId:'save-as',bib:'@book{status,title={Status}}'})");
    await until(() => execute("return window.saveState().modified"), "references mark the file modified");
    await shortcut();
    await until(() => execute("return !window.saveState().saving&&!window.saveState().modified"), "reference save clears modified status");

    const externalEdit = (file, marker) => {
      const entries = unzipSync(fs.readFileSync(file));
      entries['files/chapters/1.json'] = strToU8(JSON.stringify([{type:'paragraph',content:[{type:'text',text:marker}]}]));
      const bytes = Buffer.from(zipSync(entries));
      fs.writeFileSync(file, bytes);
      return bytes;
    };
    const externalBytes = externalEdit(movedPath, "Changed by another application");
    const beforeConflict = conflicts;
    conflictChoice = 2;
    await shortcut();
    await until(() => conflicts === beforeConflict + 1 && execute("return !window.saveState().saving"), "external change canceled");
    assert.deepEqual(fs.readFileSync(movedPath), externalBytes);
    assert.ok(await execute("return window.currentEditor.getText().includes('After move marker')"));
    conflictChoice = 0;
    savePath = path.join(profile, "conflict-copy.hightex");
    await shortcut();
    await until(() => execute(`return !window.saveState().saving&&window.saveState().path===${JSON.stringify(savePath)}`), "conflict saved as copy");
    assert.deepEqual(fs.readFileSync(movedPath), externalBytes);
    assert.ok(strFromU8(unzipSync(fs.readFileSync(savePath))["files/chapters/1.json"]).includes("After move marker"));
    await execute(`document.querySelector('[data-tour="editor-save-menu"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}))`);
    await until(() => execute("return !!document.querySelector('[data-document-file-status]')"), "save menu status panel");
    assert.ok(await execute(`return document.querySelector('[data-document-file-status]').textContent.includes(${JSON.stringify(savePath)})`));
    await captureScreenshot("save-menu.png");
    await execute("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    await until(() => execute("return !document.querySelector('[role=menu]')"), "save menu dismissed");

    const reloadBytes = externalEdit(savePath, "External version to reload");
    await execute('window.currentEditor.commands.insertContentAt(window.currentEditor.state.doc.content.size,{type:"paragraph",content:[{type:"text",text:"Recovered after external edit"}]})');
    conflictChoice = 1;
    await shortcut();
    await until(() => EditorWindow.getFromWindow(win)?.initialized && execute("return !!window.currentEditor?.isEditable&&window.currentEditor.getText().includes('External version to reload')"), "file version reloaded");
    assert.deepEqual(fs.readFileSync(savePath), reloadBytes);
    const recovery = await execute("return (await window.db.documents.toArray()).find(doc=>doc.recovery?.sourceDocumentId==='save-as'&&!doc.file)");
    assert.ok(recovery, "the editor version was preserved in Recovery");
    assert.equal(recovery.recovery.sourceFile, savePath);
    assert.ok(await execute(`return JSON.stringify((await window.db.chapters.get(${JSON.stringify(recovery.id+'.1')})).content).includes('Recovered after external edit')`));
    await execute(`document.querySelector('[data-tour="editor-save-menu"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}))`);
    await until(() => execute("return [...document.querySelectorAll('[role=menuitem]')].some(item=>item.textContent.trim()==='Pemulihan')"), "recovery menu item");
    await execute("[...document.querySelectorAll('[role=menuitem]')].find(item=>item.textContent.trim()==='Pemulihan').click()");
    await until(() => execute("return !!document.querySelector('[data-document-recoveries] article')"), "recovery dialog lists preserved draft");
    assert.ok(await execute(`return document.querySelector('[data-document-recoveries]').textContent.includes(${JSON.stringify(savePath)})`));
    await captureScreenshot("recovery-dialog.png");
    await execute("document.documentElement.classList.add('dark')");
    await captureScreenshot("recovery-dialog-dark.png");
    await execute("[...document.querySelectorAll('[data-document-recoveries] button')].find(item=>item.textContent==='Simpan salinan…').click()");
    await until(() => fs.readdirSync(profile).some(name=>name.includes('Pemulihan autosave')&&name.endsWith('.hightex')), "recovery exported");
    await until(() => execute("return !document.querySelector('[data-document-recoveries] article button').disabled"), "recovery export complete");
    await execute("document.querySelector('[data-document-recoveries] button[aria-label=\"Hapus salinan pemulihan\"]').click()");
    await until(() => execute("return [...document.querySelectorAll('[role=dialog]')].some(dialog=>!dialog.hasAttribute('data-document-recoveries'))"), "recovery delete confirmation");
    await execute("[...document.querySelectorAll('[role=dialog]:not([data-document-recoveries]) button')].find(button=>button.textContent.trim()==='Batal').click()");
    assert.ok(await execute(`return !!await window.db.documents.get(${JSON.stringify(recovery.id)})`), "cancel deletion retains the recovery");
    await execute("document.querySelector('[data-document-recoveries] button[aria-label=\"Hapus salinan pemulihan\"]').click()");
    await until(() => execute("return [...document.querySelectorAll('[role=dialog]:not([data-document-recoveries]) button')].some(button=>button.textContent.trim()==='Hapus')"), "recovery delete confirmed");
    await execute("[...document.querySelectorAll('[role=dialog]:not([data-document-recoveries]) button')].find(button=>button.textContent.trim()==='Hapus').click()");
    await until(() => execute(`return !await window.db.documents.get(${JSON.stringify(recovery.id)})`), "recovery deleted");
    assert.deepEqual(fs.readFileSync(savePath), reloadBytes, "deleting recovery never touches the source file");
    await execute("[...document.querySelectorAll('[data-document-recoveries] button')].find(item=>item.textContent==='Tutup').click()");
    await until(() => execute("return !document.querySelector('[data-document-recoveries]')"), "recovery dialog closed");
    const closeExternal = externalEdit(savePath, "External version during close");
    await execute('window.currentEditor.commands.insertContentAt(window.currentEditor.state.doc.content.size,{type:"paragraph",content:[{type:"text",text:"Close conflict recovery"}]})');
    const beforeCloseConflict = conflicts;
    conflictChoice = 2;
    choice = 0;
    win.close();
    await until(() => conflicts === beforeCloseConflict + 1 && execute("return !document.body.inert"), "close-save conflict keeps editor open");
    assert.deepEqual(fs.readFileSync(savePath), closeExternal);
    assert.equal(win.isDestroyed(), false);
    conflictChoice = 1;
    win.close();
    await until(() => EditorWindow.getFromWindow(win)?.initialized && execute("return !!window.currentEditor?.isEditable&&window.currentEditor.getText().includes('External version during close')"), "close-save reload waits for the close guard");
    assert.ok(await execute("const copies=await window.db.documents.filter(doc=>doc.recovery?.sourceDocumentId==='save-as').toArray();for(const copy of copies){if(JSON.stringify((await window.db.chapters.get(copy.id+'.1')).content).includes('Close conflict recovery'))return true}return false"));
    const beforeFinalClose = prompts;
    win.close();
    await until(() => win.isDestroyed(), "Save As clean close");
    assert.equal(prompts, beforeFinalClose);
    console.log(
      "PASS: Save As, move/reconnect, whole-document saved status, external-change cancel/copy/reload via toolbar and close-save, preserved editor draft, Recovery dialog/export/delete confirmation and clean close.",
    );
    console.log("Fixture profile: " + profile);
  } catch (error) {
    console.error(error);
    console.error({ prompts, errors, saveDialogs });
    console.error("Fixture profile: " + profile);
    process.exitCode = 1;
  } finally {
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
    await vite?.close();
    await new Promise((resolve) =>
      server ? server.close(resolve) : resolve(),
    );
    app.exit(process.exitCode || 0);
  }
})();
