import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function fixture(
  options: {
    dev?: boolean;
    renderer?: boolean;
    connected?: boolean;
    sendError?: Error;
  } = {},
) {
  let quits = 0;
  let relaunches = 0;
  const requests: unknown[] = [];
  const process = Object.assign(new EventEmitter(), {
    env:
      options.renderer === false
        ? {}
        : { VITE_DEV_SERVER_URL: "http://127.0.0.1:5173/" },
    connected: options.connected ?? true,
    send(message: unknown, done: (error: Error | null) => void) {
      requests.push(message);
      done(options.sendError ?? null);
    },
  });
  const exports =
    {} as typeof import("../electron/utilities/restart-application");
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL(
          "../electron/utilities/restart-application.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText,
    {
      exports,
      process,
      setTimeout,
      clearTimeout,
      require: (name: string) =>
        name === "electron"
          ? {
              app: {
                quit: () => {
                  quits++;
                },
                relaunch: () => {
                  relaunches++;
                },
              },
            }
          : { ApplicationRuntime: { isDev: options.dev ?? true } },
    },
  );
  return {
    process,
    requests,
    restart: exports.restartApplication,
    quits: () => quits,
    relaunches: () => relaunches,
  };
}

test("development waits for the parent to protect Vite before quitting Electron", async () => {
  const f = fixture();
  const restarting = f.restart();
  expect(f.requests).toEqual([{ type: "hightex:restart" }]);
  expect(f.quits()).toBe(0);
  f.process.emit("message", { type: "unrelated" });
  expect(f.quits()).toBe(0);
  f.process.emit("message", { type: "hightex:restart-ready" });
  await restarting;
  expect(f.quits()).toBe(1);
  expect(f.relaunches()).toBe(0);
  expect(f.process.listenerCount("message")).toBe(0);
  expect(f.process.listenerCount("disconnect")).toBe(0);
});

test("a disconnected development parent rejects the restart without quitting", async () => {
  const f = fixture();
  const restarting = f.restart();
  f.process.emit("disconnect");
  await expect(restarting).rejects.toThrow(
    "Development server disconnected before restart",
  );
  expect(f.quits()).toBe(0);
  expect(f.process.listenerCount("message")).toBe(0);
});

test("failed IPC delivery leaves Electron running and removes restart listeners", async () => {
  const f = fixture({ sendError: new Error("IPC channel closed") });
  await expect(f.restart()).rejects.toThrow("IPC channel closed");
  expect(f.quits()).toBe(0);
  expect(f.process.listenerCount("message")).toBe(0);
  expect(f.process.listenerCount("disconnect")).toBe(0);
});

test.each([{ dev: false }, { renderer: false }, { connected: false }])(
  "packaged and standalone execution retain native relaunch: %j",
  async (options) => {
    const f = fixture(options);
    await f.restart();
    expect(f.relaunches()).toBe(1);
    expect(f.quits()).toBe(1);
    expect(f.requests).toHaveLength(0);
  },
);
