// node tests/integration/workspace-dev-restart.cjs
// Real Vite + plugin-managed Electron. Two workspace switches must retain Vite,
// start fresh main processes, and read the new workspace's storage each time.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const ts = require("typescript");
const esbuild = require("esbuild");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "hightex-dev-switch-"));
const project = path.resolve(__dirname, "../..");
fs.symlinkSync(
  path.join(project, "node_modules"),
  path.join(root, "node_modules"),
  "dir",
);
const source = path.join(root, "fixture.ts");
const entry = path.join(root, "fixture.mjs");
const preload = path.join(root, "preload.cjs");
let vite, startup;
const observed = [];
const errors = [];

fs.writeFileSync(
  path.join(root, "index.html"),
  "<!doctype html><title>Workspace restart fixture</title><body>Renderer server is available</body>",
);
fs.writeFileSync(
  preload,
  `const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('workspaces',{state:()=>ipcRenderer.invoke('workspaces:state'),switch:id=>ipcRenderer.invoke('workspaces:switch',id)});`,
);
fs.writeFileSync(
  source,
  `
import {app,BrowserWindow,protocol,net} from 'electron';
import fs from 'node:fs';import path from 'node:path';
import {initializeWorkspace} from '${project}/electron/workspaces/bootstrap';
import {WorkspaceRegistry} from '${project}/electron/workspaces/registry';
import {WorkspaceRuntime} from '${project}/electron/workspaces/runtime';
app.setPath('userData',${JSON.stringify(path.join(root, "data"))});
initializeWorkspace();
const registry=new WorkspaceRegistry(WorkspaceRuntime.root!,WorkspaceRuntime.serverUrl!);
let state=registry.read();
if(state.profiles.length===1)state=registry.create({name:'Second workspace',type:'local'});
for(const profile of state.profiles){
 const directory=registry.directory(profile.id);fs.mkdirSync(directory,{recursive:true});
 const file=path.join(directory,'config.json');
 if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify({app:{language:profile.id==='local'?'id':'en'}}));
}
const [{registerWorkspaceHandlers},{ConfigService}]=await Promise.all([
 import('${project}/electron/workspaces/handlers'),
 import('${project}/electron/service/config-service')
]);
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 protocol.handle('hightex',request=>{const url=new URL(request.url);return net.fetch(new URL(url.pathname+url.search,process.env.VITE_DEV_SERVER_URL).href)});
 const win=new BrowserWindow({show:false,webPreferences:{preload:${JSON.stringify(preload)},contextIsolation:true}});
 registerWorkspaceHandlers({window:win,isDev:true,resumePendingOpens:async()=>{}} as any);
 process.on('message',async(message:any)=>{
  if(message?.type!=='fixture:switch')return;
  try{await win.webContents.executeJavaScript('window.workspaces.switch('+JSON.stringify(message.id)+')')}
  catch(error){if(!WorkspaceRuntime.switching)process.send?.({type:'fixture:error',error:String(error)})}
 });
 await win.loadURL('hightex://profile.'+WorkspaceRuntime.profile!.id+'/');
 const renderer=await win.webContents.executeJavaScript('({body:document.body.innerText,state:typeof window.workspaces.state})');
 process.send?.({type:'fixture:ready',pid:process.pid,activeId:WorkspaceRuntime.profile!.id,otherId:state.profiles[1].id,directory:app.getPath('userData'),language:ConfigService.getKey('language'),renderer});
}).catch(error=>{process.send?.({type:'fixture:error',error:String(error)});app.exit(1)});
`,
);

const applicationFacade = path.join(root, "application-facade.ts");
fs.writeFileSync(
  applicationFacade,
  `export const Application={isDev:true,instance:undefined};`,
);
const launcher = path.join(root, "launcher.mjs");
fs.writeFileSync(
  launcher,
  ts.transpileModule(
    fs.readFileSync(
      path.join(project, "tooling/start-electron-dev.ts"),
      "utf8",
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    },
  ).outputText,
);
const expiresAt = Date.now() + 60000;
const deadline = setTimeout(() => {
  errors.push("Workspace dev restart deadline exceeded");
  void finish(1);
}, 60000);

