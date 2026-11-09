// Actual print routes in same-origin iframes with the profile bridge only on the parent.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, rmSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const root = mkdtempSync(path.join(os.tmpdir(), "hightex-preview-profile-"));
app.setPath("userData", root);
app.disableHardwareAcceleration();
let vite, server, win;
let exitCode = 0;
const deadline = setTimeout(() => {
  console.error("Preview fixture timed out");
  app.exit(1);
}, 90000);
deadline.unref();
const parentHtml = `<!doctype html><html><body><script type="module">
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {emptyAuthorProfile} from '/src/utils/document-profile.ts';
window.errors=[];window.profileListeners=new Set();window.sessionListeners=new Set();
window.author={...emptyAuthorProfile(),name:'Local workspace writer',nim:'123',cv:'<p>Global workspace CV</p>',isCloud:false};
window.profile={get:async()=>window.author,picture:async()=>false,onChange:callback=>{window.profileListeners.add(callback);return()=>window.profileListeners.delete(callback)}};
window.session={onChange:callback=>{window.sessionListeners.add(callback);return()=>window.sessionListeners.delete(callback)}};
window.hightex={categories:async()=>[{id:1,name:'Intern',variant:'intern',chapters:[{chapter:'1',title:'Introduction'}]}],cloud:{academic:{locked:async()=>false}}};
const db=HighTexDB.getInstance();await db.open();window.db=db;
await db.documents.put({id:'preview',title:'Preview fixture',altTitle:'Preview fixture',category:'1',config:{},keywords:{indonesian:[],english:[]},profile:{...emptyAuthorProfile(),name:'Stale imported author',nim:'OLD'}});
await db.chapters.put({id:'preview.1',content:[{type:'paragraph',attrs:{id:'paragraph'},content:[{type:'text',text:'PREVIEW CONTENT: '},{type:'variable',attrs:{name:'name',case:'preserve'}}]}]});
window.ready=true;
</script></body></html>`;
const frameHtml = `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {PrintLayout} from '/src/layouts/print-layout.tsx';
import {Single} from '/src/components/printable/single.tsx';
import {FullDocument} from '/src/components/printable/index.tsx';
import {getWorkspaceAuthorProfile} from '/src/utils/document-profile.ts';
window.addEventListener('unhandledrejection',event=>window.parent.errors.push(String(event.reason?.stack||event.reason)));
window.addEventListener('error',event=>window.parent.errors.push(event.message));
// Mirrors the editor's hightex forwarding, intentionally leaving window.profile undefined.
window.hightex=window.parent.hightex;
window.readProfile=getWorkspaceAuthorProfile;
document.addEventListener('page:rendered',event=>{window.rendered={name:event.detail.engine.config.profile.name,pages:document.querySelectorAll('.pagedjs_page').length};});
const h=React.createElement;
createRoot(document.getElementById('root')).render(h(MemoryRouter,{initialEntries:[new URLSearchParams(location.search).get('route')]},h(Routes,null,h(Route,{element:h(PrintLayout)},h(Route,{path:'/print/:chapterId',element:h(Single)}),h(Route,{path:'/document/:id/print',element:h(FullDocument)})))));
</script></body></html>`;
const execute = (code) =>
  win.webContents.executeJavaScript(`(async()=>{${code}})()`, true);
async function until(code) {
  const end = Date.now() + 30000;
  while (!(await execute(`return Boolean(${code})`))) {
    const errors = await execute("return window.errors||[]");
    if (errors.length) throw Error(errors.join("\n"));
    if (Date.now() > end) throw Error("Timed out: " + code);
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}
async function preview(route, name) {
  await execute(
    `const frame=document.createElement('iframe');frame.id='preview';frame.style='width:1000px;height:800px';frame.src='/frame?route='+encodeURIComponent(${JSON.stringify(route)});document.body.append(frame)`,
  );
  await until("document.querySelector('iframe')?.contentWindow.rendered");
  assert.equal(
    await execute(
      "return document.querySelector('iframe').contentWindow.profile===undefined",
    ),
    true,
  );
  assert.equal(
    await execute(
      "return document.querySelector('iframe').contentWindow.rendered.name",
    ),
    name,
  );
  assert.ok(
    await execute(
      "return document.querySelector('iframe').contentWindow.rendered.pages>0",
    ),
  );
  assert.ok(
    await execute(
      `return document.querySelector('iframe').contentDocument.querySelector('.pagedjs_pages').textContent.includes(${JSON.stringify(name)})`,
    ),
  );
  assert.equal(
    await execute(
      "return document.querySelector('iframe').contentDocument.querySelector('.pagedjs_pages').textContent.includes('Stale imported author')",
    ),
    false,
  );
}
app
  .whenReady()
  .then(async () => {
    const project = path.resolve(__dirname, "../..");
    vite = await (
      await import("vite")
    ).createServer({
      configFile: false,
      root: project,
      cacheDir: path.join(root, "vite"),
      plugins: [
        (await import("@vitejs/plugin-react")).default(),
        (await import("@tailwindcss/vite")).default(),
      ],
      resolve: { alias: { "@": path.join(project, "src") } },
      server: { middlewareMode: true, hmr: false },
      logLevel: "error",
    });
    server = createServer(async (req, res) => {
      if (req.url === "/" || req.url.startsWith("/frame?")) {
        res.setHeader("Content-Type", "text/html");
        res.end(
          await vite.transformIndexHtml(
            req.url,
            req.url === "/" ? parentHtml : frameHtml,
          ),
        );
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
      height: 900,
      webPreferences: { contextIsolation: true, backgroundThrottling: false },
    });
    win.webContents.on("console-message", (event) => {
      if (event.level === "error") console.error(event.message);
    });
    await win.loadURL("http://127.0.0.1:" + server.address().port);
    await until("window.ready");
    await preview("/print/preview.1", "Local workspace writer");
    await execute(
      "window.author={...window.author,name:'Updated workspace writer'};window.profileListeners.forEach(callback=>callback())",
    );
    assert.equal(
      await execute(
        "return (await document.querySelector('iframe').contentWindow.readProfile()).name",
      ),
      "Updated workspace writer",
    );
    await execute("document.querySelector('iframe').remove()");
    await until(
      "window.profileListeners.size===0&&window.sessionListeners.size===0",
    );
    await execute(
      "window.author={...window.author,name:'Cloud workspace writer',isCloud:true}",
    );
    await preview("/document/preview/print", "Cloud workspace writer");
    assert.ok(
      await execute(
        "return document.querySelector('iframe').contentDocument.body.textContent.includes('Global workspace CV')",
      ),
    );
    assert.equal(
      await execute("return (await db.documents.get('preview')).profile.name"),
      "Stale imported author",
    );
    assert.deepEqual(await execute("return window.errors"), []);
    console.log(
      "PASS: real single-chapter and full-document preview iframes use local/cloud parent identity, resolve author variables and global CV, refresh on profile changes, release subscriptions on unload and preserve stored document identity.",
    );
  })
  .catch((error) => {
    console.error(error);
    exitCode = 1;
  })
  .finally(async () => {
    win?.destroy();
    server?.closeAllConnections();
    await vite?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
    app.exit(exitCode);
  });
