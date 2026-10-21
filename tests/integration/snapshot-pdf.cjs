// Actual PDF service and renderer, isolated Electron profile; no real account/data.
const electron = require("electron");
const { app, ipcMain, BrowserWindow } = electron;
const { mkdtempSync, writeFileSync, readFileSync } = require("node:fs");
const path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const { createServer } = require("node:http");
const ts = require("typescript"),
  { zipSync, strToU8 } = require("fflate"),
  { PDFDocument } = require("pdf-lib");
const profile = mkdtempSync(path.join(os.tmpdir(), "hightex-snapshot-pdf-"));
app.setPath("userData", profile);
app.commandLine.appendSwitch("disable-blink-features", "LayoutNGPrinting");
app.commandLine.appendSwitch("disable-gpu");
app.on("window-all-closed", () => {});
app.on("browser-window-created", (_, win) => {
  win.webContents.on("did-finish-load", () =>
    console.log("PDF print route loaded"),
  );
  const print = win.webContents.printToPDF.bind(win.webContents);
  win.webContents.printToPDF = async (options) => {
    console.log("Printing native PDF");
    const bytes = await print(options);
    console.log("Native PDF bytes", bytes.length);
    return bytes;
  };

  win.webContents.on("console-message", (event) => {
    if (event.level === "error") console.error(event.message);
  });
  win.webContents.on("render-process-gone", (_, details) =>
    console.error("PDF renderer exited", details.reason),
  );
});
let vite, server, category, latestMetrics;
const preload = path.join(profile, "preload.cjs");
writeFileSync(
  preload,
  `const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('config',{get:()=>({language:'en'})});contextBridge.exposeInMainWorld('hightex',{categories:()=>ipcRenderer.invoke('test:categories')});contextBridge.exposeInMainWorld('ipcRenderer',{send:(...args)=>ipcRenderer.send(...args),on:(...args)=>{ipcRenderer.on(...args);return()=>ipcRenderer.removeListener(...args)},off:(...args)=>ipcRenderer.off(...args),invoke:(...args)=>ipcRenderer.invoke(...args)});contextBridge.exposeInMainWorld('snapshotPrint',{init:request=>ipcRenderer.invoke('snapshot:pdf:init:'+request),error:(...args)=>ipcRenderer.send('snapshot:pdf:error',...args),result:(...args)=>ipcRenderer.send('snapshot:pdf:result',...args)});`,
);
const fixture = (author, variant) => {
  const entries = {
    "manifest.json": strToU8(
      JSON.stringify({
        format: "json",
        schema_version: 2,
        version: 2,
        document: {
          id: "shared-id",
          title: { id: `${variant} ${author || "Legacy"}`, en: "Demo" },
          category: "1",
          keywords: { id: ["demo"], en: [] },
        },
      }),
    ),
    "files/config.json": strToU8(
      JSON.stringify({
        statementDate: "2026-10-21",
        consentDate: "2026-10-21",
        validityDate: "2026-10-21",
        intern:
          variant === "intern"
            ? {
                onsite_at: "Demo Company",
                advisor: { name: "Company Advisor", nip: "INST" },
                validity: "2026-10-21",
              }
            : undefined,
      }),
    ),
    "files/chapters/1.json": strToU8(
      JSON.stringify([
        {
          type: "paragraph",
          content: [
            { type: "text", text: `Chapter for ${author || "Legacy"}` },
          ],
        },
      ]),
    ),
  };
  if (author)
    entries["files/profile.json"] = strToU8(
      JSON.stringify({
        name: author,
        nim: author === "Student A" ? "A001" : "B002",
        advisorName: "Advisor",
        advisorNip: "NIP",
        cv: `<p>Biography ${author}</p>`,
      }),
    );
  return {
    file: zipSync(entries),
    documentId: "shared-id",
    source: { kind: "local", filename: "demo.hightex" },
  };
};
app
  .whenReady()
  .then(async () => {
    const dist = path.resolve(__dirname, "../../dist");
    const { existsSync, statSync } = require("node:fs");
    const mime = {
      ".js": "application/javascript",
      ".css": "text/css",
      ".woff2": "font/woff2",
      ".woff": "font/woff",
      ".ttf": "font/ttf",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    };
    server = createServer((req, res) => {
      const pathname = new URL(req.url, "http://local").pathname;
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
    ipcMain.handle("test:categories", () => [category]);
    const compiled = ts.transpileModule(
      readFileSync(
        path.resolve(
          __dirname,
          "../../electron/service/snapshot-pdf-service.ts",
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText;
    const reviewSession = {
      sessionId: "advisor-session",
      accountId: "24",
      serverUrl: "http://fixture/api/",
    };
    let sessionActive = true,
      reviewAllowed = true,
      requestedFile;
    let contextCalls = 0;
    const modules = {
      electron: {
        BrowserWindow,
        ipcMain,
        dialog: { showSaveDialog: async () => ({ canceled: true }) },
      },
      "pdf-lib": require("pdf-lib"),
      "node:crypto": require("node:crypto"),
      "node:path": path,
      "./config-service": {
        ConfigService: {
          get: () => ({
            export: { exportTimeout: 30000, saveFolder: profile },
          }),
        },
      },
      "node:fs/promises": require("node:fs/promises"),
      "../main/application": {
        Application: {
          instance: {
            preloadEntry: preload,
            resolveRendererUrl: (route) => base + route,
          },
        },
      },
      "./category-service": {
        CategoryService: { getAll: async () => [category] },
      },
      "./submission-service": {
        submissionService: {
          context() {
            contextCalls++;
            return sessionActive
              ? { ok: true, data: reviewSession }
              : { ok: false, error: { code: "not_authenticated" } };
          },
          file: async (input) => {
            assert.equal(input.documentId, "server-document");
            assert.equal(input.submissionId, "87");
            return reviewAllowed
              ? {
                  ok: true,
                  data: {
                    file: requestedFile.file,
                    sha256: require("node:crypto")
                      .createHash("sha256")
                      .update(requestedFile.file)
                      .digest("hex"),
                  },
                }
              : { ok: false, error: { code: "forbidden" } };
          },
        },
      },
    };
    // Compile in the main Node realm: Electron frame wrappers cannot cross vm realms.
    const Module = require("node:module");
    const fixtureModule = new Module(
      path.join(profile, "snapshot-pdf-service.cjs"),
      module,
    );
    fixtureModule.require = (name) => {
      assert.ok(name in modules, name);
      return modules[name];
    };
    fixtureModule._compile(
      compiled,
      (fixtureModule.filename = path.join(profile, "snapshot-pdf-service.cjs")),
    );
    const Service = fixtureModule.exports.SnapshotPDFService;
    ipcMain.on("snapshot:pdf:result", async (event) => {
      console.log("PDF snapshot rendered");
      latestMetrics = await event.sender.executeJavaScript(
        `({pages:document.querySelectorAll('.pagedjs_page').length,text:document.body.textContent,zoom:document.body.style.zoom})`,
      );
    });
    for (const variant of ["thesis", "proposal", "intern"]) {
      category = {
        id: 1,
        name: variant,
        variant,
        chapters: [{ chapter: "1", title: "PENDAHULUAN" }],
      };
      for (const author of ["Student A", "Student B"]) {
        latestMetrics = undefined;
        const input = fixture(author, variant);
        const bytes = await new Service().generate(input);
        const pdf = await PDFDocument.load(bytes);
        writeFileSync(path.join(profile, `${variant}-${author}.pdf`), bytes);
        assert.equal(pdf.getAuthor(), author);
        assert.equal(pdf.getTitle(), `${variant} ${author}`);
        assert.ok(pdf.getPageCount() > 1);
        assert.equal(
          JSON.parse(pdf.getSubject()).sha256,
          require("node:crypto")
            .createHash("sha256")
            .update(input.file)
            .digest("hex"),
        );
        assert.ok(latestMetrics.text.includes(author));
        assert.ok(
          !latestMetrics.text.includes(
            author === "Student A" ? "Student B" : "Student A",
          ),
        );
        assert.equal(latestMetrics.zoom, "");
        assert.equal(
          pdf.getPageCount(),
          latestMetrics.pages + 1,
          "Paged pages plus the standalone CV sheet",
        );
        assert.equal(BrowserWindow.getAllWindows().length, 0);
      }
      console.log(
        JSON.stringify({
          variant,
          pdfAuthorsIsolated: true,
          metadataVerified: true,
          windowsCleaned: true,
        }),
      );
    }
    const legacy = await PDFDocument.load(
      await new Service().generate(fixture("", "intern")),
    );
    assert.equal(legacy.getAuthor(), "");
    assert.equal(JSON.parse(legacy.getSubject()).incomplete, true);
    assert.equal(contextCalls, 0, "Local PDF must not read the actor session");
    assert.equal(
      await new Service().export(fixture("Student A", "intern")),
      null,
    );
    requestedFile = fixture("Student A", "intern");
    const sha256 = require("node:crypto")
      .createHash("sha256")
      .update(requestedFile.file)
      .digest("hex");
    const cloud = {
      ...requestedFile,
      source: {
        kind: "submission",
        session: reviewSession,
        documentId: "server-document",
        submissionId: "87",
        sha256,
      },
    };
    const cloudPDF = await PDFDocument.load(
      await new Service().generate(cloud),
    );
    assert.equal(cloudPDF.getAuthor(), "Student A");
    assert.equal(JSON.parse(cloudPDF.getSubject()).submissionId, "87");
    reviewAllowed = false;
    await assert.rejects(new Service().generate(cloud), /forbidden/);
    reviewAllowed = true;
    await assert.rejects(
      new Service().generate({
        ...cloud,
        source: { ...cloud.source, sha256: "f".repeat(64) },
      }),
      /integrity_failed/,
    );
    sessionActive = false;
    await assert.rejects(new Service().generate(cloud), /session_changed/);
    assert.equal(BrowserWindow.getAllWindows().length, 0);
    console.log(
      JSON.stringify({
        snapshotPDF: "passed",
        legacyAuthorAbsent: true,
        submissionAuthorAndAccessGuards: true,
        cancelCreatesNoPDF: true,
        artifacts: profile,
      }),
    );
  })
  .then(async () => {
    server?.close();
    await vite?.close();
    app.exit(0);
  })
  .catch(async (error) => {
    console.error(error.stack || error);
    for (const win of BrowserWindow.getAllWindows()) win.destroy();
    server?.close();
    await vite?.close();
    app.exit(1);
  });
