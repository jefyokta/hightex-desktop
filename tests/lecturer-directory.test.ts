import { expect, test } from "bun:test";
import {
  LecturerDirectoryClient,
  parseLecturerDirectory,
  DIRECTORY_REFRESH_MS,
} from "../electron/service/lecturer-directory-client";
import seed from "../src/assets/data/lecturer-directory.json";

const source = "https://directory.example/api/";
const first = {
  schema_version: 1 as const,
  version: "a".repeat(64),
  data: [{ id: "1", name: "Original Lecturer", nip: "000123" }],
};
function fixture() {
  let now = Date.UTC(2026, 10, 3),
    origin = source;
  const saved = new Map<string, unknown>();
  const requests: (string | null)[] = [];
  let respond: (
    etag: string | null,
  ) => Promise<{ status: number; body?: unknown }> = async () => {
    throw Error("Offline");
  };
  const client = new LecturerDirectoryClient({
    source: () => origin,
    seed: { ...first, source },
    now: () => now,
    read: (s) => saved.get(s),
    write: (s, data) => saved.set(s, structuredClone(data)),
    request: async (_s, etag) => {
      requests.push(etag);
      return respond(etag);
    },
  });
  return {
    client,
    saved,
    requests,
    respond: (fn: typeof respond) => {
      respond = fn;
    },
    advance: (ms: number) => {
      now += ms;
    },
    origin: (value: string) => {
      origin = value;
    },
  };
}

test("bundled installer snapshot has valid public fields, literal NIPs and source scope", () => {
  expect(parseLecturerDirectory(seed).data.length).toBeGreaterThan(0);
  expect(new URL(seed.source).pathname).toBe("/api/");
  expect(
    seed.data.every(
      (row) => Object.keys(row).sort().join(",") === "id,name,nip",
    ),
  ).toBe(true);
});
test("first launch works offline from the installer and a failed refresh leaves it usable", async () => {
  const f = fixture();
  expect(f.client.cached()).toMatchObject({
    data: first.data,
    fromSeed: true,
    checkedAt: null,
  });
  expect(f.requests).toEqual([]);
  expect(await f.client.refresh()).toMatchObject({
    data: first.data,
    error: "network",
    fromSeed: true,
  });
  expect(f.saved.size).toBe(0);
  expect(f.client.cached().data[0].nip).toBe("000123");
});
test("conditional refresh persists 304 and avoids polling until stale, with explicit refresh available", async () => {
  const f = fixture();
  f.respond(async () => ({ status: 304 }));
  expect((await f.client.refresh()).fromSeed).toBe(false);
  expect(f.requests).toEqual([`"${first.version}"`]);
  await f.client.refresh();
  expect(f.requests.length).toBe(1);
  f.advance(DIRECTORY_REFRESH_MS + 1);
  await f.client.refresh();
  expect(f.requests.length).toBe(2);
  await f.client.refresh(true);
  expect(f.requests.length).toBe(3);
});
test("complete validated snapshots atomically replace additions, corrections and removals", async () => {
  const f = fixture();
  const next = {
    ...first,
    version: "b".repeat(64),
    data: [{ id: "2", name: "Corrected Lecturer", nip: "000999" }],
  };
  f.respond(async () => ({ status: 200, body: next }));
  expect((await f.client.refresh()).data).toEqual(next.data);
  expect(f.client.cached().data).toEqual(next.data);
  expect(first.data[0].name).toBe("Original Lecturer");
  f.respond(async () => ({
    status: 200,
    body: { ...next, version: "c".repeat(64), data: [] },
  }));
  expect((await f.client.refresh(true)).data).toEqual([]);
  expect(f.client.cached().data).toEqual([]); // Never restore removed people from the seed.
});
test("malformed responses and HTTP failures never damage a previous snapshot", async () => {
  const f = fixture();
  f.respond(async () => ({ status: 304 }));
  await f.client.refresh();
  const saved = structuredClone(f.saved.get(source));
  for (const body of [
    { ...first, data: [...first.data, ...first.data] },
    { ...first, data: [{ id: "1", name: "Name", nip: 123 }] },
    { ...first, schema_version: 2 },
  ]) {
    f.respond(async () => ({ status: 200, body }));
    expect((await f.client.refresh(true)).error).toBe("invalid");
    expect(f.saved.get(source)).toEqual(saved);
  }
  f.respond(async () => ({ status: 503 }));
  expect((await f.client.refresh(true)).data).toEqual(first.data);
});
test("overlapping refreshes share a request and a changed server cannot receive another server's result", async () => {
  const f = fixture();
  let complete!: (value: { status: number; body?: unknown }) => void;
  f.respond(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const a = f.client.refresh(true),
    b = f.client.refresh(true);
  expect(a).toBe(b);
  expect(f.requests.length).toBe(1);
  f.origin("https://other.example/api/");
  complete({ status: 200, body: first });
  expect((await a).data).toEqual([]);
  expect(f.saved.size).toBe(0);
  expect(f.client.cached().source).toBe("https://other.example/api/");
});
test("corrupted cache falls back to the bundled snapshot and malformed payloads fail closed", () => {
  const f = fixture();
  f.saved.set(source, { source, version: "wrong", data: [] });
  expect(f.client.cached().data).toEqual(first.data);
  for (const value of [
    null,
    [],
    {},
    { ...first, data: [{ id: "", name: "X", nip: "1" }] },
  ])
    expect(() => parseLecturerDirectory(value)).toThrow();
  const parsed = parseLecturerDirectory({
    ...first,
    data: [
      { ...first.data[0], email: "private@example.test", token: "private" },
    ],
  });
  expect(parsed.data[0]).toEqual(first.data[0]);
});
