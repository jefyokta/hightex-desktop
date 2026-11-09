// Opt-in Electron UI fixture; never downloads or installs an application.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, rmSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const root = mkdtempSync(path.join(os.tmpdir(), "hightex-updater-ui-"));
app.setPath("userData", root);
app.disableHardwareAcceleration();
let vite, server, win;
let exitCode = 0;
const deadline = setTimeout(() => app.exit(1), 60000);
deadline.unref();
const html = `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {UpdaterStatusListener} from '/src/components/updater-status-listener.tsx';
import {ConfirmProvider} from '/src/context/confrim-context.tsx';import {Toaster} from 'sonner';
import '/src/App.css';
window.config={get:()=>({language:'id'})};window.installs=0;window.downloads=0;window.failInstall=false;
window.updater={onStatus:callback=>{window.emit=callback;return()=>{}},download:async()=>{window.downloads++},install:async()=>{
window.installs++;await window.emit({status:'installing',manual:true});
await window.emit({status:'downloaded',info:{version:'2.0.0'},manual:false,retry:true});
return window.failInstall?{ok:false,message:'Fixture installation failure'}:{ok:false,cancelled:true};
}};
createRoot(document.getElementById('root')).render(React.createElement(ConfirmProvider,null,React.createElement(UpdaterStatusListener),React.createElement(Toaster)));
</script></body></html>`;
const execute = (code) =>
  win.webContents.executeJavaScript(`(async()=>{${code}})()`, true);
async function until(code) {
  const end = Date.now() + 10000;
  while (!(await execute(`return Boolean(${code})`))) {
    if (Date.now() > end) throw Error("Timed out: " + code);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}
async function click(text, container = "[role=dialog]") {
  await execute(
    `const button=[...document.querySelectorAll(${JSON.stringify(container + " button")})].find(b=>b.textContent===${JSON.stringify(text)});if(!button)throw Error('Missing button');button.click()`,
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
      webPreferences: { contextIsolation: true, backgroundThrottling: false },
    });
    await win.loadURL("http://127.0.0.1:" + server.address().port);
    await until("window.emit");
    await execute(
      "void window.emit({status:'downloaded',info:{version:'2.0.0'},manual:false})",
    );
    await until("document.querySelector('[role=dialog]')");
    const description = await execute(
      "return document.querySelector('[role=dialog]').textContent",
    );
    assert.ok(description.includes("2.0.0"));
    assert.ok(!/\{version\}|rm -rf|hightex update/.test(description));
    await click("Nanti");
    await until("!document.querySelector('[role=dialog]')");
    assert.equal(await execute("return window.installs"), 0);
    await click("Pasang dan buka ulang", "[data-sonner-toaster]");
    await until("window.installs===1");
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(
      await execute("return Boolean(document.querySelector('[role=dialog]'))"),
      false,
    );
    assert.equal(await execute("return window.installs"), 1);
    await execute("window.failInstall=true");
    await click("Pasang dan buka ulang", "[data-sonner-toaster]");
    await until(
      "document.body.textContent.includes('Fixture installation failure')",
    );
    assert.equal(await execute("return window.installs"), 2);
    assert.equal(
      await execute("return Boolean(document.querySelector('[role=dialog]'))"),
      false,
    );
    console.log(
      "PASS: localized update confirmation, Later, cancellation without repeat prompts, retry and visible installation errors; no real downloads or installs.",
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
