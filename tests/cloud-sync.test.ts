import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  CloudSyncClient,
  type CloudTransport,
} from "../electron/service/cloud-sync-client";

const sha = (file: Uint8Array) =>
  createHash("sha256").update(file).digest("hex");
const bytes = (value: string) => new TextEncoder().encode(value);
const document: HighTexDocument = {
  id: "local-a",
  title: "A",
  altTitle: "A en",
  category: "1",
  keywords: { indonesian: ["lokal"], english: ["local"] },
  config: {},
};
const category: Category = {
  id: 1,
  name: "TA",
  variant: "thesis",
  chapters: [],
} as Category;

class Harness {
  credentials: { serverUrl: string; accountId: string; token: string } | null =
    {
      serverUrl: "http://local/api/",
      accountId: "student",
      token: "fixture-token",
    };
  bindings: Record<string, CloudBinding> = {};
  remote: Uint8Array | null = null;
  history = new Map<string, Uint8Array>();
  backups: Uint8Array[] = [];
  writes: RequestInit[] = [];
  override?: CloudTransport["request"];
  allowedCategory: Category | undefined = category;
  transport: CloudTransport = {
    session: () => this.credentials,
    readBindings: () => structuredClone(this.bindings),
    writeBindings: (value) => {
      this.bindings = structuredClone(value);
    },
    backup: async (_session, file) => {
      this.backups.push(new Uint8Array(file));
      return "/fixture/backup.hightex";
    },
    category: async () => this.allowedCategory,
    request: async (endpoint, options = {}) => {
      if (this.override) return this.override(endpoint, options);
      if (endpoint.endsWith("commits"))
        return this.response(
          this.remote
            ? {
                commits: [
                  {
                    id: 1,
                    document_id: "server-doc",
                    sha256: sha(this.remote),
                    type: "current",
                    message: null,
                  },
                ],
              }
            : { commits: [] },
        );
      if (endpoint.includes("pull")) {
        const requested = new URL(`http://local${endpoint}`).searchParams.get(
          "sha256",
        );
        const file = requested ? this.history.get(requested) : this.remote;
        return file
          ? this.response(file, 200, {
              "X-HighTex-SHA256": sha(file),
              "X-Document-ID": "server-doc",
            })
          : this.response({}, 404);
      }
      this.writes.push(options);
      const headers = new Headers(options.headers);
      if (
        this.remote &&
        headers.get("X-HighTex-Base-SHA256") !== sha(this.remote)
      )
        return this.response(
          { error: "conflict", sha256: sha(this.remote) },
          409,
        );
      const file = (options.body as FormData).get("file") as Blob;
      const incoming = new Uint8Array(await file.arrayBuffer());
      expect(headers.get("X-HighTex-SHA256")).toBe(sha(incoming));
      expect(headers.has("X-HighTex-Force")).toBe(false);
      const changed = !this.remote || sha(this.remote) !== sha(incoming);
      if (this.remote) this.history.set(sha(this.remote), this.remote);
      this.remote = incoming;
      return this.response({ changed, sha256: sha(incoming) });
    },
  };
  client = new CloudSyncClient(this.transport);
  response(data: unknown, status = 200, headers: Record<string, string> = {}) {
    return { ok: status < 400, status, data, headers: new Headers(headers) };
  }
  context() {
    return this.client.context();
  }
  input(file = bytes("A")): CloudPushInput {
    return {
      sessionId: this.context().sessionId,
      file,
      document,
      message: "catatan",
      expectedServerDocumentId: this.remote ? "server-doc" : null,
      expectedCloudSha256: this.remote ? sha(this.remote) : null,
      replace: false,
    };
  }
  async bind() {
    const result = await this.client.pull({
      sessionId: this.context().sessionId,
      serverDocumentId: "server-doc",
    });
    if (result.status !== "downloaded") throw new Error("fixture missing");
    return this.client.accept({
      sessionId: result.session.sessionId,
      downloadId: result.downloadId,
      localDocumentId: document.id,
    });
  }
}

test("refreshing commits neither sets nor clears the local base", async () => {
  const h = new Harness();
  h.remote = bytes("A");
  await h.client.list(h.context().sessionId);
  expect(h.bindings).toEqual({});
  await h.bind();
  const saved = structuredClone(h.bindings);
  h.remote = bytes("B");
  await h.client.list(h.context().sessionId);
  expect(h.bindings).toEqual(saved);
  h.remote = null;
  await h.client.list(h.context().sessionId);
  expect(h.bindings).toEqual(saved);
});

test("academic validation failure stops a cloud push before any upload", async () => {
  const h = new Harness();
  h.transport.validatePush = async () => {
    throw new Error("cloud_error:academic_changed");
  };
  await expect(h.client.push(h.input())).rejects.toThrow("academic_changed");
  expect(h.writes).toHaveLength(0);
});

test("cloud academic lock remains discoverable after logout", async () => {
  const h = new Harness();
  h.remote = bytes("A");
  await h.bind();
  h.credentials = null;
  expect(h.client.academicLocked(document.id)).toBe(true);
  expect(h.client.academicLocked("unrelated-local-doc")).toBe(false);
});

