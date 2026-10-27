/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires -- Electron main-process harness runs as CommonJS. */
// Native draft PDF pipeline, using an isolated Electron profile and fixture database.
const { app, ipcMain, BrowserWindow } = require("electron");
const {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createServer } = require("node:http");
const assert = require("node:assert/strict");
const ts = require("typescript");
const { PDFDocument } = require("pdf-lib");
const root = path.resolve(__dirname, "../..");
const profile = mkdtempSync(path.join(os.tmpdir(), "hightex-draft-pdf-"));
app.setPath("userData", profile);
app.commandLine.appendSwitch("disable-gpu");
app.on("window-all-closed", () => {});
const preload = path.join(profile, "preload.cjs");
writeFileSync(
  preload,
  `
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('config',{get:()=>({language:'en'})});
contextBridge.exposeInMainWorld('hightex',{categories:()=>ipcRenderer.invoke('test:categories'),cloud:{academic:{locked:async()=>false}}});
contextBridge.exposeInMainWorld('ipcRenderer',{send:(...args)=>ipcRenderer.send(...args),on:(...args)=>ipcRenderer.on(...args),off:(...args)=>ipcRenderer.off(...args)});
`,
);
let server,
  seedWindow,
  category,
  mutateOnCategory = false;
let flushes = 0;
const metrics = new Map();
const diagnostics = [];
app.on("browser-window-created", (_event, win) => {
  win.webContents.on("console-message", (event) => {
    if (event.level === "error") diagnostics.push(event.message);
  });
  const print = win.webContents.printToPDF.bind(win.webContents);
  win.webContents.printToPDF = async (options) => {
    const result = await win.webContents.executeJavaScript(`({
      pages:document.querySelectorAll('.pagedjs_page').length,
      text:document.body.textContent,
      imagesReady:Array.from(document.images).every(image=>!image.getAttribute('src')||(image.complete&&image.naturalWidth>0)),
      cvHeight:document.querySelector('.pagedjs_pages')?.nextElementSibling?.style.height,
    })`);
    const bytes = await print(options);
    const pdf = await PDFDocument.load(bytes);
    assert.equal(result.imagesReady, true);
    assert.equal(result.cvHeight, "auto");
    assert.equal(
      pdf.getPageCount(),
      result.pages + 1,
      "exactly one native CV page, without a blank trailing page",
    );
    metrics.set(
      new URL(win.webContents.getURL()).searchParams.get("printRequest"),
      result,
    );
    return bytes;
  };
});
async function databaseOperation(body) {
  return seedWindow.webContents.executeJavaScript(`(async()=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('HighTexDB',20);request.onupgradeneeded=()=>{
      const tables={documents:'id',chapters:'id',cite:'key',chapterGraphs:'id',images:'id',variables:'name',aliases:'key',file:'filePath',documentVariables:['documentId','name']};
      for(const [name,keyPath]of Object.entries(tables)){
        const table=request.result.createObjectStore(name,{keyPath});
        if(['cite','images','variables','aliases','file','documentVariables'].includes(name))table.createIndex('documentId','documentId');
        if(name==='documentVariables')table.createIndex('name','name');
      }
    };request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    try{return await (async()=>{${body}})()}finally{db.close()}
  })()`);
}
async function seed(variant) {
  category = {
    id: 1,
    name: variant,
    variant,
    chapters: [{ chapter: "1", title: "PENDAHULUAN" }],
  };
  const document = {
    id: "draft",
    title: `${variant} original title`,
    altTitle: "Original title",
    category: "1",
    keywords: { indonesian: ["fixture"], english: [] },
    config: {
      statementDate: "2026-10-27",
      consentDate: "2026-10-27",
      validityDate: "2026-10-27",
      ...(variant === "intern"
        ? {
            intern: {
              onsite_at: "Fixture company",
              advisor: { name: "Company advisor", nip: "INST" },
              validity: "2026-10-27",
            },
          }
        : {}),
    },
    profile: {
      name: "Draft author",
      nim: "001",
      advisorName: "Advisor",
      advisorNip: "NIP",
      cv: "<p>Original biography</p>",
    },
  };
  await databaseOperation(`
    const tx=db.transaction(Array.from(db.objectStoreNames),'readwrite');
    for(const name of Array.from(db.objectStoreNames))tx.objectStore(name).clear();
    const doc=${JSON.stringify(document)};
    for(const key of ['statementDate','consentDate','validityDate'])doc.config[key]=new Date(doc.config[key]);
    if(doc.config.intern)doc.config.intern.validity=new Date(doc.config.intern.validity);
    const picture=new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="blue"/></svg>'],{type:'image/svg+xml'});
    doc.profile.picture=picture;
    tx.objectStore('documents').put(doc);
    tx.objectStore('chapters').put({id:'draft.1',content:[{type:'paragraph',content:[{type:'text',text:'ORIGINAL DRAFT CONTENT '},{type:'cite',attrs:{cite:'fixture-ref'}}]},{type:'image',attrs:{src:'fixture-image',width:100}}]});
    tx.objectStore('images').put({id:'fixture-image',documentId:'draft',blob:picture,createdAt:0});
    tx.objectStore('cite').put({key:'fixture-ref',documentId:'draft',bib:'@article{fixture-ref, author={Doe, Jane}, title={Original fixture reference}, year={2025}, journal={Fixture Journal}}'});
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  `);
}
async function mutate() {
  await databaseOperation(`
    const tx=db.transaction('chapters','readwrite');
    tx.objectStore('chapters').put({id:'draft.1',content:[{type:'paragraph',content:[{type:'text',text:'CHANGED AFTER PRINT SNAPSHOT'}]}]});
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  `);
}
app
  .whenReady()
  .then(async () => {
    const dist = path.join(root, "dist");
    const mime = {
      ".js": "application/javascript",
      ".css": "text/css",
      ".woff2": "font/woff2",
      ".woff": "font/woff",
      ".ttf": "font/ttf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
    };
    server = createServer((req, res) => {
      const pathname = new URL(req.url, "http://fixture").pathname;
      if (pathname === "/seed") {
        res.setHeader("Content-Type", "text/html");
        res.end("<!doctype html><title>Fixture database</title>");
        return;
      }
      const file = path.resolve(dist, "." + decodeURIComponent(pathname));
      if (
        file.startsWith(dist + path.sep) &&
        existsSync(file) &&
        statSync(file).isFile()
      ) {
        res.setHeader(
          "Content-Type",
          mime[path.extname(file)] || "application/octet-stream",
        );
        res.end(readFileSync(file));
      } else {
        res.setHeader("Content-Type", "text/html");
        res.end(readFileSync(path.join(dist, "index.html")));
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    seedWindow = new BrowserWindow({
      show: false,
      webPreferences: { preload, contextIsolation: true },
    });
    await seedWindow.loadURL(base + "/seed");
    ipcMain.handle("test:categories", async () => {
      if (mutateOnCategory) {
        mutateOnCategory = false;
        await mutate();
      }
      return [category];
    });
    const modules = {
      electron: {
        BrowserWindow,
        ipcMain,
        app,
        dialog: { showSaveDialog: async () => ({ canceled: true }) },
      },
      "node:fs/promises": fs,
      "node:path": path,
      "node:crypto": require("node:crypto"),
      "pdf-lib": { PDFDocument },
      "../main/application": {
        Application: {
          instance: {
            preloadEntry: preload,
            resolveRendererUrl: (route) => `${base}/${route}`,
          },
        },
      },
      "./logger-service": { LoggerService: { writeAsync: async () => {} } },
      "./config-service": {
        ConfigService: {
          get: () => ({
            export: { exportTimeout: 30000, saveFolder: profile },
          }),
        },
      },
      "@main/exception/export-timeout": {
        ExportTimeout: class extends Error {
          constructor(input) {
            super(JSON.stringify(input));
          }
        },
      },
      "../windows/editor-window": {
        EditorWindow: {
          flush: async () => {
            flushes++;
          },
        },
      },
    };
    const Module = require("node:module");
    const compiled = ts.transpileModule(
      readFileSync(path.join(root, "electron/service/pdf-service.ts"), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      },
    ).outputText;
    const fixtureModule = new Module(
      path.join(profile, "pdf-service.cjs"),
      module,
    );
    fixtureModule.require = (name) => {
      assert.ok(name in modules, name);
      return modules[name];
    };
    fixtureModule._compile(
      compiled,
      (fixtureModule.filename = path.join(profile, "pdf-service.cjs")),
    );
    const Service = fixtureModule.exports.PDFService;
    for (const variant of ["thesis", "proposal", "intern"]) {
      await seed(variant);
      mutateOnCategory = true;
      const bytes = await new Service().generate("draft");
      const pdf = await PDFDocument.load(bytes);
      const result = [...metrics.values()].at(-1);
      assert.equal(pdf.getTitle(), `${variant} original title`);
      assert.equal(pdf.getAuthor(), "Draft author");
      assert.ok(result.text.includes("ORIGINAL DRAFT CONTENT"));
      assert.ok(!result.text.includes("CHANGED AFTER PRINT SNAPSHOT"));
      assert.ok(result.text.includes("Original fixture reference"));
      const counts = await databaseOperation(
        `return await Promise.all(['chapterGraphs','documentVariables'].map(name=>new Promise((resolve,reject)=>{const request=db.transaction(name).objectStore(name).count();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})));`,
      );
      assert.deepEqual(
        counts,
        [0, 0],
        "compiler warm-up never writes graphs/variables into the live draft",
      );
      writeFileSync(path.join(profile, `${variant}.pdf`), bytes);
      assert.equal(
        BrowserWindow.getAllWindows().length,
        1,
        "only the database fixture window remains",
      );
      console.log(
        JSON.stringify({
          variant,
          pages: pdf.getPageCount(),
          snapshotPreserved: true,
          imagesReady: true,
          noBlankCVPage: true,
        }),
      );
    }
    await seed("thesis");
    const [plain, marked] = await Promise.all([
      new Service().generate("draft"),
      new Service(true).generate("draft"),
    ]);
    assert.equal(
      JSON.parse((await PDFDocument.load(plain)).getSubject()).hasWm,
      false,
    );
    assert.equal(
      JSON.parse((await PDFDocument.load(marked)).getSubject()).hasWm,
      true,
    );
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    console.log(
      JSON.stringify({
        draftPDF: "passed",
        concurrentExportsIsolated: true,
        editorFlushes: flushes,
        diagnostics,
        artifacts: profile,
      }),
    );
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    console.error(diagnostics);
    app.exit(1);
  });
