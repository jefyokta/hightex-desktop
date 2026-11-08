// Opt-in: env -u ELECTRON_RUN_AS_NODE electron tests/integration/workspace-profiles.cjs
// Exercises real Chromium origins, IndexedDB/Blob transfer and SQLite models in temp storage.
if (process.argv.includes("--startup")) {
  require("./workspace-profile-startup.cjs");
} else {
  const { app, BrowserWindow, ipcMain, protocol, net } = require("electron");
  const { createServer } = require("node:http");
  const {
    mkdtempSync,
    readFileSync,
    writeFileSync,
    mkdirSync,
    existsSync,
  } = require("node:fs");
  const path = require("node:path");
  const os = require("node:os");
  const vm = require("node:vm");
  const assert = require("node:assert/strict");
  const ts = require("typescript");
  const Database = require("better-sqlite3");
  const root = mkdtempSync(
    path.join(os.tmpdir(), "hightex-profile-isolation-"),
  );
  app.setPath("userData", root);
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "hightex",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
  let vite,
    server,
    sourceWindow,
    restarts = 0;
  let migrateRun;
  const modules = new Map();
  const project = path.resolve(__dirname, "../..");
  function load(filename) {
    filename = path.resolve(filename);
    if (modules.has(filename)) return modules.get(filename);
    const exports = {};
    modules.set(filename, exports);
    const requireSource = (name) => {
      if (name === "electron" && filename.endsWith("/workspaces/handlers.ts"))
        return {
          app: {
            relaunch: () => {
              restarts++;
            },
            quit() {},
          },
          BrowserWindow,
        };
      if (name.startsWith(".") || name.startsWith("@main/")) {
        let target = name.startsWith("@main/")
          ? path.join(project, "electron", name.slice(6))
          : path.resolve(path.dirname(filename), name);
        if (existsSync(target + ".ts")) target += ".ts";
        else target = path.join(target, "index.ts");
        return load(target);
      }
      return require(name);
    };
    vm.runInNewContext(
      ts.transpileModule(readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      }).outputText,
      {
        exports,
        require: requireSource,
        URL,
        Date,
        Uint8Array,
        Blob,
        Buffer,
        TextEncoder,
        TextDecoder,
        crypto: globalThis.crypto,
        console,
        process,
        setTimeout,
        clearTimeout,
        Response,
      },
    );
    return exports;
  }
  const preload = path.join(root, "preload.cjs");
  writeFileSync(
    preload,
    `const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('workspaces',{
state:()=>ipcRenderer.invoke('workspaces:state'),create:input=>ipcRenderer.invoke('workspaces:create',input),switch:id=>ipcRenderer.invoke('workspaces:switch',id),
migrationPreview:snapshot=>ipcRenderer.invoke('workspaces:migration:preview',snapshot),migrate:resolutions=>ipcRenderer.invoke('workspaces:migration:run',resolutions),
migrationTarget:()=>ipcRenderer.invoke('workspaces:migration:target'),migrationVerified:hash=>ipcRenderer.invoke('workspaces:migration:verified',hash)});`,
  );
  const fixture = `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {WorkspaceMigrationPage} from '/src/pages/workspace-migration.tsx';
import {WorkspaceProfiles} from '/src/components/workspace-profiles.tsx';
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {captureWorkspaceData} from '/src/workspaces/snapshot.ts';
import '/src/App.css';
window.config={get:()=>({language:'id'}),onChange:()=>()=>{}};
const db=HighTexDB.getInstance();await db.open();window.db=db;window.capture=()=>captureWorkspaceData(db);
window.mount=target=>createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(WorkspaceMigrationPage,{target})));
window.mountProfiles=()=>createRoot(document.getElementById('root')).render(React.createElement(WorkspaceProfiles));
if(location.pathname.endsWith('/target'))window.mount(true);
window.ready=true;
</script></body></html>`;
  const execute = (window, code) =>
    window.webContents.executeJavaScript(`(async()=>{${code}})()`);
  async function until(window, code) {
    const deadline = Date.now() + 30000;
    while (!(await execute(window, `return Boolean(${code})`))) {
      if (Date.now() > deadline) throw Error("Timed out: " + code);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }
  app
    .whenReady()
    .then(async () => {
      const { createServer: createVite } = await import("vite");
      vite = await createVite({
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
        if (
          [
            "/profiles/migration",
            "/profiles/migration/target",
            "/inspect",
          ].includes(req.url)
        ) {
          res.setHeader("Content-Type", "text/html");
          res.end(await vite.transformIndexHtml(req.url, fixture));
        } else
          vite.middlewares(req, res, () => {
            res.statusCode = 404;
            res.end();
          });
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const origin = `http://127.0.0.1:${server.address().port}`;
      protocol.handle("hightex", (req) =>
        net.fetch(
          new URL(new URL(req.url).pathname + new URL(req.url).search, origin)
            .href,
        ),
      );
      writeFileSync(
        path.join(root, "config.json"),
        JSON.stringify({
          app: { language: "id" },
          profile: { name: "Legacy default" },
          session: {
            user: { id: "1", name: "Owner" },
            serverUrl: "https://cloud.test/api/",
            expiresAt: "2099-01-01T00:00:00Z",
            browser: { state: "must-not-transfer" },
          },
        }),
      );
      writeFileSync(path.join(root, "session.bin"), "encrypted-fixture");
      mkdirSync(path.join(root, "imported-documents"));
      const importedFile = path.join(root, "imported-documents/a.hightex");
      writeFileSync(importedFile, "original-import");
      const bind = (id, accountId) => ({
        localDocumentId: id,
        serverDocumentId: `server-${id}`,
        accountId,
        serverUrl: "https://cloud.test/api/",
        baseSha256: "a".repeat(64),
      });
      writeFileSync(
        path.join(root, "document-sync-v2.json"),
        JSON.stringify({
          bindings: Object.fromEntries(
            [bind("a", "1"), bind("b", "2")].map((binding) => [
              JSON.stringify([
                binding.serverUrl,
                binding.accountId,
                binding.localDocumentId,
              ]),
              binding,
            ]),
          ),
        }),
      );
      const { WorkspaceRuntime } = load(
        path.join(project, "electron/workspaces/runtime.ts"),
      );
      Object.assign(WorkspaceRuntime, {
        root,
        migrating: true,
        profile: {
          id: "local",
          name: "Local",
          serverUrl: null,
          accountId: null,
        },
      });
      const { WorkspaceRegistry } = load(
        path.join(project, "electron/workspaces/registry.ts"),
      );
      const registry = new WorkspaceRegistry(root);
      assert.equal(registry.read().migrationComplete, false);
      const sqlite = new Database(path.join(root, "hightex.db"));
      const { Snapshot } = load(
        path.join(project, "electron/database/models/snapshot.ts"),
      );
      const { Comment } = load(
        path.join(project, "electron/database/models/comment.ts"),
      );
      const { LocalLecturer } = load(
        path.join(project, "electron/database/models/lecturer.ts"),
      );
      const snapshots = new Snapshot(sqlite),
        comments = new Comment(sqlite),
        lecturers = new LocalLecturer(sqlite);
      snapshots.boot();
      comments.boot();
      lecturers.boot();
      mkdirSync(path.join(root, "snapshots"));
      for (const id of ["a", "b", "offline"]) {
        const filePath = path.join(root, "snapshots", id + ".hts");
        writeFileSync(filePath, "snapshot-" + id);
        snapshots.create({
          id,
          filePath,
          documentId: id,
          type: "sharing",
          updatedAt: null,
        });
        comments.create({
          id: "comment-" + id,
          snapshotId: id,
          data: {
            start: { uuid: id, offset: 0 },
            end: { uuid: id, offset: 1 },
          },
          text: id,
          role: "host",
          participantId: "fixture",
        });
      }
      lecturers.create({
        id: "lecturer",
        name: "Shared legacy lecturer",
        nip: "123",
        source_type: "manual",
        source_detail: null,
      });
      const { registerWorkspaceHandlers } = load(
        path.join(project, "electron/workspaces/handlers.ts"),
      );
      let failVerification = true;
      const originalHandle = ipcMain.handle.bind(ipcMain);
      ipcMain.handle = (channel, handler) =>
        originalHandle(
          channel,
          channel === "workspaces:migration:verified"
            ? (event, hash) => {
                if (failVerification) {
                  failVerification = false;
                  hash = "injected-mismatch";
                }
                return handler(event, hash);
              }
            : handler,
        );
      registerWorkspaceHandlers({
        preloadEntry: preload,
        isDev: false,
        get window() {
          return sourceWindow;
        },
      });
      sourceWindow = new BrowserWindow({
        show: false,
        width: 1100,
        height: 850,
        webPreferences: { preload, contextIsolation: true },
      });
      app.on("web-contents-created", (_, contents) =>
        contents.on("console-message", (event) => {
          if (event.level === "error") console.error("RENDERER", event.message);
        }),
      );
      await sourceWindow.loadURL("hightex://app/profiles/migration");
      await until(sourceWindow, "window.ready");
      await execute(
        sourceWindow,
        `
    const doc=(id,parentId)=>({id,parentId,title:id,altTitle:'',category:'1',config:{},keywords:{indonesian:[],english:[]},updatedAt:new Date('2026-01-01'),profile:{name:'Author '+id,picture:new Blob(['photo-'+id],{type:'image/webp'})}});
    await db.documents.bulkPut([doc('a'),doc('branch','a'),doc('b'),doc('offline')]);
    await db.chapters.bulkPut([{id:'a.1',content:[{type:'paragraph',content:[{type:'text',text:'A original'}]},{type:'image',attrs:{src:'image-b'}}]},{id:'branch.1',content:[{type:'paragraph',content:[{type:'text',text:'Branch original'}]}]},{id:'b.1',content:[{type:'paragraph',content:[{type:'text',text:'B secret'}]}]}]);
    await db.images.put({id:'image-b',documentId:'b',blob:new Blob(['image-bytes'],{type:'image/png'}),createdAt:1});
    await db.cite.put({key:'global-cite',bib:'@book{global-cite,title={Shared}}'});
    await db.documentVariables.put({documentId:'global',name:'shared',value:'shared value'});
    await db.aliases.put({key:'b.secret',documentId:'b',value:'B only'});
    localStorage.setItem('hightex:forms:v1:a','form-a');localStorage.setItem('hightex:forms:v1:b','form-b');localStorage.setItem('legacy-only','preserved');
    await db.documents.update('a',{file:${JSON.stringify(importedFile)}});
    await db.table('file').put({filePath:${JSON.stringify(importedFile)},documentId:'a',lastUpdated:1});
    await db.table('file').put({filePath:${JSON.stringify(path.join(root, "other.hightex"))},documentId:'a',lastUpdated:2});
    window.original=await capture();window.mount(false);
  `,
      );
      await until(sourceWindow, "document.querySelector('button')");
      assert.equal(
        await execute(
          sourceWindow,
          "return document.body.textContent.includes('Kelompokkan data lama')",
        ),
        true,
      );
      await assert.rejects(
        execute(sourceWindow, "return window.workspaces.migrate({})"),
        /verification failed/,
      );
      assert.equal(
        registry.read().migrationComplete,
        false,
        "failed verification cannot activate staged data",
      );
      assert.equal(restarts, 0);
      assert.equal(snapshots.get().length, 3);
      migrateRun = execute(
        sourceWindow,
        "return window.workspaces.migrate({})",
      );
      await migrateRun;
      assert.equal(restarts, 1);
      assert.equal(registry.read().migrationComplete, true);
      const state = registry.read();
      assert.equal(state.profiles.length, 3);
      const cloudA = state.profiles.find(
          (profile) => profile.accountId === "1",
        ),
        cloudB = state.profiles.find((profile) => profile.accountId === "2");
      assert.ok(
        existsSync(path.join(root, "workspace-migration-v1/source.bin")),
      );
      assert.equal(
        snapshots.get().length,
        3,
        "legacy SQLite source is untouched",
      );
      assert.deepEqual(
        await execute(
          sourceWindow,
          "return (await db.documents.toArray()).map(doc=>doc.id)",
        ),
        ["a", "b", "branch", "offline"],
      );
      const inspect = async (profile) => {
        const window = new BrowserWindow({
          show: false,
          webPreferences: { preload, contextIsolation: true },
        });
        await window.loadURL(`hightex://profile.${profile.id}/inspect`);
        await until(window, "window.ready");
        const data = await execute(
          window,
          "return {ids:(await db.documents.toArray()).map(doc=>doc.id),files:Object.fromEntries((await db.documents.toArray()).map(doc=>[doc.id,doc.file])),fileRecords:await db.table('file').toArray(),photos:await Promise.all((await db.documents.toArray()).map(doc=>doc.profile.picture.text())),forms:Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])),images:await Promise.all((await db.images.toArray()).map(image=>image.blob.text())),aliases:await db.aliases.toArray()}",
        );
        window.destroy();
        return data;
      };
      const a = await inspect(cloudA),
        b = await inspect(cloudB),
        local = await inspect(state.profiles[0]);
      assert.deepEqual(a.ids, ["a", "branch"]);
      assert.deepEqual(b.ids, ["b"]);
      assert.deepEqual(local.ids, ["offline"]);
      assert.deepEqual(a.photos, ["photo-a", "photo-branch"]);
      assert.deepEqual(a.images, ["image-bytes"]);
      assert.deepEqual(a.aliases, []);
      assert.ok(a.files.a.startsWith(registry.directory(cloudA.id)));
      assert.equal(a.fileRecords.length, 2);
      assert.ok(a.fileRecords.some((row) => row.filePath === a.files.a));
      assert.equal(readFileSync(a.files.a, "utf8"), "original-import");
      assert.equal(readFileSync(importedFile, "utf8"), "original-import");
      assert.deepEqual(a.forms, { "hightex:forms:v1:a": "form-a" });
      assert.deepEqual(b.forms, { "hightex:forms:v1:b": "form-b" });
      assert.equal(local.forms["legacy-only"], "preserved");
      for (const profile of state.profiles) {
        const db = new Database(
          path.join(registry.directory(profile.id), "hightex.db"),
        );
        const rows = new Snapshot(db).get(),
          notes = new Comment(db).get();
        assert.deepEqual(
          rows.map((row) => row.documentId),
          profile.id === "local"
            ? ["offline"]
            : profile.accountId === "1"
              ? ["a"]
              : ["b"],
        );
        assert.equal(notes.length, 1);
        assert.equal(new LocalLecturer(db).get().length, 1);
        assert.ok(rows[0].filePath.startsWith(registry.directory(profile.id)));
        assert.ok(existsSync(rows[0].filePath));
        db.close();
      }
      const configA = JSON.parse(
        readFileSync(path.join(registry.directory(cloudA.id), "config.json")),
      );
      const configB = JSON.parse(
        readFileSync(path.join(registry.directory(cloudB.id), "config.json")),
      );
      assert.equal(configA.session.user.id, "1");
      assert.equal(configA.session.browser, undefined);
      assert.equal(configB.session, undefined);
      for (const [profile, id] of [
        [cloudA, "a"],
        [cloudB, "b"],
      ]) {
        const saved = JSON.parse(
          readFileSync(
            path.join(registry.directory(profile.id), "document-sync-v2.json"),
          ),
        ).bindings;
        const key = JSON.stringify([profile.serverUrl, profile.accountId, id]);
        assert.deepEqual(Object.keys(saved), [key]);
        assert.equal(saved[key].serverDocumentId, `server-${id}`);
        assert.equal(saved[key].baseSha256, "a".repeat(64));
      }
      assert.equal(
        readFileSync(
          path.join(registry.directory(cloudA.id), "session.bin"),
          "utf8",
        ),
        "encrypted-fixture",
      );
      // A later startup at the prefixed origin cannot invoke another profile's IPC.
      WorkspaceRuntime.migrating = false;
      WorkspaceRuntime.profile = cloudA;
      await sourceWindow.loadURL(`hightex://profile.${cloudA.id}/inspect`);
      await until(sourceWindow, "window.ready");
      const otherWindow = new BrowserWindow({
        show: false,
        webPreferences: { preload, contextIsolation: true },
      });
      await otherWindow.loadURL(`hightex://profile.${cloudB.id}/inspect`);
      await until(otherWindow, "window.ready");
      assert.equal(
        await execute(
          otherWindow,
          "try{await window.workspaces.state();return false}catch{return true}",
        ),
        true,
      );
      assert.equal(
        await execute(
          sourceWindow,
          "try{await window.workspaces.switch('local');return false}catch{return true}",
        ),
        true,
        "open windows block switching",
      );
      otherWindow.destroy();
      await execute(sourceWindow, "window.mountProfiles()");
      await until(
        sourceWindow,
        "document.querySelector('[data-workspace-profiles]')",
      );
      writeFileSync(
        path.join(root, "profiles.png"),
        (await sourceWindow.webContents.capturePage()).toPNG(),
      );
      await execute(sourceWindow, "return window.workspaces.switch('local')");
      assert.equal(restarts, 2);
      assert.equal(registry.read().activeId, "local");
      sqlite.close();
      console.log(
        "PASS: update migration, failed verification and retry without duplicates, fresh-install detection (unit), per-profile origins, documents/branches/photos/assets/forms, model-based SQLite migration, encrypted-session scope, IPC isolation and switch guard.",
      );
      console.log("Artifacts:", root);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      BrowserWindow.getAllWindows().forEach((window) => window.destroy());
      if (server) await new Promise((resolve) => server.close(resolve));
      if (vite) await vite.close();
      app.exit(process.exitCode || 0);
    });
}
