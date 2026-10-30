// Opt-in: local demo HTTP flow; no OS/browser registration or persisted tokens.
import assert from "node:assert/strict";
import { AuthClient } from "../../electron/service/auth-client";
import { accountRequest } from "../../electron/service/account-transport";
import { ServerUrl } from "../../electron/url/server-url";
const server = ServerUrl.instance;
const base = server.api.href;
let pending: PendingBrowserLogin | undefined;
let session: { user?: User; token?: string } = {};
let loginURL = "";
const client = new AuthClient({
  serverUrl: () => base,
  request: accountRequest,
  session: () => session,
  save: (user, token) => {
    session = { user, token };
  },
  clear: () => {
    session = {};
  },
  pending: () => pending,
  setPending: (value) => {
    pending = value;
  },
  broadcast: async () => {},
  open: async (url) => {
    loginURL = url;
  },
});
const jar = new Map<string, string>();
const web = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, {
    ...options,
    redirect: "manual",
    headers: {
      ...Object.fromEntries(new Headers(options.headers)),
      Cookie: Array.from(jar, ([key, value]) => `${key}=${value}`).join("; "),
    },
  });
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
  return response;
};
try {
  assert.equal((await client.start()).ok, true);
  const page = await web(server.resolve("/login").href);
  const html = await page.text();
  const csrf = /name="csrf-token"\s+content="([^"]+)"/.exec(html)?.[1];
  const login = await web(server.resolve("/login").href, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "X-XSRF-TOKEN": decodeURIComponent(jar.get("XSRF-TOKEN") ?? ""),
    },
    body: new URLSearchParams({
      email: "12250314612@students.uin-suska.ac.id",
      password: "jepiokta123",
      ...(csrf ? { _token: csrf } : {}),
    }),
  });
  assert.equal(
    [200, 204, 302, 303].includes(login.status),
    true,
    `Web login HTTP ${login.status}`,
  );
  const authorized = await web(loginURL);
  assert.equal(authorized.status, 302);
  const callback = authorized.headers.get("Location") ?? "";
  assert.equal(callback.startsWith("hightex://auth/callback?"), true);
  const result = await client.callback(callback);
  assert.equal(result.ok, true);
  const token = session.token!;
  const me = await accountRequest(base, "/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(me.ok, true);
  assert.equal((await client.callback(callback)).ok, false);
  assert.deepEqual(await client.logout(), { revoked: true });
  const revoked = await accountRequest(base, "/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(revoked.status, 401);
  console.log(
    JSON.stringify({
      browserAuthHTTP: "passed",
      startAuthorizeExchange: true,
      replayRejected: true,
      serverTokenRevoked: true,
      tokensPersisted: false,
    }),
  );
} finally {
  if (session.token) await client.logout();
  if (jar.size)
    await web(server.resolve("/logout").href, {
      method: "POST",
      headers: {
        "X-XSRF-TOKEN": decodeURIComponent(jar.get("XSRF-TOKEN") ?? ""),
        Accept: "application/json",
      },
    }).catch(() => {});
}
