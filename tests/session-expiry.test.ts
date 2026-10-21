import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const fixture = () => {
  let now = Date.now(),
    server = "http://local/api/";
  const values = new Map<string, unknown>(),
    files = new Map<string, Buffer>();
  const timers: {
    callback: () => void;
    ms: number;
    canceled: boolean;
    unref(): void;
  }[] = [];
  const modules: Record<string, unknown> = {
    "electron-store": {
      default: class {
        get(key: string) {
          return values.get(key);
        }
        set(key: string, value: unknown) {
          values.set(key, value);
        }
        delete(key: string) {
          values.delete(key);
        }
      },
    },
    electron: {
      app: { getPath: () => "/fixture" },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (text: string) => Buffer.from(text),
        decryptString: (value: Buffer) => value.toString(),
      },
    },
    "node:fs": {
      default: {
        readFileSync: (path: string) => {
          const value = files.get(path);
          if (!value) throw Error("Missing");
          return value;
        },
        writeFileSync: (path: string, value: Buffer) => files.set(path, value),
        rmSync: (path: string) => files.delete(path),
      },
    },
    "node:path": { default: { join: (...parts: string[]) => parts.join("/") } },
    "./server-service": { ServerService: { getServerUrl: () => server } },
  };
  const sandbox = {
    exports: {} as {
      SessionService: typeof import("../electron/service/session-service").SessionService;
    },
    require: (name: string) => modules[name],
    process: { platform: "darwin" },
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    setTimeout: (callback: () => void, ms: number) => {
      const timer = { callback, ms, canceled: false, unref() {} };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (timer?: { canceled: boolean }) => {
      if (timer) timer.canceled = true;
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../electron/service/session-service.ts", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText,
    sandbox,
  );
  return {
    service: sandbox.exports.SessionService,
    timers,
    files,
    values,
    advance: (ms: number) => {
      now += ms;
    },
    server: () => {
      server = "http://other/api/";
    },
    expiry: (ms: number) => new Date(now + ms).toISOString(),
  };
};
test("long-lived session expiry uses bounded timers and clears the token/user at its deadline", () => {
  const f = fixture();
  const s = f.service;
  s.setUser({
    id: "12",
    name: "Student",
    email: "a@test",
    identity_number: "1",
    advisors: [],
    roles: [],
  });
  s.setToken("secret");
  s.setExpiry(f.expiry(30 * 86400000));
  expect(f.timers[f.timers.length - 1]?.ms).toBe(2147483647);
  expect(s.getUser()?.role).toBeNull();
  let expired = 0;
  s.onExpired = () => {
    expired++;
  };
  f.advance(30 * 86400000 + 1);
  f.timers[f.timers.length - 1]!.callback();
  expect(s.getToken()).toBeUndefined();
  expect(s.getUser()).toBeUndefined();
  expect(f.files.size).toBe(0);
  expect(expired).toBe(1);
});
test("a token bound to a different server cannot be reused or leave the previous user visible", () => {
  const f = fixture();
  f.service.setToken("secret");
  f.service.setExpiry(f.expiry(86400000));
  f.service.setUser({
    id: "12",
    name: "Student",
    email: "a@test",
    identity_number: "1",
    advisors: [],
    roles: [],
  });
  f.server();
  expect(f.service.getToken()).toBeUndefined();
  expect(f.service.getUser()).toBeUndefined();
});
