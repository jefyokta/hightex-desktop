import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function fixture(type: "local" | "cloud") {
  const main = {};
  const editor = {};
  const writes: string[] = [];
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const application = { window: main, profileDraftBusy: false };
  const modules: Record<string, unknown> = {
    electron: {
      BrowserWindow: { fromWebContents: (sender: unknown) => sender },
    },
    "@main/utilities/ipc-main": {
      IPCMain: {
        handle: (channel: string, action: (...args: unknown[]) => unknown) =>
          handlers.set(channel, action),
      },
    },
    "../workspaces/runtime": { WorkspaceRuntime: { profile: { type } } },
    "../service/profile-service": {
      ProfileService: {
        set: () => writes.push("local"),
        clear: () => writes.push("reset"),
        setProfilePicture: () => writes.push("picture"),
        clearProfilePicture: () => writes.push("clear-picture"),
      },
    },
    "../service/account-service": {
      accountService: { update: () => writes.push("cloud") },
    },
    "../service/document-profile-service": { DocumentProfileService: {} },
  };
  const sandbox = {
    exports: {} as typeof import("../electron/handlers/profile-handlers"),
    require: (name: string) => modules[name],
    URL,
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../electron/handlers/profile-handlers.ts", import.meta.url),
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
  sandbox.exports.ProfileHandler.register(application as never);
  const call = (
    channel: string,
    sender = main,
    pathname = "/profile",
    payload: unknown = {},
  ) =>
    handlers.get(channel)!(
      { sender, senderFrame: { url: `hightex://profile.local${pathname}` } },
      payload,
    );
  return { main, editor, writes, application, call };
}

test("profile edits from document windows and other application pages never mutate storage", () => {
  const f = fixture("local");
  for (const channel of [
    "profile:set",
    "profile:reset",
    "profile:picture.set",
    "account:update",
  ]) {
    expect(() => f.call(channel, f.editor)).toThrow();
    expect(() => f.call(channel, f.editor, "/profile/cv")).toThrow();
    expect(() => f.call(channel, f.main, "/dashboard")).toThrow();
  }
  expect(f.writes).toEqual([]);
  f.call("profile:set");
  expect(f.writes).toEqual(["local"]);
});

test("the dedicated CV page can save only through the active profile's storage API", () => {
  const local = fixture("local");
  local.call("profile:set", local.main, "/profile/cv");
  local.call("profile:picture.set", local.main, "/profile/cv");
  expect(local.writes).toEqual(["local", "picture"]);

  const cloud = fixture("cloud");
  expect(() => cloud.call("profile:set", cloud.main, "/profile/cv")).toThrow();
  expect(() =>
    cloud.call("profile:picture.set", cloud.main, "/profile/cv"),
  ).toThrow();
  cloud.call("account:update", cloud.main, "/profile/cv");
  expect(cloud.writes).toEqual(["cloud"]);
});

test("Cloud profile writes cannot bypass the account save API through local setters", () => {
  const f = fixture("cloud");
  for (const channel of ["profile:set", "profile:reset", "profile:picture.set"])
    expect(() => f.call(channel)).toThrow();
  expect(f.writes).toEqual([]);
  f.call("account:update");
  expect(f.writes).toEqual(["cloud"]);
});

test("only the main window can report a pending profile operation", () => {
  const f = fixture("local");
  expect(() =>
    f.call("profile:draft-state", f.editor, "/profile", true),
  ).toThrow();
  expect(() =>
    f.call("profile:draft-state", f.main, "/profile", "true"),
  ).toThrow();
  f.call("profile:draft-state", f.main, "/profile", true);
  expect(f.application.profileDraftBusy).toBe(true);
});
