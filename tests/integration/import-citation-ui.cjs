// Opt-in: env -u ELECTRON_RUN_AS_NODE electron tests/integration/import-citation-ui.cjs
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const profile = mkdtempSync(path.join(os.tmpdir(), "hightex-import-citation-"));
app.setPath("userData", profile);
let vite, server, win;
const html = `<!doctype html><html><body style="margin:0"><main id="root" style="height:100vh"></main><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ConfirmProvider} from '/src/context/confrim-context.tsx';
import {MultiSelectProvider} from '/src/context/multi-select-context.tsx';
import {Dashboard} from '/src/pages/local.tsx';
import {Citation} from '/src/pages/citation.tsx';
import {Settings} from '/src/pages/settings.tsx';
import {UserContext} from '/src/context/user-context.tsx';
import {AuthModalProvider} from '/src/context/auth-modal-context.tsx';
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {Exporter} from '/src/utils/htx/exporter.ts';
import {Toaster} from 'sonner';
import '/src/App.css';
window.language='id';
window.config={get:()=>({language:window.language,theme:'system'}),ready:async()=>{},onChange:()=>()=>{}};
window.profile={get:async()=>({})};
window.hightex={version:async()=>'1.1.2',categories:async()=>[{id:1,name:'Skripsi',variant:'thesis',chapters:[{chapter:'1',title:'Pendahuluan'}]}]};
window.file={getPath:async()=>'/fixture.hightex'};
const db=HighTexDB.getInstance();await db.open();window.db=db;
const root=createRoot(document.getElementById('root'));let revision=0;
const mount=kind=>root.render(React.createElement(UserContext.Provider,{value:{user:false,refresh:async()=>{}}},React.createElement(AuthModalProvider,null,React.createElement(MultiSelectProvider,null,React.createElement(ConfirmProvider,null,React.createElement(kind==='settings'?Settings:kind==='citation'?Citation:Dashboard,{key:++revision}),React.createElement(Toaster))))));
window.showSettings=()=>mount('settings');
window.showCitations=()=>mount('citation');
window.resetImport=async()=>{
  await Promise.all(db.tables.map(table=>table.clear()));
  await db.documents.put({id:'original',title:'Imported document',altTitle:'',category:'1',config:{},keywords:{indonesian:[],english:[]}});
  await db.chapters.put({id:'original.1',content:[{type:'paragraph',content:[{type:'text',text:'Imported chapter'}]}]});
  window.archive=(await new Exporter('original').buildExport()).buffer;
  await db.documents.update('original',{title:'Local document'});
  mount('dashboard');
};
window.startImport=()=>{
  const input=document.querySelector('input[type=file]');
  const transfer=new DataTransfer();transfer.items.add(new File([window.archive],'fixture.hightex'));
  input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
};
window.resetCitations=async()=>{
  await Promise.all(db.tables.map(table=>table.clear()));
  await db.cite.bulkPut(['a','b','c','d'].map(key=>({key,bib:'@book{'+key+',title={Title '+key+'},author={Author},year={2026}}'})));
  await db.chapters.put({id:'original.1',content:[{type:'paragraph',content:[{type:'cite',attrs:{cite:'a|b'}}]}]});
  mount('citation');
};
await window.resetImport();window.ready=true;
</script></body></html>`;
const execute = (code) =>
  win.webContents.executeJavaScript(`(async()=>(${code}))()`);
