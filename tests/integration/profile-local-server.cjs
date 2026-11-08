// Opt-in: actual built desktop + ../hightex Laravel server. Uses temporary desktop storage.
// The existing local demo account is used; profile content is saved unchanged.
const { app, BrowserWindow } = require("electron");
const { mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");
const project = path.resolve(__dirname, "../..");
const artifacts = mkdtempSync(
  path.join(os.tmpdir(), "hightex-local-server-login-"),
);
app.setPath("userData", artifacts);
app.getAppPath = () => project;
app.setAsDefaultProtocolClient = () => true;
process.env.HIGHTEX_MODE = "development";
process.env.DEV_MODE = "true";
process.env.LOCAL_SERVER ||= "http://127.0.0.1:8000";
delete process.env.VITE_DEV_SERVER_URL;
const configured = new URL(process.env.LOCAL_SERVER);
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(configured.hostname),
  "local-only integration test",
);
const fixture = readFileSync(path.join(__dirname, "local-server.ts"), "utf8");
const demo = /role: "student",\s*email: "([^"]+)",\s*password: "([^"]+)"/.exec(
  fixture,
);
assert.ok(demo, "existing local demo credentials are available");
const email = process.env.HIGHTEX_TEST_EMAIL || demo[1];
const password = process.env.HIGHTEX_TEST_PASSWORD || demo[2];
let mainWindow, failure;
app.on("web-contents-created", (_, contents) => {
  contents.openDevTools = () => {};
});
app.on("browser-window-created", (_, window) => {
  mainWindow ||= window;
  window.on("show", () => window.hide());
  window.webContents.on("preload-error", (_, _filename, error) => {
    failure = error;
  });
});
const startup = import(
  pathToFileURL(path.join(project, "dist-electron/index.js")).href
);
const execute = (code) => mainWindow.webContents.executeJavaScript(code, true);
async function until(code) {
  const deadline = Date.now() + 30000;
  while (
    !mainWindow ||
    !(await execute(`Boolean(${code})`).catch(() => false))
  ) {
    if (failure) throw failure;
    if (Date.now() > deadline) throw Error("Timed out: " + code);
    await new Promise((resolve) => setTimeout(resolve, 70));
  }
}
const profileCV = '[role="textbox"][aria-labelledby="cloud-cv-label"]';
(async () => {
  await startup;
  await until("window.workspaces && document.querySelector('button')");
  assert.equal(
    new URL(await execute("window.hightex.serverUrl()")).origin,
    configured.origin,
  );
  const pending = await execute("window.workspaces.beginCloudBinding('local')");
  assert.equal(pending.profiles[0].type, "local");
  assert.equal(pending.profiles[0].pendingCloudBinding, true);
  await until(
    "document.querySelector('input[type=email]') && document.querySelector('input[type=password]')",
  );
  await execute(`(()=>{
    for (const [type,value] of ${JSON.stringify([
      ["email", email],
      ["password", password],
    ])}) {
      const input=document.querySelector('input[type='+type+']');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    document.querySelector('input[type=password]').closest('form').requestSubmit();
  })()`);
  await until("!document.querySelector('input[type=password]')");
  const state = await execute("window.workspaces.state()");
  const active = state.profiles.find(
    (profile) => profile.id === state.activeId,
  );
  assert.equal(active.type, "cloud");
  assert.ok(active.accountId);
  assert.equal(active.pendingCloudBinding, undefined);
  assert.equal(new URL(active.serverUrl).origin, configured.origin);
  const user = await execute("window.session.user()");
  assert.equal(String(user.id), active.accountId);
  await execute(
    "history.pushState({},'', '/profile/cv');window.dispatchEvent(new PopStateEvent('popstate'))",
  );
  await until(
    `document.querySelector(${JSON.stringify(profileCV)})?.isContentEditable`,
  );
  const verification = await execute(`(async()=>{
    const loaded=await window.account.load();
    if(!loaded.ok)throw Error('Account load: '+loaded.error);
    const before=loaded.data;
    const saved=await window.account.update({sessionId:before.session.sessionId,cv:before.cv??''});
    if(!saved.ok)throw Error('Account save: '+saved.error);
    const cached=await window.profile.cachedCloud();
    return {sameCV:(saved.data.cv??'')===(before.cv??''),samePhoto:saved.data.picturePath===before.picturePath,cacheMatches:cached?.name===saved.data.name&&cached?.cv===(saved.data.cv??'')};
  })()`);
  assert.deepEqual(verification, {
    sameCV: true,
    samePhoto: true,
    cacheMatches: true,
  });
  const logout = await execute("window.session.logout()");
  assert.equal(logout.revoked, true);
  await until(
    `document.querySelector(${JSON.stringify(profileCV)})?.contentEditable==='false'`,
  );
  const cachedAfterLogout = await execute("window.profile.get()");
  assert.equal(cachedAfterLogout.name, user.name);
  const relogin = await execute(
    `window.session.signIn(${JSON.stringify(email)},${JSON.stringify(password)})`,
  );
  assert.equal(relogin.ok, true);
  await until(
    `document.querySelector(${JSON.stringify(profileCV)})?.isContentEditable`,
  );
  const after = await execute("window.workspaces.state()");
  assert.equal(after.profiles.length, 1);
  assert.equal(after.activeId, state.activeId);
  assert.equal(after.profiles[0].accountId, active.accountId);
  assert.equal((await execute("window.session.logout()")).revoked, true);
  await until(
    `document.querySelector(${JSON.stringify(profileCV)})?.contentEditable==='false'`,
  );
  writeFileSync(
    path.join(artifacts, "profile-after-logout.png"),
    (await mainWindow.webContents.capturePage()).toPNG(),
  );
  console.log(
    JSON.stringify({
      server: configured.origin,
      login: "passed",
      localToCloudBinding: true,
      accountProfileLoad: true,
      sameCVSaved: true,
      originalPhotoPreserved: true,
      cacheAvailableAfterLogout: true,
      reloginKeepsWorkspace: true,
      testTokensRevoked: true,
    }),
  );
  console.log("Temporary desktop profile:", artifacts);
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mainWindow && !mainWindow.isDestroyed())
      await execute("window.session.logout()").catch(() => {});
    BrowserWindow.getAllWindows().forEach((window) => window.destroy());
    app.exit(process.exitCode || 0);
  });
