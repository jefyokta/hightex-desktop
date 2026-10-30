import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const fixture = (
  isPackaged: boolean,
  localServer?: string,
  appEnv?: string,
) => {
  const modules: Record<string, unknown> = {
    electron: { app: { isPackaged } },
    "dotenv/config": {},
  };
  const sandbox = {
    exports: {} as typeof import("../electron/url/server-url"),
    require: (name: string) => modules[name],
    URL,
    process: { env: { LOCAL_SERVER: localServer, APP_ENV: appEnv } },
  };
  const runtime = {
    ...sandbox,
    exports: {} as typeof import("../electron/main/application-runtime"),
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../electron/main/application-runtime.ts", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      },
    ).outputText,
    runtime,
  );
  modules["../main/application-runtime"] = runtime.exports;
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../electron/url/server-url.ts", import.meta.url),
        "utf8",
      ),
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
  return sandbox.exports.ServerUrl;
};

test("packaged builds use the production server even with LOCAL_SERVER configured", () => {
  const ServerUrl = fixture(true, "http://localhost:9000");
  expect(ServerUrl.instance.url.href).toBe("https://hightex.jefyokta.dev/");
  expect(ServerUrl.instance.api.href).toBe("https://hightex.jefyokta.dev/api/");
  expect(ServerUrl.instance).toBe(ServerUrl.instance);
});

test("development uses LOCAL_SERVER with its port or the local default", () => {
  expect(fixture(false).instance.api.href).toBe("http://127.0.0.1:8000/api/");
  expect(fixture(false, "").instance.api.href).toBe(
    "http://127.0.0.1:8000/api/",
  );
  const ServerUrl = fixture(false, "http://localhost:9000/api/");
  expect(ServerUrl.instance.endpoint("/me").href).toBe(
    "http://localhost:9000/api/me",
  );
});

test("APP_ENV cannot override Electron's packaging status", () => {
  const ServerUrl = fixture(false, "http://localhost:9000", "production");
  expect(ServerUrl.instance.api.href).toBe("http://localhost:9000/api/");
  expect(
    fixture(true, "http://localhost:9000", "development").instance.api.href,
  ).toBe("https://hightex.jefyokta.dev/api/");
});

test("API routes retain the API prefix, nested paths and encoded query values", () => {
  const ServerUrl = fixture(false);
  const server = new ServerUrl("https://fixture.test/api/");
  for (const path of [
    "v2/documents?title=a%2Fb",
    "/v2/documents?title=a%2Fb",
    "///v2/documents?title=a%2Fb",
  ])
    expect(server.endpoint(path).href).toBe(
      "https://fixture.test/api/v2/documents?title=a%2Fb",
    );
  expect(server.api.href).toBe("https://fixture.test/api/");
  expect(server.resolve("/profile/update").href).toBe(
    "https://fixture.test/profile/update",
  );
  expect(server.resolve("storage/profile-pictures/profile-a.webp").href).toBe(
    "https://fixture.test/storage/profile-pictures/profile-a.webp",
  );
  expect(server.resolve().href).toBe("https://fixture.test/");
});

test("origin comparison includes protocol and port", () => {
  const ServerUrl = fixture(false);
  const server = new ServerUrl("https://fixture.test:8443");
  expect(server.compare("https://fixture.test:8443/auth?state=abc")).toBe(true);
  expect(
    server.compare(new URL("https://fixture.test:8443/storage/photo.webp")),
  ).toBe(true);
  expect(server.compare("https://fixture.test/auth")).toBe(false);
  expect(server.compare("http://fixture.test:8443/auth")).toBe(false);
  expect(server.compare("https://fixture.test.evil:8443/auth")).toBe(false);
});

test("server routes cannot escape the configured origin or API scope", () => {
  const ServerUrl = fixture(false);
  const server = new ServerUrl("https://fixture.test");
  for (const path of [
    "https://other.test/api/me",
    "../login",
    "\\\\other.test/api/me",
    "https://user:password@fixture.test/api/me",
  ])
    expect(() => server.endpoint(path)).toThrow();
  for (const path of [
    "https://other.test/",
    "//other.test/",
    "javascript:alert(1)",
    "https://user:password@fixture.test/",
  ])
    expect(() => server.resolve(path)).toThrow();
  for (const base of [
    "file:///tmp/server",
    "https://user:password@fixture.test",
    "invalid",
  ])
    expect(() => new ServerUrl(base)).toThrow();
});