test("pull stays unaccepted until local import succeeds; archive can never advance base", async () => {
  const h = new Harness();
  h.remote = bytes("A");
  const sessionId = h.context().sessionId;
  const result = await h.client.pull({
    sessionId,
    serverDocumentId: "server-doc",
  });
  expect(h.bindings).toEqual({});
  if (result.status !== "downloaded") throw new Error();
  h.client.accept({
    sessionId,
    downloadId: result.downloadId,
    localDocumentId: document.id,
  });
  const before = structuredClone(h.bindings);
  h.history.set(sha(bytes("old")), bytes("old"));
  const archive = await h.client.pull({
    sessionId,
    serverDocumentId: "server-doc",
    sha256: sha(bytes("old")),
  });
  if (archive.status !== "downloaded") throw new Error();
  expect(() =>
    h.client.accept({
      sessionId,
      downloadId: archive.downloadId,
      localDocumentId: document.id,
    }),
  ).toThrow("invalid_download");
  expect(h.bindings).toEqual(before);
});

test("A base survives viewing B: push sends A and receives conflict without retry", async () => {
  const h = new Harness();
  h.remote = bytes("A");
  await h.bind();
  const saved = structuredClone(h.bindings);
  h.remote = bytes("B");
  await h.client.list(h.context().sessionId);
  const result = await h.client.push(h.input(bytes("local edit")));
  expect(result.status).toBe("conflict");
  expect(h.writes.length).toBe(1);
  expect(new Headers(h.writes[0].headers).get("X-HighTex-Base-SHA256")).toBe(
    sha(bytes("A")),
  );
  expect(h.bindings).toEqual(saved);
  expect(h.remote).toEqual(bytes("B"));
});

test("successful push hashes full bytes, persists its confirmed base and detects identical artifact", async () => {
  const h = new Harness();
  const file = bytes("ZIP including photo and images");
  expect(await h.client.push(h.input(file))).toMatchObject({
    status: "saved",
    changed: true,
    sha256: sha(file),
  });
  expect(h.client.binding(h.context().sessionId, document.id)?.baseSha256).toBe(
    sha(file),
  );
  expect(await h.client.push(h.input(file))).toMatchObject({
    status: "saved",
    changed: false,
  });
});

test("unlinked existing cloud requires explicit replacement and a backup before upload", async () => {
  const h = new Harness();
  h.remote = bytes("previous student version");
  const previous = new Uint8Array(h.remote);
  await expect(h.client.push(h.input())).rejects.toThrow(
    "replacement_required",
  );
  expect(h.writes).toHaveLength(0);
  await expect(
    h.client.push({
      ...h.input(),
      replace: true,
      expectedCloudSha256: sha(bytes("stale")),
    }),
  ).rejects.toThrow("replacement_required");
  expect((await h.client.push({ ...h.input(), replace: true })).status).toBe(
    "saved",
  );
  expect(h.backups).toEqual([previous]);
});

test("backup failure prevents replacement upload", async () => {
  const h = new Harness();
  h.remote = bytes("A");
  h.transport.backup = async () => {
    throw new Error("disk full");
  };
  await expect(h.client.push({ ...h.input(), replace: true })).rejects.toThrow(
    "disk full",
  );
  expect(h.writes).toHaveLength(0);
});

test("binding is scoped by local document, account and server; token changes invalidate pending operations", async () => {
  const h = new Harness();
  h.remote = bytes("A");
  await h.bind();
  const old = h.context();
  expect(h.client.binding(old.sessionId, "local-b")).toBeNull();
  h.credentials = { ...h.credentials!, accountId: "other" };
  expect(h.client.binding(h.context().sessionId, document.id)).toBeNull();
  h.credentials = {
    ...h.credentials!,
    accountId: "student",
    serverUrl: "http://other/api/",
  };
  expect(h.client.binding(h.context().sessionId, document.id)).toBeNull();
  h.credentials = {
    ...h.credentials!,
    serverUrl: old.serverUrl,
    token: "new-token",
  };
  expect(h.client.binding(h.context().sessionId, document.id)?.baseSha256).toBe(
    sha(bytes("A")),
  );
  await expect(h.client.list(old.sessionId)).rejects.toThrow("session_changed");
});

test("late push response after logout cannot create a binding", async () => {
  const h = new Harness();
  const original = h.transport.request;
  h.override = async (endpoint, options) => {
    h.override = undefined;
    const response = await original(endpoint, options);
    if (endpoint.endsWith("push")) h.credentials = null;
    else
      h.override = async (target, request) => {
        h.override = undefined;
        const result = await original(target, request);
        if (target.endsWith("push")) h.credentials = null;
        return result;
      };
    return response;
  };
  await expect(h.client.push(h.input())).rejects.toThrow("not_authenticated");
  expect(h.bindings).toEqual({});
});

test("bad hash, missing/mismatched document headers and incorrect requested archive are rejected", async () => {
  for (const headers of [
    {},
    { "X-Document-ID": "other", "X-HighTex-SHA256": sha(bytes("A")) },
    { "X-Document-ID": "server-doc", "X-HighTex-SHA256": sha(bytes("wrong")) },
  ] as Record<string, string>[]) {
    const h = new Harness();
    h.override = async () => h.response(bytes("A"), 200, headers);
    await expect(
      h.client.pull({
        sessionId: h.context().sessionId,
        serverDocumentId: "server-doc",
      }),
    ).rejects.toThrow("cloud_error:");
    expect(h.bindings).toEqual({});
  }
});

test("server error, unknown category and KP never create a base or bypass service policy", async () => {
  const h = new Harness();
  h.allowedCategory = { ...category, variant: "intern" };
  await expect(h.client.push(h.input())).rejects.toThrow("kp_unsupported");
  expect(h.writes).toHaveLength(0);
  h.allowedCategory = undefined;
  await expect(h.client.push(h.input())).rejects.toThrow("unknown_category");
  h.allowedCategory = category;
  h.override = async () => h.response({}, 403);
  await expect(h.client.push(h.input())).rejects.toThrow("http_403");
  expect(h.bindings).toEqual({});
});