const until = async (code) => {
  const deadline = Date.now() + 20000;
  while (!(await execute(code))) {
    if (Date.now() > deadline) throw Error(`Timed out: ${code}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};
const clickText = (text) =>
  execute(`(()=>{
  const button=Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(text)});
  if(!button)throw Error('Missing button: '+${JSON.stringify(text)});button.click();
})()`);
const dialogClosed = () => until(`!document.querySelector('[role=dialog]')`);
const readyImport = () =>
  until(`document.body.textContent.includes('Local document')`);

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
      width: 1000,
      height: 850,
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
    await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
    await until("window.ready===true");
    await readyImport();

    await execute("window.startImport()");
    await until(`document.body.textContent.includes('Buat sebagai salinan')`);
    await clickText("Batal");
    await dialogClosed();
    assert.equal(await execute("window.db.documents.count()"), 1);
    assert.equal(
      await execute("document.querySelector('input[type=file]').value"),
      "",
    );

    await execute("window.startImport()");
    await until(`document.body.textContent.includes('Buat sebagai salinan')`);
    writeFileSync(
      path.join(profile, "import-dialog.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await clickText("Buat sebagai salinan");
    await dialogClosed();
    await until(
      `document.body.textContent.includes('Imported document (Salinan)')`,
    );
    assert.equal(await execute("window.db.documents.count()"), 2);
    assert.equal(
      await execute("window.db.documents.get('original').then(doc=>doc.title)"),
      "Local document",
    );
    assert.equal(
      await execute(
        "window.db.documents.filter(doc=>doc.id!=='original').first().then(doc=>doc.file??null)",
      ),
      null,
    );

    await execute("window.resetImport()");
    await readyImport();
    await execute("window.startImport()");
    await until(`document.body.textContent.includes('Buat sebagai salinan')`);
    await clickText("Timpa");
    await dialogClosed();
    await until(
      `document.body.textContent.includes('Imported document') && !document.body.textContent.includes('Local document')`,
    );
    assert.equal(await execute("window.db.documents.count()"), 1);

    await execute("window.resetCitations()");
    await until(`document.querySelector('input[placeholder*="4"]')!==null`);
    assert.equal(
      await execute(
        `document.body.textContent.includes('Hapus sitasi tak terpakai')`,
      ),
      false,
    );
    await execute("window.showSettings()");
    await until(
      `document.body.textContent.includes('Hapus sitasi tak terpakai')`,
    );
    assert.equal(
      await execute(
        `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Hapus sitasi tak terpakai').closest('[data-slot=card]').querySelector('[data-slot=card-title]').textContent`,
      ),
      "Data",
    );
    await execute(
      `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Hapus sitasi tak terpakai').scrollIntoView({block:'center'})`,
    );
    await clickText("Hapus sitasi tak terpakai");
    await until(
      `document.body.textContent.includes('Hapus 2 sitasi tak terpakai?')`,
    );
    await clickText("Batal");
    await dialogClosed();
    assert.equal(await execute("window.db.cite.count()"), 4);
    await clickText("Hapus sitasi tak terpakai");
    await until(
      `document.body.textContent.includes('Hapus 2 sitasi tak terpakai?')`,
    );
    writeFileSync(
      path.join(profile, "citation-dialog.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    // A citation becomes used while the user is reviewing the confirmation.
    await execute(
      "window.db.chapters.put({id:'second.1',content:[{type:'cite',attrs:{cite:'c'}}]})",
    );
    await clickText("Hapus 2 sitasi");
    await dialogClosed();
    assert.deepEqual(
      await execute("window.db.cite.toCollection().primaryKeys()"),
      ["a", "b", "c"],
    );
    await until(
      `document.body.textContent.includes('Berhasil menghapus 1 sitasi tak terpakai.')`,
    );
    await clickText("Hapus sitasi tak terpakai");
    await until(
      `document.body.textContent.includes('Tidak ada sitasi tak terpakai untuk dihapus.')`,
    );
    assert.equal(
      await execute("Boolean(document.querySelector('[role=dialog]'))"),
      false,
    );
    await execute("window.showCitations()");
    await until(`document.querySelector('input[placeholder*="3"]')!==null`);
    assert.equal(
      await execute(
        `document.body.textContent.includes('Hapus sitasi tak terpakai')`,
      ),
      false,
    );
    writeFileSync(
      path.join(profile, "citation-result.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    console.log(
      `PASS: import copy/overwrite/cancel, Settings > Data cleanup cancel/recheck, refreshed citation library; screenshots: ${profile}`,
    );
    await vite.close();
    await new Promise((resolve) => server.close(resolve));
    app.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    if (win)
      console.error(
        await execute("document.body.innerText.slice(0,2000)").catch(
          () => "Renderer unavailable",
        ),
      );
    if (vite) await vite.close();
    if (server) server.close();
    app.exit(1);
  });
