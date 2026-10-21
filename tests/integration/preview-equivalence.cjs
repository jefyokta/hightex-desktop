// Opt-in, isolated Electron profile; no backend or real application data.
// node_modules/.bin/electron tests/integration/preview-equivalence.cjs
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const {
  readFileSync,
  existsSync,
  statSync,
  mkdtempSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { zipSync, strToU8 } = require("fflate");
const profilePath = mkdtempSync(
  path.join(os.tmpdir(), "hightex-preview-check-"),
);
app.setPath("userData", profilePath);
app.commandLine.appendSwitch("disable-gpu");
const dist = path.resolve(__dirname, "../../dist");
const mime = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
};
let devServer;
const devMode = process.argv.includes("--dev");
const parent = `<!doctype html><html><body style="margin:0;background:white"><script>
window.categories=[];window.config={get:()=>({language:'en'})};
window.academicLoads=0;window.cloudLocked=false;window.cloudOffline=false;
window.cloudSession={sessionId:'preview-session',accountId:'12',serverUrl:'http://demo/api/'};
window.hightex={categories:async()=>window.categories,cloud:{
 context:async()=>window.cloudSession,
 binding:async()=>window.cloudLocked?{serverDocumentId:'server-doc'}:null,
 academic:{locked:async()=>window.cloudLocked,load:async()=>{
  window.academicLoads++;if(window.cloudOffline)throw Error('Offline');
  return structuredClone(window.cloudAcademic);
 }}
}};
window.profile={get(){throw Error('Actor profile accessed')},picture(){throw Error('Actor picture accessed')}};
window.done=false;window.error=null;window.current=null;
window.addEventListener('message',event=>{
 const frame=document.querySelector('iframe');if(event.source!==frame?.contentWindow)return;
 if(event.data?.type==='snapshot:preview:ready'&&window.current)frame.contentWindow.postMessage({...window.current,type:'snapshot:preview:init',request:event.data.request},location.origin);
 if(event.data?.type==='snapshot:preview:error')window.error=event.data.code;
 if(event.data?.type==='page:rendered')window.done=true;
});
window.openFrame=(url,payload)=>{
 document.querySelector('iframe')?.remove();window.done=false;window.error=null;window.current=payload;
 const frame=document.createElement('iframe');frame.style='border:0;width:2750px;height:2250px;display:block;transform:scale(.4);transform-origin:top left';
 frame.onload=()=>{const win=frame.contentWindow;win.hightex=window.hightex;win.config=window.config;win.document.body.classList.add('preview');};
 frame.src=url;document.body.append(frame);
};
</script></body></html>`;
const viewerPage = parent.replace(
  "</body>",
  `<div id="viewer"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {SubmissionSnapshotViewer} from '/src/components/submission/snapshot-viewer.tsx';
import {readSnapshot} from '/src/review/snapshot-reader.ts';
import '/src/App.css';
const root=createRoot(document.getElementById('viewer'));
window.mountViewer=async bytes=>{
 const snapshot=await readSnapshot(new Uint8Array(bytes),{kind:'local',filename:'demo.hightex'});
 root.render(React.createElement(React.StrictMode,null,React.createElement(SubmissionSnapshotViewer,{snapshot,onBack(){}})));
};
</script></body>`,
);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://local").pathname;
  if (pathname === "/_preview-check") {
    response.setHeader("Content-Type", "text/html");
    response.end(parent);
    return;
  }
  if (pathname === "/_viewer-check" && devServer) {
    response.setHeader("Content-Type", "text/html");
    response.end(await devServer.transformIndexHtml(pathname, viewerPage));
    return;
  }
  if (devServer) {
    devServer.middlewares(request, response, () => {
      response.statusCode = 404;
      response.end();
    });
    return;
  }
  const file = path.resolve(dist, `.${decodeURIComponent(pathname)}`);
  if (
    file.startsWith(dist + path.sep) &&
    existsSync(file) &&
    statSync(file).isFile()
  ) {
    response.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    response.end(readFileSync(file));
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end(readFileSync(path.join(dist, "index.html")));
  }
});
const js = (value) => JSON.stringify(value);
let win;
const execute = (code) => win.webContents.executeJavaScript(code);
const waitForRender = async () => {
  const started = Date.now();
  while (Date.now() - started < 45000) {
    const state = await execute("({done:window.done,error:window.error})");
    if (state.error) throw Error(`Preview error: ${state.error}`);
    if (state.done) {
      await execute(
        "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error("Preview render timed out");
};
const metrics = () =>
  execute(
    `(()=>{const doc=document.querySelector('iframe').contentDocument;const cover=doc.querySelector('#cover');const page=doc.querySelector('.pagedjs_page');const style=getComputedStyle.call(doc.defaultView,cover);return {pages:doc.querySelectorAll('.pagedjs_page').length,text:Array.from(doc.querySelectorAll('.pagedjs_page_content')).map(page=>page.textContent.replace(/\\s+/g,' ').trim()),cv:doc.body.textContent.includes('Biography of Student A'),font:style.fontFamily,size:page?.getBoundingClientRect().width,images:Array.from(doc.querySelectorAll('.pagedjs_pages img')).map(img=>({loaded:img.complete&&img.naturalWidth>0,width:img.width,height:img.height}))}})()`,
  );
const stateOfDB = () =>
  execute(
    `new Promise((resolve,reject)=>{const req=indexedDB.open('HighTexDB');req.onerror=()=>reject(req.error);req.onsuccess=async()=>{const db=req.result;const result={};for(const name of db.objectStoreNames){result[name]=await new Promise((yes,no)=>{const request=db.transaction(name).objectStore(name).getAll();request.onsuccess=()=>yes(request.result);request.onerror=()=>no(request.error)});}db.close();resolve(JSON.stringify(result));}})`,
  );
const fixture = (category, author, image) => {
  const doc = {
    id: "same-local-id",
    title: "Identical preview document",
    altTitle: "Preview comparison",
    category: String(category.id),
    keywords: { indonesian: ["contoh"], english: ["example"] },
    config: {
      statementDate: "2026-10-21T00:00:00.000Z",
      consentDate: "2026-10-21T00:00:00.000Z",
      validityDate: "2026-10-21T00:00:00.000Z",
      intern:
        category.variant === "intern"
          ? {
              onsite_at: "Demo Company",
              validity: "2026-10-21T00:00:00.000Z",
              advisor: { name: "Company Advisor", nip: "INST" },
            }
          : undefined,
    },
    profile: {
      name: author,
      nim: author === "Student A" ? "A001" : "B002",
      advisorName: "Campus Advisor",
      advisorNip: "NIP",
      cv: `<p>Biography of ${author}</p>`,
    },
  };
  const chapters = [
    {
      id: "same-local-id.1",
      content: [
        {
          type: "heading",
          attrs: { level: 1, id: "chapter-one" },
          content: [{ type: "text", text: "PENDAHULUAN" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Document belongs to " },
            { type: "variable", attrs: { name: "name" } },
            { type: "text", text: ". Reference: " },
            { type: "cite", attrs: { cite: "preview-ref" } },
          ],
        },
        { type: "image", attrs: { src: "fixture", width: 120 } },
      ],
    },
  ];
  const entries = {
    "manifest.json": strToU8(
      JSON.stringify({
        format: "json",
        schema_version: 2,
        version: 2,
        document: {
          id: doc.id,
          title: { id: doc.title, en: doc.altTitle },
          category: doc.category,
          keywords: { id: doc.keywords.indonesian, en: doc.keywords.english },
        },
      }),
    ),
    "files/profile.json": strToU8(JSON.stringify(doc.profile)),
    "files/assets/profile.webp": image,
    "files/config.json": strToU8(JSON.stringify(doc.config)),
    "files/assets/references.json": strToU8(
      JSON.stringify({
        "preview-ref": `@book{preview-ref,author={${author}},title={A shared reference},year={2026},publisher={Demo}}`,
      }),
    ),
    "files/assets/aliases.json": strToU8(
      JSON.stringify([
        { key: doc.id + ".API", value: "Application Programming Interface" },
      ]),
    ),
    "files/chapters/1.json": strToU8(JSON.stringify(chapters[0].content)),
    "files/assets/images/fixture.webp": image,
  };
  return {
    doc,
    chapters,
    file: Array.from(zipSync(entries)),
    image: Array.from(image),
  };
};
const seed = async (data) =>
  execute(
    `(async()=>{const data=${js(data)};const req=indexedDB.open('HighTexDB',20);await new Promise((resolve,reject)=>{req.onupgradeneeded=()=>{const db=req.result;for(const [name,key] of Object.entries({documents:'id',chapters:'id',cite:'key',chapterGraphs:'id',images:'id',variables:'name',aliases:'key',file:'filePath',documentVariables:['documentId','name']})){const table=db.createObjectStore(name,{keyPath:key});if(['cite','images','variables','aliases','file','documentVariables'].includes(name))table.createIndex('documentId','documentId');if(name==='documentVariables')table.createIndex('name','name');}};req.onerror=()=>reject(req.error);req.onsuccess=resolve;});const db=req.result;const tx=db.transaction(Array.from(db.objectStoreNames),'readwrite');for(const name of db.objectStoreNames)tx.objectStore(name).clear();for(const key of ['statementDate','consentDate','validityDate'])data.doc.config[key]=new Date(data.doc.config[key]);if(data.doc.config.intern)data.doc.config.intern.validity=new Date(data.doc.config.intern.validity);const picture=new Blob([new Uint8Array(data.image)],{type:'image/webp'});data.doc.profile.picture=picture;tx.objectStore('documents').put(data.doc);data.chapters.forEach(chapter=>tx.objectStore('chapters').put(chapter));tx.objectStore('images').put({id:'fixture',documentId:data.doc.id,createdAt:0,blob:picture});tx.objectStore('cite').put({key:'preview-ref',bib:'@book{preview-ref,author={Student A},title={A shared reference},year={2026},publisher={Demo}}'});tx.objectStore('aliases').put({key:data.doc.id+'.API',documentId:data.doc.id,value:'Application Programming Interface'});await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();})()`,
  );

app
  .whenReady()
  .then(async () => {
    if (devMode) {
      const { createServer: createViteServer } = await import("vite");
      const { default: react } = await import("@vitejs/plugin-react");
      const { default: tailwind } = await import("@tailwindcss/vite");
      devServer = await createViteServer({
        configFile: false,
        root: path.resolve(__dirname, "../.."),
        cacheDir: path.join(profilePath, "vite-cache"),
        plugins: [react(), tailwind()],
        resolve: { alias: { "@": path.resolve(__dirname, "../../src") } },
        server: { middlewareMode: true, hmr: false },
        logLevel: "error",
      });
    }
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    win = new BrowserWindow({
      show: false,
      width: 1100,
      height: 900,
      useContentSize: true,
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
    await win.loadURL(`${base}/_preview-check`);
    const image = Buffer.from(
      await execute(
        `(()=>{const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;const ctx=canvas.getContext('2d');ctx.fillStyle='#2277aa';ctx.fillRect(0,0,16,16);return canvas.toDataURL('image/webp').split(',')[1]})()`,
      ),
      "base64",
    );
    if (process.argv.includes("--cloud-advisors")) {
      const category = {
        id: 1,
        name: "thesis",
        variant: "thesis",
        chapters: [{ chapter: "1", title: "PENDAHULUAN" }],
      };
      const a = fixture(category, "Student A", image);
      // An older bound draft has no advisors cached; the archive retains its
      // own original advisor and must not adopt the current server assignment.
      a.doc.profile.advisorName = "";
      a.doc.profile.advisorNip = "";
      await seed(a);
      await execute(`window.categories=${js([category])};window.cloudLocked=true;
        window.cloudAcademic={session:window.cloudSession,serverDocumentId:'server-doc',
          author:{name:'Student A',nim:'A001',advisorName:'Cloud Primary',advisorNip:'PRIMARY-NIP',secondAdvisor:{name:'Cloud Secondary',nip:'SECOND-NIP'}},
          committee:{leader:'Chair',member_1:'Examiner One',member_2:'Examiner Two',kaprodi:{name:'Head',nip:'HEAD'},dekan:{name:'Dean',nip:'DEAN'}}};`);
      const preview = async () => {
        await execute("window.openFrame('/document/same-local-id/print',null)");
        await waitForRender();
        return (await metrics()).text.join(" ");
      };
      const both = await preview();
      for (const value of [
        "Pembimbing Pertama",
        "Pembimbing Kedua",
        "Cloud Primary",
        "PRIMARY-NIP",
        "Cloud Secondary",
        "SECOND-NIP",
      ])
        assert.ok(both.includes(value), `Cloud preview missing ${value}`);
      await execute(`window.cloudAcademic.author.advisorName='Updated Primary';
        delete window.cloudAcademic.author.secondAdvisor;`);
      const single = await preview();
      assert.ok(single.includes("Updated Primary"));
      assert.ok(!single.includes("Cloud Primary"));
      assert.ok(!single.includes("Cloud Secondary"));
      assert.ok(!single.includes("Pembimbing Kedua"));
      await execute("window.cloudOffline=true");
      const offline = await preview();
      assert.ok(offline.includes("Updated Primary"));
      await execute("window.cloudOffline=false;window.cloudLocked=false");
      const local = fixture(category, "Student A", image);
      await seed(local);
      const loads = await execute("window.academicLoads");
      assert.ok((await preview()).includes("Campus Advisor"));
      assert.equal(await execute("window.academicLoads"), loads);
      const before = await stateOfDB();
      await execute(`window.cloudLocked=true;window.openFrame('/submission/print/same-local-id?request=cloud-archive',{
        file:new Uint8Array(${js(local.file)}),source:{kind:'local',filename:'archive.hightex'},categories:window.categories})`);
      await waitForRender();
      const archive = (await metrics()).text.join(" ");
      assert.ok(archive.includes("Campus Advisor"));
      assert.ok(!archive.includes("Updated Primary"));
      assert.equal(await execute("window.academicLoads"), loads);
      assert.equal(await stateOfDB(), before);
      console.log(
        JSON.stringify({
          cloudAdvisors: "passed",
          emptyCacheRefreshed: true,
          bothAdvisorsRendered: true,
          changedAssignmentRefreshed: true,
          offlineCacheRetained: true,
          localAndArchiveIsolated: true,
          artifacts: profilePath,
        }),
      );
      return;
    }
    for (const variant of ["thesis", "proposal", "intern"]) {
      const category = {
        id: 1,
        name: variant,
        variant,
        chapters: [{ chapter: "1", title: "PENDAHULUAN" }],
      };
      await execute(`window.categories=${js([category])}`);
      const a = fixture(category, "Student A", image);
      await seed(a);
      await execute(`window.openFrame('/document/same-local-id/print',null)`);
      await waitForRender();
      const draft = await metrics();
      const draftImage = await win.webContents.capturePage();
      const before = await stateOfDB();
      await execute(
        `window.openFrame('/submission/print/same-local-id?request=fixture-a',{file:new Uint8Array(${js(a.file)}),source:{kind:'local',filename:'a.hightex'},categories:window.categories})`,
      );
      await waitForRender();
      const snapshot = await metrics();
      const snapshotImage = await win.webContents.capturePage();
      assert.deepEqual(snapshot, draft, `${variant} page text/layout differ`);
      assert.equal(
        await stateOfDB(),
        before,
        "Snapshot modified draft storage",
      );
      const pixelIdentical = draftImage
        .toBitmap()
        .equals(snapshotImage.toBitmap());
      writeFileSync(
        path.join(profilePath, `${variant}-draft.png`),
        draftImage.toPNG(),
      );
      writeFileSync(
        path.join(profilePath, `${variant}-snapshot.png`),
        snapshotImage.toPNG(),
      );
      assert.equal(pixelIdentical, true, `${variant} screenshot differs`);
      const b = fixture(category, "Student B", image);
      await execute(
        `window.openFrame('/submission/print/same-local-id?request=fixture-b',{file:new Uint8Array(${js(b.file)}),source:{kind:'local',filename:'b.hightex'},categories:window.categories})`,
      );
      await waitForRender();
      const text = await execute(
        `document.querySelector('iframe').contentDocument.body.textContent`,
      );
      assert.ok(text.includes("Student B"));
      assert.ok(!text.includes("Student A"));
      assert.equal(
        await stateOfDB(),
        before,
        "Second snapshot modified draft storage",
      );
      console.log(
        JSON.stringify({
          variant,
          pages: snapshot.pages,
          pixelIdentical,
          draftStorageUnchanged: true,
          secondAuthorIsolated: true,
        }),
      );
    }
    if (devMode) {
      await win.loadURL(`${base}/_viewer-check`);
      const started = Date.now();
      while (!(await execute('typeof window.mountViewer === "function"'))) {
        if (Date.now() - started > 30000)
          throw Error("Viewer module failed to load");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const category = {
        id: 1,
        name: "thesis",
        variant: "thesis",
        chapters: [{ chapter: "1", title: "PENDAHULUAN" }],
      };
      await execute(`window.categories=${js([category])}`);
      const a = fixture(category, "Student A", image);
      await execute(`window.mountViewer(${js(a.file)})`);
      await waitForRender();
      assert.equal(
        await execute(
          `document.querySelector('iframe').contentDocument.body.style.zoom`,
        ),
        "",
      );
      assert.equal(
        await execute(`Boolean(document.querySelector('.animate-pulse'))`),
        false,
        "Viewer loading overlay never dismissed",
      );
      assert.ok(
        (
          await execute(
            `document.querySelector('iframe').contentDocument.body.textContent`,
          )
        ).includes("Biography of Student A"),
      );
      const pages = await execute(
        `document.querySelector('iframe').contentDocument.querySelectorAll('.pagedjs_page').length`,
      );
      await execute(
        `document.querySelector('[role="slider"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));`,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        await execute(
          `document.querySelector('iframe').contentDocument.body.style.zoom`,
        ),
        "",
      );
      assert.equal(
        await execute(
          `document.querySelector('iframe').contentDocument.querySelectorAll('.pagedjs_page').length`,
        ),
        pages,
      );
      writeFileSync(
        path.join(profilePath, "actual-viewer.png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      console.log(
        JSON.stringify({
          actualViewer: "passed",
          loadingDismissed: true,
          documentZoomAbsent: true,
          zoomPreservesPagination: true,
        }),
      );
    }
    console.log(JSON.stringify({ artifacts: profilePath }));
  })
  .then(async () => {
    win?.destroy();
    server.close();
    await devServer?.close();
    app.exit(0);
  })
  .catch(async (error) => {
    console.error(error.stack ?? String(error));
    win?.destroy();
    server.close();
    await devServer?.close();
    app.exit(1);
  });
