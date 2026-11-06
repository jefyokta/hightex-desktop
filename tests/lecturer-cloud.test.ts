import { expect, test } from "bun:test";
import { LocalLecturerDirectory } from "../electron/directory/lecturer-directory";
import {
  LecturerCloudClient,
  parseCloudLecturers,
  type LecturerCloudSession,
} from "../electron/clients/lecturer-cloud-client";

const payload = (
  data: unknown[] = [{ id: "12", name: "Cloud Lecturer", nip: "000123" }],
) => ({
  schema_version: 1,
  version: "a".repeat(64),
  data,
});
function fixture() {
  let saved: LecturerDirectoryEntry[] = [];
  let id = 0;
  let session: LecturerCloudSession | null = {
    sessionId: "session-a",
    serverUrl: "https://faculty.example/api/",
    accountId: "student-a",
    token: "secret-a",
  };
  let failWrite = false;
  let calls = 0,
    expired = 0;
  const directory = new LocalLecturerDirectory({
    read: () => structuredClone(saved),
    save: (row) => {
      saved = [
        ...saved.filter((entry) => entry.id !== row.id),
        structuredClone(row),
      ];
    },
    remove: (id) => {
      saved = saved.filter((row) => row.id !== id);
    },
    insert: (rows) => {
      if (failWrite) throw Error("Disk full");
      saved = [...saved, ...structuredClone(rows)];
    },
    createId: () => String(++id),
  });
  let response: (
    session: LecturerCloudSession,
  ) => Promise<{ status: number; data?: unknown }> = async () => ({
    status: 200,
    data: payload(),
  });
  const client = new LecturerCloudClient(directory, {
    session: () => session,
    request: async (s) => {
      calls++;
      return response(s);
    },
    unauthenticated: () => {
      expired++;
      session = null;
    },
  });
  return {
    client,
    directory,
    session: () => session,
    setSession: (next: LecturerCloudSession | null) => {
      session = next;
    },
    respond: (next: typeof response) => {
      response = next;
    },
    failWrites: () => {
      failWrite = true;
    },
    calls: () => calls,
    expired: () => expired,
  };
}

test("no cloud request occurs without explicit fetch or without authentication", async () => {
  const f = fixture();
  f.directory.list();
  expect(f.calls()).toBe(0);
  f.setSession(null);
  expect(await f.client.fetch()).toEqual({
    ok: false,
    error: "not_authenticated",
  });
  expect(f.calls()).toBe(0);
});

test("authenticated fetch stores only local identity fields and server provenance", async () => {
  const f = fixture();
  f.respond(async (session) => {
    expect(session.token).toBe("secret-a");
    return {
      status: 200,
      data: payload([
        {
          id: "12",
          name: "Cloud Lecturer",
          nip: "000123",
          email: "private@example.test",
          token: "secret",
          source: { type: "manual" },
        },
      ]),
    };
  });
  const result = await f.client.fetch();
  expect(result).toMatchObject({ ok: true, result: { added: 1, skipped: 0 } });
  expect(f.directory.list().data).toEqual([
    {
      id: "local:1",
      name: "Cloud Lecturer",
      nip: "000123",
      source: { type: "cloud", url: "https://faculty.example/api/lecturers" },
    },
  ]);
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(JSON.stringify(result)).not.toContain("private@example");
});

test("cloud downloads append without overwriting manual/file data, or recorded documents", async () => {
  const f = fixture();
  const manual = f.directory.save({
    name: "Local corrected name",
    nip: "000123",
  }).entry;
  const file = f.directory.import(
    [{ name: "Imported", nip: "000456" }],
    "faculty.json",
  ).data[1];
  const document = { advisorName: manual.name, advisorNip: manual.nip };
  f.respond(async () => ({
    status: 200,
    data: payload([
      { id: "12", name: "Old name", nip: "000123" },
      { id: "13", name: "Imported old name", nip: "000456" },
      { id: "14", name: "New cloud", nip: "000789" },
      { id: "15", name: "Repeated NIP", nip: "000789" },
    ]),
  }));
  expect(await f.client.fetch()).toMatchObject({
    ok: true,
    result: { added: 1, skipped: 3 },
  });
  expect(f.directory.list().data.slice(0, 2)).toEqual([manual, file]);
  expect(document).toEqual({
    advisorName: "Local corrected name",
    advisorNip: "000123",
  });
  expect(await f.client.fetch()).toMatchObject({
    ok: true,
    result: { added: 0, skipped: 4 },
  });
  f.setSession(null);
  expect(f.directory.list().data).toHaveLength(3);
});

