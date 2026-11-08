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
async function until(code) {
  const deadline = Date.now() + 30000;
  while (
    !win ||
    !(await win.webContents
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
    "history.pushState({},'', '/profile');window.dispatchEvent(new PopStateEvent('popstate'))",
  );
  await until("document.querySelector('[data-workspace-profiles]')");
  const created = await win.webContents.executeJavaScript(
    "window.workspaces.create({name:'University',serverUrl:'https://university.test'})",
  );
  assert.equal(created.profiles.length, 2);
  assert.equal(created.profiles[1].serverUrl, "https://university.test/api/");
  const persisted = JSON.parse(
    readFileSync(path.join(root, "workspaces.json"), "utf8"),
  );
  assert.equal(persisted.profiles.length, 2);
  writeFileSync(
    path.join(root, "startup.png"),
    (await win.webContents.capturePage()).toPNG(),
  );
  console.log(
    "PASS: built main startup, protocol registration before ready, prefixed origin, scoped userData, fresh install without migration, real preload IPC, profile management UI.",
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