async function untilReady(count) {
  while (observed.length < count) {
    if (errors.length) throw Error(errors.join("\n"));
    if (Date.now() > expiresAt)
      throw Error("Workspace dev restart deadline exceeded");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return observed[count - 1];
}
async function finish(code) {
  clearTimeout(deadline);
  if (startup) await startup.exit();
  if (vite) await vite.close();
  process.exitCode = code;
}

(async () => {
  await esbuild.build({
    entryPoints: [source],
    outfile: entry,
    bundle: true,
    platform: "node",
    format: "esm",
    external: [
      "electron",
      ...Object.keys(require(path.join(project, "package.json")).dependencies),
    ],
    banner: {
      js: "import {createRequire as fixtureRequire} from 'node:module';const require=fixtureRequire(import.meta.url);",
    },
    alias: { "@main": path.join(project, "electron") },
    plugins: [
      {
        name: "workspace-window-facade",
        setup(build) {
          // Exercise the real switch handler, close guard, registry, IPC and restart.
          // The fixture supplies its own main window instead of booting Application.
          build.onResolve({ filter: /(?:^|\/)application$/ }, (args) => {
            const resolved = args.path.startsWith("@main/")
              ? path.join(project, "electron", args.path.slice(6))
              : path.resolve(args.resolveDir, args.path);
            if (resolved === path.join(project, "electron/main/application"))
              return { path: applicationFacade };
          });
        },
      },
    ],
  });
  const { createServer } = await import("vite");
  const plugin = await import("vite-plugin-electron");
  startup = plugin.startup;
  const { startElectronDev } = await import(pathToFileURL(launcher).href);
  vite = await createServer({
    configFile: false,
    root,
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  const rendererUrl = vite.resolvedUrls.local[0];
  process.env.VITE_DEV_SERVER_URL = rendererUrl;
  process.env.HIGHTEX_MODE = "development";
  process.env.DEV_MODE = "1";
  delete process.env.ELECTRON_RUN_AS_NODE;
  const launch = async (_, options) => {
    await startup([entry, "--no-sandbox"], options);
    process.electronApp.on("message", (message) => {
      if (message?.type === "fixture:ready") observed.push(message);
      if (message?.type === "fixture:error") errors.push(message.error);
    });
  };
  await startElectronDev({ startup: launch });
  const first = await untilReady(1);
  assert.equal(first.activeId, "local");
  assert.equal(first.language, "id");
  process.electronApp.send({ type: "fixture:switch", id: first.otherId });
  const second = await untilReady(2);
  assert.notEqual(
    second.pid,
    first.pid,
    "workspace switch starts a fresh Electron process",
  );
  assert.equal(second.activeId, first.otherId);
  assert.equal(second.language, "en");
  assert.equal(
    second.directory,
    path.join(root, "data/workspaces", first.otherId),
  );
  assert.equal(second.renderer.body, "Renderer server is available");
  assert.equal(second.renderer.state, "function");
  assert.equal(
    (await fetch(rendererUrl)).status,
    200,
    "Vite survives the first switch",
  );
  process.electronApp.send({ type: "fixture:switch", id: "local" });
  const third = await untilReady(3);
  assert.notEqual(third.pid, second.pid);
  assert.equal(third.activeId, "local");
  assert.equal(third.language, "id");
  assert.equal(third.renderer.body, "Renderer server is available");
  assert.equal(
    (await fetch(rendererUrl)).status,
    200,
    "Vite survives switching back",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: two real workspace switches retain Vite, reload renderer/preload IPC, start fresh Electron processes, and load the correct workspace identity/storage.",
  );
  console.log("Artifacts:", root);
  await finish(0);
})().catch(async (error) => {
  console.error(error);
  await finish(1);
});
