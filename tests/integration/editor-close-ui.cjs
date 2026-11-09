// Opt-in: env -u ELECTRON_RUN_AS_NODE electron tests/integration/editor-close-ui.cjs
// Real editor, IndexedDB, close IPC and archive writes; isolated profile and stubbed native choices.
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const { unzipSync, strFromU8 } = require("fflate");
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
  savePath = path.join(profile, "document.hightex");
const preload = path.join(profile, "preload.cjs");
fs.writeFileSync(
  preload,
  `const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('editor',{
ready:buffer=>ipcRenderer.invoke('editor:ready',buffer),
save:(buffer,name)=>ipcRenderer.invoke('editor:save',buffer,name),
onCloseState:callback=>{const fn=(_event,locked)=>callback(locked);ipcRenderer.on('editor:close-state',fn);return()=>ipcRenderer.removeListener('editor:close-state',fn)},
onFlush:callback=>{const fn=(_event,...args)=>callback(...args);ipcRenderer.on('editor:flush',fn);return()=>ipcRenderer.removeListener('editor:flush',fn)},
completeFlush:(request,error,snapshot)=>ipcRenderer.send('editor:flush:result:'+request,error,snapshot)
});`,
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
import'/src/App.css';
const config={language:'id',theme:'light',editor:{scrollBar:true,spellCheck:false},export:{saveDialog:true}};
window.config={get:()=>config,onChange:()=>()=>{}};
window.session={onChange:()=>()=>{}};
window.profile={get:async()=>({name:'Writer',nim:'123',advisorName:'Advisor',advisorNip:'00001',cv:'',isCloud:false}),picture:async()=>false,onChange:()=>()=>{}};
window.hightex={categories:async()=>[{id:1,name:'Thesis',variant:'thesis',chapters:[{chapter:'1',title:'Introduction'}]}],cloud:{academic:{locked:async()=>false}}};
window.db=HighTexDB.getInstance();await window.db.open();
const id=location.pathname.split('/').at(-1);
if(!await window.db.documents.get(id))await window.db.documents.put({id,title:'Close fixture',altTitle:'',category:'1',config:{},keywords:{indonesian:[],english:[]},profile:{name:'Writer',nim:'123',advisorName:'Advisor',advisorNip:'00001'}});
function Probe(){window.currentEditor=useCurrentEditor().editor;window.boundChapter=window.currentEditor?getEditorChapter(window.currentEditor):null;window.currentDocument=Document.instance;return null}
function Shell(){return React.createElement(EditorChrome,null,React.createElement(EditorProvider,null,React.createElement(ParamsContextProvider,null,React.createElement(Probe),React.createElement(ExpandableSideBarContextProvider,null,React.createElement(Outlet),React.createElement(Setting)),React.createElement(EditorFlushSlave))))}
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
    ({ EditorWindow } = load("electron/windows/editor-window.ts", {
      electron: {
        app,
        BrowserWindow,
        ipcMain,
        dialog: {
          showMessageBox: async (_window, options) => {
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
        },
      },
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
    ipcMain.handle("editor:ready", async (event, buffer) =>
      EditorWindow.ready(
        EditorWindow.getFromWindow(BrowserWindow.fromWebContents(event.sender)),
        buffer,
      ),
    );
    ipcMain.handle("editor:save", async (event, buffer, name) =>
      EditorWindow.save(
        EditorWindow.getFromWindow(BrowserWindow.fromWebContents(event.sender)),
        buffer,
        name,
      ),
    );
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
      'window.currentEditor.commands.insertContentAt(window.currentEditor.state.doc.content.size, {type:"paragraph",content:[{type:"text",text:"Close flush marker"}]})',
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
    choice = 2;
    await closeAndStay();
    assert.equal(
      prompts,
      previousPrompts + 2,
      "local changes still differ from the archive after reopening",
    );
    fs.unlinkSync(savePath);
    choice = 0;
    win.close();
    await until(() => win.isDestroyed(), "missing archive recreated");
    assert.ok(fs.existsSync(savePath));
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
    console.log(
      "PASS: real editor flushes pending text, clean close, cancel confirmation/file chooser, failed write retry, save-on-close path persistence, clean reopen, document configuration changes, discard, missing archive recovery and unsaved settings drafts.",
    );
    console.log("Fixture profile: " + profile);
  } catch (error) {
    console.error(error);
    console.error({ prompts, errors, saveDialogs });
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
