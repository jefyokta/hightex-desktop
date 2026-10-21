import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { AuthClient, parseAccountUser } from "../electron/service/auth-client";

// Isolate the real main-process handler without starting Electron or installing
// module mocks that would affect other tests in the same Bun process.
const harness = (request: () => Promise<unknown>) => {
  const actor: User = {
    id: "advisor",
    name: "Advisor",
    email: "advisor@example.test",
    identity_number: "1",
    roles: [{ id: 1, name: "advisor" }],
    role: "advisor",
    advisors: [],
  };
  const state: { token?: string; user?: User } = {
    token: "token-a",
    user: actor,
  };
  const sent: unknown[] = [];
  const channels = new Map<string, (...args: unknown[]) => unknown>();
  const modules: Record<string, unknown> = {
    electron: {
      BrowserWindow: {
        getAllWindows: () => [
          {
            isDestroyed: () => false,
            webContents: {
              send: (_channel: string, user: unknown) => sent.push(user),
            },
          },
        ],
      },
    },
    "../service/server-service": { ServerService: { request } },
    "../service/auth-client": { parseAccountUser },
    "../service/auth-service": {
      desktopAuth: new AuthClient({
        serverUrl: () => "http://local/api/",
        request: async () => ({ ok: true, status: 200, data: await request() }),
        session: () => state,
        save: (user, token) => {
          state.user = user;
          state.token = token;
        },
        clear: () => {
          state.user = undefined;
          state.token = undefined;
        },
        pending: () => undefined,
        setPending: () => {},
        broadcast: async () => {
          sent.push(state.user ?? false);
        },
        open: async () => {},
      }),
    },
    "../service/logger-service": { LoggerService: { write: () => {} } },
    "../service/session-service": {
      SessionService: {
        getToken: () => state.token,
        getUser: () => state.user,
        setToken: (token: string) => {
          state.token = token;
        },
        setUser: (user: User) => {
          state.user = user;
        },
        clearUser: () => {
          state.user = undefined;
        },
        clear: () => {
          state.user = undefined;
          state.token = undefined;
        },
      },
    },
    "@main/utilities/ipc-main": {
      IPCMain: {
        handle: (channel: string, listener: (...args: unknown[]) => unknown) =>
          channels.set(channel, listener),
      },
    },
  };
  const compiled = ts.transpileModule(
    readFileSync(
      new URL("../electron/handlers/session-handlers.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  const sandbox = {
    exports: {} as {
      SessionHandler: typeof import("../electron/handlers/session-handlers").SessionHandler;
    },
    require: (name: string) => modules[name],
  };
  vm.runInNewContext(compiled, sandbox);
  return {
    handler: sandbox.exports.SessionHandler,
    state,
    sent,
    channels,
    actor,
  };
};

test("session refresh coalesces concurrent /me calls and broadcasts use cached state", async () => {
  let requests = 0;
  let finish!: (value: unknown) => void;
  const context = harness(() => {
    requests++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const first = context.handler.user();
  const second = context.handler.user();
  expect(requests).toBe(1);
  finish({ message: context.actor });
  expect(await first).toEqual(context.actor);
  expect(await second).toEqual(context.actor);
  await context.handler.broadcastSession();
  expect(requests).toBe(1);
  expect(context.sent[context.sent.length - 1]).toEqual(context.actor);
});

test("an old /me result cannot restore a user after logout or overwrite a new account", async () => {
  for (const logout of [true, false]) {
    let finish!: (value: unknown) => void;
    const context = harness(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = context.handler.user();
    context.state.token = logout ? undefined : "token-b";
    context.state.user = logout
      ? undefined
      : { ...context.actor, id: "new-account" };
    finish({ message: context.actor });
    expect(await pending).toEqual(context.state.user ?? false);
    expect(context.state.user?.id).toBe(logout ? undefined : "new-account");
  }
});

test("failed /me broadcasts cleared state and IPC login returns its real result", async () => {
  const failed = harness(async () => {
    throw Object.assign(new Error("Expired"), { response: { status: 401 } });
  });
  expect(await failed.handler.user()).toBe(false);
  expect(failed.state.user).toBeUndefined();
  expect(failed.sent[failed.sent.length - 1]).toBe(false);
  const loggedInUser = { ...failed.actor, id: "signed-in" };
  const login = harness(async () => ({
    data: { user: loggedInUser, token: "new-token" },
  }));
  login.handler.register();
  const result = await login.channels.get("session:login")!(
    undefined,
    "advisor@example.test",
    "test-password",
  );
  expect(result).toEqual(loggedInUser);
  expect(login.state.token).toBe("new-token");
});

test("network failures and /me permission errors preserve the cached session without a request loop", async () => {
  for (const status of [undefined, 403]) {
    let requests = 0;
    const context = harness(async () => {
      requests++;
      throw Object.assign(new Error("Unavailable"), {
        response: status ? { status } : undefined,
      });
    });
    expect(await context.handler.user()).toEqual(context.actor);
    expect(context.state.token).toBe("token-a");
    expect(context.sent).toHaveLength(0);
    expect(requests).toBe(1);
  }
});
