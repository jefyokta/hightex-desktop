import { expect, test } from "bun:test";
import { AuthClient } from "../electron/service/auth-client";
const fixture = () => {
  let server = "http://local/api/",
    now = Date.now(),
    pending: PendingBrowserLogin | undefined;
  let session: { token?: string; user?: User } = {};
  const user = {
    id: "12",
    name: "Student",
    email: "student@test",
    roles: [],
    advisors: [],
    identity_number: "A",
  };
  const calls: { endpoint: string; options?: RequestInit }[] = [],
    opened: string[] = [];
  let responder: (
    endpoint: string,
    options?: RequestInit,
  ) => Promise<{ ok: boolean; status: number; data: unknown }> = async (
    endpoint,
  ) => ({
    ok: true,
    status: 200,
    data:
      endpoint === "/auth/desktop"
        ? { login_url: `http://local/auth/desktop?state=${"s".repeat(64)}` }
        : endpoint === "/auth/desktop/exchange"
          ? {
              user,
              access_token: "browser-token",
              token_type: "Bearer",
              expires_at: new Date(now + 86400000).toISOString(),
            }
          : endpoint === "/login"
            ? { data: { user, token: "direct-token" } }
            : {},
  });
  let broadcasts = 0;
  const transport = {
    serverUrl: () => server,
    now: () => now,
    request: async (_: string, endpoint: string, options?: RequestInit) => {
      calls.push({ endpoint, options });
      return responder(endpoint, options);
    },
    session: () => session,
    save: (next: User, token: string, expiresAt: string) => {
      expect(Date.parse(expiresAt)).toBeGreaterThan(now);
      session = { token, user: next };
    },
    clear: () => {
      session = {};
    },
    pending: () => pending,
    setPending: (value?: PendingBrowserLogin) => {
      pending = value;
    },
    broadcast: async () => {
      broadcasts++;
    },
    open: async (url: string) => {
      opened.push(url);
    },
  };
  return {
    client: new AuthClient(transport),
    rebuild: () => new AuthClient(transport),
    calls,
    opened,
    user,
    session: () => session,
    broadcasts: () => broadcasts,
    callback: (state = "s".repeat(64)) =>
      `hightex://auth/callback?state=${state}&code=${"c".repeat(64)}`,
    server: (value: string) => {
      server = value;
    },
    advance: (ms: number) => {
      now += ms;
    },
    respond: (value: typeof responder) => {
      responder = value;
    },
  };
};
test("browser login persists state across restart, consumes callback once, and accepts empty roles", async () => {
  const f = fixture();
  expect((await f.client.start()).ok).toBe(true);
  expect(f.opened).toHaveLength(1);
  const client = f.rebuild();
  expect(client.status().status).toBe("waiting");
  expect((await client.callback(f.callback())).ok).toBe(true);
  expect(f.session().token).toBe("browser-token");
  expect(f.session().user?.role).toBeNull();
  expect((await client.callback(f.callback())).ok).toBe(false);
  expect(
    f.calls.filter((call) => call.endpoint.endsWith("exchange")),
  ).toHaveLength(1);
});
test("wrong state, wrong host, duplicate parameters and missing transaction never exchange", async () => {
  const f = fixture();
  await f.client.start();
  for (const url of [
    f.callback("wrong"),
    f.callback().replace("auth/", "other/"),
    f.callback() + "&code=duplicate",
    f.callback() + "&state=duplicate",
  ])
    expect((await f.client.callback(url)).ok).toBe(false);
  expect(f.calls).toHaveLength(1);
  expect((await f.client.callback(f.callback())).ok).toBe(true);
});
test("expired, canceled and different-server callbacks cannot exchange", async () => {
  for (const kind of ["time", "cancel", "server"]) {
    const f = fixture();
    await f.client.start();
    if (kind === "time") f.advance(300001);
    else if (kind === "cancel") f.client.cancel();
    else f.server("http://other/api/");
    expect((await f.client.callback(f.callback())).ok).toBe(false);
    expect(f.calls).toHaveLength(1);
  }
});
test("untrusted login URLs never open a browser", async () => {
  const f = fixture();
  f.respond(async () => ({
    ok: true,
    status: 200,
    data: { login_url: `https://other/auth?state=${"s".repeat(64)}` },
  }));
  expect(await f.client.start()).toMatchObject({
    ok: false,
    error: "invalid_response",
  });
  expect(f.opened).toHaveLength(0);
});
test("expired or lost exchanges consume the code and never retry", async () => {
  for (const lost of [true, false]) {
    const f = fixture();
    await f.client.start();
    f.respond(async () => {
      if (lost) throw Error("offline");
      return { ok: false, status: 401, data: {} };
    });
    expect((await f.client.callback(f.callback())).ok).toBe(false);
    expect((await f.client.callback(f.callback())).ok).toBe(false);
    expect(f.calls).toHaveLength(2);
    expect(f.session().token).toBeUndefined();
  }
});
test("logout while exchange is pending prevents a late callback restoring the account", async () => {
  const f = fixture();
  await f.client.start();
  let finish!: (value: { ok: boolean; status: number; data: unknown }) => void;
  f.respond(
    async () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const exchange = f.client.callback(f.callback());
  expect(await f.client.logout()).toEqual({ revoked: true });
  finish({
    ok: true,
    status: 200,
    data: {
      user: f.user,
      access_token: "late",
      token_type: "Bearer",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  expect(await exchange).toMatchObject({ ok: false, error: "canceled" });
  expect(f.session().token).toBeUndefined();
});
test("direct login returns real user and logout clears locally before revoking its captured token", async () => {
  const f = fixture();
  expect((await f.client.login("s@test", "password")).ok).toBe(true);
  f.respond(async (_, options) => {
    expect(f.session().token).toBeUndefined();
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer direct-token",
    );
    return { ok: true, status: 200, data: {} };
  });
  expect(await f.client.logout()).toEqual({ revoked: true });
  expect(f.broadcasts()).toBe(2);
});
test("offline logout reports unconfirmed server revocation but still clears local data", async () => {
  const f = fixture();
  await f.client.login("s@test", "password");
  f.respond(async () => {
    throw Error("offline");
  });
  expect(await f.client.logout()).toEqual({ revoked: false });
  expect(f.session()).toEqual({});
});
test("direct logins superseded by another login cannot overwrite its account", async () => {
  const f = fixture();
  let finish!: (value: { ok: boolean; status: number; data: unknown }) => void;
  f.respond(
    async () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const old = f.client.login("a@test", "old");
  f.respond(async () => ({
    ok: true,
    status: 200,
    data: { data: { user: { ...f.user, id: "other" }, token: "new" } },
  }));
  await f.client.login("b@test", "new");
  finish({
    ok: true,
    status: 200,
    data: { data: { user: f.user, token: "old" } },
  });
  expect((await old).ok).toBe(false);
  expect(f.session().user?.id).toBe("other");
});

test("logout with an unreadable token cannot claim server revocation for a cached account", async () => {
  const f = fixture();
  f.session().user = { ...f.user, role: null };
  expect(await f.client.logout()).toEqual({ revoked: false });
  expect(f.session()).toEqual({});
  expect(f.calls).toHaveLength(0);
});