test("401 invalidates the failed session, 403 preserves it, and neither removes saved entries", async () => {
  for (const status of [401, 403, 500, 429]) {
    const f = fixture();
    f.directory.save({ name: "Saved", nip: "001" });
    f.respond(async () => ({ status }));
    expect(await f.client.fetch()).toEqual({
      ok: false,
      error:
        status === 401
          ? "not_authenticated"
          : status === 403
            ? "forbidden"
            : "network",
    });
    expect(f.expired()).toBe(status === 401 ? 1 : 0);
    expect(f.directory.list().data).toHaveLength(1);
  }
});

test("logout, account, server and token switches reject in-flight results before storing anything", async () => {
  for (const change of ["logout", "account", "server", "token", "session"]) {
    const f = fixture();
    let done!: (response: { status: number; data: unknown }) => void;
    f.respond(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const job = f.client.fetch();
    const original = f.session()!;
    f.setSession(
      change === "logout"
        ? null
        : {
            ...original,
            ...(change === "account" ? { accountId: "other" } : {}),
            ...(change === "server"
              ? { serverUrl: "https://other.example/api/" }
              : {}),
            ...(change === "token" ? { token: "new-token" } : {}),
            ...(change === "session" ? { sessionId: "new-session" } : {}),
          },
    );
    done({ status: 200, data: payload() });
    expect(await job).toEqual({ ok: false, error: "session_changed" });
    expect(f.directory.list().data).toEqual([]);
  }
});

test("a late 401 cannot invalidate a newer account session", async () => {
  const f = fixture();
  let done!: (response: { status: number }) => void;
  f.respond(
    () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  );
  const job = f.client.fetch();
  f.setSession({
    ...f.session()!,
    sessionId: "new-session",
    accountId: "new-user",
    token: "new-token",
  });
  done({ status: 401 });
  expect(await job).toEqual({ ok: false, error: "session_changed" });
  expect(f.expired()).toBe(0);
});

test("overlapping fetches share one authenticated request", async () => {
  const f = fixture();
  let done!: (response: { status: number; data: unknown }) => void;
  f.respond(
    () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  );
  const a = f.client.fetch(),
    b = f.client.fetch();
  expect(a).toBe(b);
  expect(f.calls()).toBe(1);
  done({ status: 200, data: payload() });
  expect(await a).toMatchObject({ ok: true });
});

test("invalid payloads, missing NIPs and disk failures cannot damage the saved directory", async () => {
  const f = fixture();
  f.directory.save({ name: "Saved", nip: "001" });
  const previous = f.directory.list();
  for (const data of [
    null,
    [],
    { data: [] },
    { ...payload(), schema_version: 2 },
    payload([{ id: "12", name: "No NIP", nip: "" }]),
    payload([{ id: "12", name: "Numeric NIP", nip: 123 }]),
    payload([
      { id: "12", name: "One", nip: "001" },
      { id: "12", name: "Two", nip: "002" },
    ]),
  ]) {
    f.respond(async () => ({ status: 200, data }));
    expect(await f.client.fetch()).toEqual({
      ok: false,
      error: "invalid_response",
    });
    expect(f.directory.list()).toEqual(previous);
  }
  f.respond(async () => {
    throw Error("Offline");
  });
  expect(await f.client.fetch()).toEqual({ ok: false, error: "network" });
  f.failWrites();
  f.respond(async () => ({ status: 200, data: payload() }));
  expect(await f.client.fetch()).toEqual({ ok: false, error: "storage" });
  expect(f.directory.list()).toEqual(previous);
});

test("a legitimate empty cloud directory leaves saved entries intact", async () => {
  const f = fixture();
  f.directory.save({ name: "Saved", nip: "001" });
  f.respond(async () => ({ status: 200, data: payload([]) }));
  expect(await f.client.fetch()).toMatchObject({
    ok: true,
    result: { added: 0, skipped: 0 },
  });
  expect(f.directory.list().data).toHaveLength(1);
  expect(parseCloudLecturers(payload([]))).toEqual([]);
});
