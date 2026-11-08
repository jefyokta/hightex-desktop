// Real Vite HMR over loopback, with two isolated hightex:// profile origins.
const { app, BrowserWindow, protocol, net } = require("electron");
const { createServer } = require("node:net");
const {
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const project = path.resolve(__dirname, "../..");
const fixture = realpathSync(
  mkdtempSync(path.join(os.tmpdir(), "hightex-profile-hmr-")),
);
app.setPath("userData", fixture);
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
let vite;
let stage = "initializing";
const deadline = setTimeout(() => {
  console.error("HMR integration timed out during:", stage);
  app.exit(1);
}, 45000);
const windows = [];
const sockets = [];
const connected = new Set();
const probeFile = path.join(fixture, "probe.js");
const probe = (value) => `export const value=${JSON.stringify(value)};
window.hmrValue=value;
if(import.meta.hot)import.meta.hot.accept(module=>{window.hmrValue=module.value});`;
writeFileSync(probeFile, probe("before"));
writeFileSync(
  path.join(fixture, "index.html"),
  `<!doctype html><html><body>
<input id="draft"><script type="module" src="/boot.js"></script>
</body></html>`,
);
writeFileSync(
  path.join(fixture, "boot.js"),
  "import '/probe.js';window.pageIdentity=crypto.randomUUID();",
);
const execute = (window, code) => window.webContents.executeJavaScript(code);
async function until(condition, label) {
  const deadline = Date.now() + 20000;
  while (!(await condition())) {
    if (Date.now() > deadline) throw Error("Timed out: " + label);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
app
  .whenReady()
  .then(async () => {
    const { createServer: createVite } = await import("vite");
    // Load the actual config hook without starting the app's Electron launcher.
    const sandbox = {
      exports: {},
      __dirname: project,
      process,
      require: (name) => {
        if (name === "vite") return { defineConfig: (config) => config };
        if (name === "node:path") return path;
        return { __esModule: true, default: () => [] };
      },
    };
    vm.runInNewContext(
      ts.transpileModule(
        readFileSync(path.join(project, "vite.config.ts"), "utf8"),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
          },
        },
      ).outputText,
      sandbox,
    );
    const config = sandbox.exports.default;
    const hmr = config.plugins.find(
      (plugin) => plugin?.name === "hightex-profile-hmr",
    );
    assert.ok(hmr, "the application config supplies its profile HMR plugin");
    // Reserve an alternate port so the test also checks --port-style overrides.
    const listener = createServer();
    await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
    const port = listener.address().port;
    await new Promise((resolve) => listener.close(resolve));
    vite = await createVite({
      configFile: false,
      root: fixture,
      cacheDir: path.join(fixture, "cache"),
      server: { ...config.server, port },
      plugins: [hmr],
      logLevel: "error",
    });
    stage = "starting Vite";
    await vite.listen();
    assert.equal(vite.config.server.hmr.host, "127.0.0.1");
    assert.equal(vite.config.server.hmr.clientPort, port);
    vite.ws.on("connection", (_socket, request) => {
      const url = new URL(`http://${request.headers.host}`);
      sockets.push({ host: url.hostname, port: url.port });
    });
    protocol.handle("hightex", (request) => {
      const original = new URL(request.url);
      return net.fetch(
        `http://127.0.0.1:${port}${original.pathname}${original.search}`,
      );
    });
    for (const profile of ["profile.hmr-a", "profile.hmr-b"]) {
      stage = "loading " + profile;
      const window = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });
      windows.push(window);
      window.webContents.on("console-message", (event) => {
        if (event.message.includes("[vite] connected.")) connected.add(profile);
        if (event.level === "error") console.error(event.message);
      });
      await window.loadURL(`hightex://${profile}/`);
      await until(
        () =>
          execute(
            window,
            "window.hmrValue==='before' && Boolean(window.pageIdentity)",
          ),
        "profile page",
      );
      await execute(
        window,
        `localStorage.setItem('profile',${JSON.stringify(profile)});document.querySelector('#draft').value=${JSON.stringify(profile)}`,
      );
    }
    await until(
      () => connected.size === 2,
      "both profile WebSockets connected",
    );
    assert.equal(sockets.length, 2);
    assert.ok(
      sockets.every(
        (socket) => socket.host === "127.0.0.1" && socket.port === String(port),
      ),
    );
    const identities = await Promise.all(
      windows.map((window) => execute(window, "window.pageIdentity")),
    );
    stage = "applying hot update";
    writeFileSync(probeFile, probe("after"));
    for (const [index, window] of windows.entries()) {
      await until(
        () => execute(window, "window.hmrValue==='after'"),
        "hot module update",
      );
      assert.equal(
        await execute(window, "window.pageIdentity"),
        identities[index],
        "HMR keeps the page mounted",
      );
      assert.equal(
        await execute(window, "document.querySelector('#draft').value"),
        `profile.hmr-${index === 0 ? "a" : "b"}`,
      );
      assert.equal(
        await execute(window, "localStorage.getItem('profile')"),
        `profile.hmr-${index === 0 ? "a" : "b"}`,
      );
      assert.equal(new URL(window.webContents.getURL()).protocol, "hightex:");
    }
    console.log(
      "PASS: two profile origins connect HMR directly to Vite on the configured alternate port; source changes update both pages without reload, retaining drafts and isolated storage.",
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    clearTimeout(deadline);
    windows.forEach((window) => window.destroy());
    await vite?.close();
    app.exit(process.exitCode || 0);
  });
