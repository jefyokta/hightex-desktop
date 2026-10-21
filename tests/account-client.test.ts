import { expect, test } from "bun:test";
import { AccountClient } from "../electron/service/account-client";
const fixture = () => {
  let session: ReviewSession = {
    accountId: "12",
    sessionId: "session-a",
    serverUrl: "http://local/api/",
  };
  let user = {
    id: 12,
    name: "Student",
    identity_number: "A001",
    email: "student@test",
    roles: [],
    cv: "<p>Old CV</p>",
    picture: null as { path: string } | null,
  };
  const calls: { path: string; options?: RequestInit }[] = [];
  let responder:
    | ((
        path: string,
        options?: RequestInit,
      ) => Promise<{ ok: boolean; status: number; data: unknown }>)
    | undefined;
  const accepted: User[] = [],
    images: string[] = [],
    opened: string[] = [];
  const client = new AccountClient({
    open: async (url) => {
      opened.push(url);
    },
    context: () => ({ ok: true, data: session }),
    request: async (path, options) => {
      calls.push({ path, options });
      if (responder) return responder(path, options);
      if (options?.body instanceof FormData) {
        const cv = options.body.get("cv");
        if (typeof cv === "string") user = { ...user, cv };
      }
      return { ok: true, status: 200, data: { message: user } };
    },
    image: async (url) => {
      images.push(url);
      return { ok: true, type: "image/webp", bytes: new Uint8Array([1, 2]) };
    },
    accept: async (user) => {
      accepted.push(user);
    },
  });
  return {
    client,
    calls,
    accepted,
    images,
    opened,
    session: () => session,
    user: () => user,
    setUser: (next: typeof user) => {
      user = next;
    },
    switch: () => {
      session = { ...session, accountId: "24", sessionId: "session-b" };
    },
    respond: (next: NonNullable<typeof responder>) => {
      responder = next;
    },
  };
};
test("account reads the canonical owner and update sends only explicitly changed multipart fields", async () => {
  const f = fixture();
  expect((await f.client.load()).ok).toBe(true);
  expect((await f.client.update({ sessionId: "session-a", cv: "" })).ok).toBe(
    true,
  );
  const body = f.calls[1].options?.body as FormData;
  expect(body.get("cv")).toBe("");
  expect(body.has("image")).toBe(false);
  expect(f.accepted[0].id).toBe("12");
});
test("photo-only updates do not clear CV and preserve original image bytes", async () => {
  const f = fixture();
  const bytes = new Uint8Array([1, 2, 3]);
  expect(
    (
      await f.client.update({
        sessionId: "session-a",
        image: { bytes, type: "image/png", name: "photo.png" },
      })
    ).ok,
  ).toBe(true);
  const body = f.calls[0].options?.body as FormData;
  expect(body.has("cv")).toBe(false);
  expect(
    new Uint8Array(await (body.get("image") as File).arrayBuffer()),
  ).toEqual(bytes);
});
test("invalid image types and oversized files never reach the server", async () => {
  const f = fixture();
  for (const image of [
    { bytes: new Uint8Array(3), type: "image/svg+xml", name: "a.svg" },
    {
      bytes: new Uint8Array(2 * 1024 * 1024 + 1),
      type: "image/png",
      name: "a.png",
    },
  ])
    expect(
      await f.client.update({ sessionId: "session-a", image }),
    ).toMatchObject({ ok: false, error: "invalid_image" });
  expect(f.calls).toHaveLength(0);
});
test("validation errors retain per-field messages without claiming a successful update", async () => {
  const f = fixture();
  f.respond(async () => ({
    ok: false,
    status: 422,
    data: {
      errors: {
        image: ["Invalid image"],
        cv: ["Invalid CV"],
        unrelated: "malformed",
      },
    },
  }));
  expect(
    await f.client.update({ sessionId: "session-a", cv: "test" }),
  ).toMatchObject({
    ok: false,
    error: "validation",
    fields: { image: ["Invalid image"], cv: ["Invalid CV"] },
  });
  expect(f.accepted).toHaveLength(0);
});
test("account changes after an update cannot cache or broadcast the previous owner", async () => {
  const f = fixture();
  f.respond(async () => {
    f.switch();
    return { ok: true, status: 200, data: { message: f.user() } };
  });
  expect(
    await f.client.update({ sessionId: "session-a", cv: "text" }),
  ).toMatchObject({ ok: false, error: "session_changed" });
  expect(f.accepted).toHaveLength(0);
});
test("profile pictures are fetched from the current server storage and foreign paths are rejected", async () => {
  const f = fixture();
  f.setUser({
    ...f.user(),
    picture: { path: "profile-pictures/profile-12.webp" },
  });
  await f.client.load();
  expect((await f.client.picture("session-a")).ok).toBe(true);
  expect(f.images).toEqual([
    "http://local/storage/profile-pictures/profile-12.webp",
  ]);
  f.setUser({ ...f.user(), picture: { path: "https://foreign/image.png" } });
  expect((await f.client.load()).ok).toBe(false);
  f.switch();
  expect((await f.client.picture("session-a")).ok).toBe(false);
  expect(f.images).toHaveLength(1);
});
test("a lost profile response reports unknown outcome and performs no automatic retry", async () => {
  const f = fixture();
  f.respond(async () => {
    throw Error("timeout");
  });
  expect(
    await f.client.update({ sessionId: "session-a", cv: "new" }),
  ).toMatchObject({ ok: false, error: "outcome_unknown" });
  expect(f.calls).toHaveLength(1);
});

test("web profile settings use the current account server and reject stale sessions", async () => {
  const f = fixture();
  expect((await f.client.settings("session-a")).ok).toBe(true);
  expect(f.opened).toEqual(["http://local/profile/update"]);
  f.switch();
  expect((await f.client.settings("session-a")).ok).toBe(false);
  expect(f.opened).toHaveLength(1);
});
