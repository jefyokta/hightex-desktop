// Run through workspace-profiles.cjs --startup after vite build.
const { app, BrowserWindow } = require("electron");
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");
const root = mkdtempSync(path.join(os.tmpdir(), "hightex-profile-startup-"));
app.setPath("userData", root);
app.getAppPath = () => path.resolve(__dirname, "../..");
app.setAsDefaultProtocolClient = () => true;
process.env.HIGHTEX_MODE = "production";
delete process.env.VITE_DEV_SERVER_URL;
const categories = {
  data: [
    {
      id: 1,
      name: "Thesis",
      variant: "thesis",
      chapters: [{ chapter: "1", title: "Introduction" }],
    },
  ],
};
const directory = path.join(root, "workspaces/local");
mkdirSync(directory, { recursive: true });
writeFileSync(
  path.join(directory, "config.json"),
  JSON.stringify({
    app: { language: "en", theme: "light" },
    hightex: { categories: JSON.stringify(categories) },
  }),
);
globalThis.fetch = async (value) =>
  new Response(
    JSON.stringify(
      new URL(String(value)).pathname.endsWith("/categories") ? categories : {},
    ),
    { status: 200, headers: { "content-type": "application/json" } },
  );
let win, failure;
app.on("browser-window-created", (_, window) => {
  win = window;
  window.on("show", () => window.hide());
  window.webContents.on("console-message", (event) => {
    if (event.level === "error") console.error("RENDERER:", event.message);
  });
  window.webContents.on("preload-error", (_, filename, error) => {
    failure = error;
    console.error(filename, error);
  });
});
// Start importing synchronously, before Electron's ready event.
const startup = import(
  pathToFileURL(path.resolve(__dirname, "../../dist-electron/index.js")).href
);
async function until(code, target) {
  const deadline = Date.now() + 30000;
  while (
    !win ||
    !(await (target ?? win).webContents
      .executeJavaScript(`Boolean(${code})`)
      .catch(() => false))
  ) {
    if (failure) throw failure;
    if (Date.now() > deadline) throw Error("Timed out: " + code);
    await new Promise((resolve) => setTimeout(resolve, 70));
  }
}
(async () => {
  await startup;
  await until("window.workspaces && document.querySelector('button')");
  assert.ok(win.webContents.getURL().startsWith("hightex://profile.local"));
  assert.equal(app.getPath("userData"), directory);
  const state = await win.webContents.executeJavaScript(
    "window.workspaces.state()",
  );
  assert.equal(state.migrationComplete, true, "fresh installs skip migration");
  assert.equal(existsSync(path.join(root, "workspace-migration-v1")), false);
  await win.webContents.executeJavaScript(
    "history.pushState({},'', '/workspaces');window.dispatchEvent(new PopStateEvent('popstate'))",
  );
  await until("document.querySelector('[data-workspace-profiles]')");
  const created = await win.webContents.executeJavaScript(
    "window.workspaces.create({name:'University',type:'cloud'})",
  );
  assert.equal(created.profiles.length, 2);
  assert.equal(created.profiles[1].type, "local");
  assert.equal(created.profiles[1].pendingCloudBinding, true);
  assert.equal(created.profiles[1].serverUrl, null);
  const persisted = JSON.parse(
    readFileSync(path.join(root, "workspaces.json"), "utf8"),
  );
  assert.equal(persisted.profiles.length, 2);
  const mainWindow = win;
  await mainWindow.webContents.executeJavaScript(`(async()=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('HighTexDB');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    await new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({id:'profile-editor-fixture',title:'Profile editor fixture',altTitle:'',category:'1',config:{},keywords:{indonesian:[],english:[]}});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
    db.close();await window.editor.open('profile-editor-fixture');
  })()`);
  const editorWindow = win;
  assert.notEqual(editorWindow, mainWindow);
  await until(
    "document.querySelector('[data-editor-titlebar]') && document.body.textContent.includes('Open Profile in main window')",
    editorWindow,
  );
  assert.equal(
    await editorWindow.webContents.executeJavaScript(
      "window.application.editorDocumentId",
    ),
    "profile-editor-fixture",
  );
  await assert.rejects(
    editorWindow.webContents.executeJavaScript(
      "window.profile.set({name:'Blocked editor edit'})",
    ),
  );
  await editorWindow.webContents.executeJavaScript(
    `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Open Profile in main window').click()`,
  );
  await until(
    "location.pathname==='/profile' && document.querySelector('[data-tour=default-profile]')",
    mainWindow,
  );
  assert.ok(
    editorWindow.webContents
      .getURL()
      .endsWith("/document/profile-editor-fixture"),
  );
  await editorWindow.webContents.executeJavaScript(
    "window.fixtureEditorRoot=document.querySelector('[data-editor-titlebar]');history.pushState({},'', '/profile');window.dispatchEvent(new PopStateEvent('popstate'))",
  );
  await until(
    "location.pathname==='/document/profile-editor-fixture'",
    editorWindow,
  );
  assert.equal(
    await editorWindow.webContents.executeJavaScript(
      "document.querySelector('[data-editor-titlebar]')===window.fixtureEditorRoot && !document.querySelector('[data-tour=default-profile]')",
    ),
    true,
  );
  await mainWindow.webContents.executeJavaScript(
    "window.profile.set({name:'Main window author',nim:'123',cv:'Saved workspace CV'})",
  );
  await until(
    "!document.body.textContent.includes('Complete the workspace author profile')",
    editorWindow,
  );
  assert.equal(
    (await editorWindow.webContents.executeJavaScript("window.profile.get()"))
      .name,
    "Main window author",
  );
  writeFileSync(
    path.join(root, "startup.png"),
    (await mainWindow.webContents.capturePage()).toPNG(),
  );
  console.log(
    "PASS: built main startup, prefixed origin, scoped userData, fresh install without migration, real preload IPC, profile management UI; editor opens Profile in main window, rejects profile writes and application routes, and updates identity without replacing the editor.",
  );
  console.log("Artifacts:", root);
})()
  .catch(async (error) => {
    if (win)
      console.error(
        "Startup state:",
        win.webContents.getURL(),
        await win.webContents
          .executeJavaScript(
            "({body:document.body.innerText.slice(0,600),workspaces:typeof window.workspaces})",
          )
          .catch(() => "unavailable"),
      );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    BrowserWindow.getAllWindows().forEach((window) => window.destroy());
    app.exit(process.exitCode || 0);
  });
