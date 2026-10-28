import { CloudError } from "../electron/exception/cloud-error";
import { expect, test } from "bun:test";
import { strToU8, zipSync, unzipSync } from "fflate";
import { contentFingerprint } from "../src/utils/htx/content-fingerprint";
import { createHash } from "node:crypto";
import {
  CloudSyncClient,
  type CloudTransport,
} from "../electron/service/cloud-sync-client";

const byteSha = (file: Uint8Array) =>
  createHash("sha256").update(file).digest("hex");
const sha = contentFingerprint;
const bytes = (value: string) =>
  zipSync(
    {
      "manifest.json": strToU8(
        JSON.stringify({
          version: 2,
          format: "json",
          document: { id: "fixture" },
        }),
      ),
      "files/chapters/1.json": strToU8(
        JSON.stringify([
          { type: "paragraph", content: [{ type: "text", text: value }] },
        ]),
      ),
    },
    { mtime: new Date(1980, 0, 1) },
  );
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
  remoteSha?: string;
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
                    sha256: this.remoteSha ?? (await sha(this.remote)),
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
              "X-HighTex-SHA256":
                requested ?? this.remoteSha ?? (await sha(file)),
              "X-Document-ID": "server-doc",
            })
          : this.response({}, 404);
      }
      this.writes.push(options);
      const headers = new Headers(options.headers);
      if (
        this.remote &&
        headers.get("X-HighTex-Force") !== "true" &&
        headers.get("X-HighTex-Base-SHA256") !==
          (this.remoteSha ?? (await sha(this.remote)))
      )
        return this.response(
          { error: "conflict", sha256: await sha(this.remote) },
          409,
        );
      const file = (options.body as FormData).get("file") as Blob;
      const incoming = new Uint8Array(await file.arrayBuffer());
      expect(headers.get("X-HighTex-SHA256")).toBe(
        await contentFingerprint(incoming),
      );
      const before = this.remote
        ? (this.remoteSha ?? (await sha(this.remote)))
        : null;
      const changed = before !== (await sha(incoming));
      if (changed) {
        if (this.remote)
          this.history.set(
            this.remoteSha ?? (await sha(this.remote)),
            this.remote,
          );
        this.remote = incoming;
        this.remoteSha = undefined;
      }
      return this.response({ changed, sha256: await sha(incoming) });
    },
  };
  client = new CloudSyncClient(this.transport);
  response(data: unknown, status = 200, headers: Record<string, string> = {}) {
    return { ok: status < 400, status, data, headers: new Headers(headers) };
  }
  context() {
    return this.client.context();
  }
  async input(file = bytes("A")): Promise<CloudPushInput> {
    return {
      sessionId: this.context().sessionId,
      file,
      document,
      message: "catatan",
      expectedServerDocumentId: this.remote ? "server-doc" : null,
      expectedCloudSha256: this.remote
        ? (this.remoteSha ?? (await sha(this.remote)))
        : null,
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
  await expect(h.client.push(await h.input())).rejects.toThrow(
    "academic_changed",
  );
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
  h.history.set(await sha(bytes("old")), bytes("old"));
  const archive = await h.client.pull({
    sessionId,
    serverDocumentId: "server-doc",
    sha256: await sha(bytes("old")),
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
  const result = await h.client.push(await h.input(bytes("local edit")));
  expect(result.status).toBe("conflict");
  expect(h.writes.length).toBe(1);
  expect(new Headers(h.writes[0].headers).get("X-HighTex-Base-SHA256")).toBe(
    await sha(bytes("A")),
  );
  expect(h.bindings).toEqual(saved);
  expect(h.remote).toEqual(bytes("B"));
  expect(new Headers(h.writes[0].headers).has("X-HighTex-Force")).toBe(false);
});

test("explicit force push backs up the observed cloud before overwriting a stale linked base", async () => {
  const h = new Harness();
  h.remote = bytes("base A");
  await h.bind();
  h.remote = bytes("cloud B");
  const result = await h.client.push({
    ...(await h.input(bytes("local C"))),
    force: true,
  });
  expect(result.status).toBe("saved");
  expect(h.backups).toEqual([bytes("cloud B")]);
  expect(h.history.get(await sha(bytes("cloud B")))).toEqual(bytes("cloud B"));
  expect(new Headers(h.writes[0].headers).get("X-HighTex-Force")).toBe("true");
  expect(new Headers(h.writes[0].headers).get("X-HighTex-Base-SHA256")).toBe(
    await sha(bytes("base A")),
  );
  expect(h.client.binding(h.context().sessionId, document.id)?.baseSha256).toBe(
    await sha(bytes("local C")),
  );
});

test("force push cannot overwrite a cloud version that changed since confirmation", async () => {
  const h = new Harness();
  h.remote = bytes("A");
  await h.bind();
  const input = { ...(await h.input(bytes("local"))), force: true };
  h.remote = bytes("unseen B");
  await expect(h.client.push(input)).rejects.toThrow("cloud_changed");
  expect(h.writes).toHaveLength(0);
  expect(h.backups).toHaveLength(0);
});

test("force push stops when backup fails or downloaded cloud bytes changed", async () => {
  for (const failure of ["backup", "changed"]) {
    const h = new Harness();
    h.remote = bytes("A");
    await h.bind();
    const binding = structuredClone(h.bindings);
    if (failure === "backup")
      h.transport.backup = async () => {
        throw new Error("disk full");
      };
    else {
      const request = h.transport.request;
      h.transport.request = async (endpoint, options) => {
        if (endpoint.includes("pull"))
          h.remote = bytes("changed during download");
        return request(endpoint, options);
      };
    }
    await expect(
      h.client.push({ ...(await h.input(bytes("local"))), force: true }),
    ).rejects.toThrow();
    expect(h.writes).toHaveLength(0);
    expect(h.bindings).toEqual(binding);
  }
});

test("force push cannot bypass replacement consent, category or academic validation", async () => {
  const h = new Harness();
  h.remote = bytes("A");
  await expect(
    h.client.push({ ...(await h.input()), force: true }),
  ).rejects.toThrow("replacement_required");
  await h.bind();
  h.allowedCategory = { ...category, variant: "intern" };
  await expect(
    h.client.push({ ...(await h.input()), force: true }),
  ).rejects.toThrow("kp_unsupported");
  h.allowedCategory = category;
  h.transport.validatePush = async () => {
    throw new Error("cloud_error:academic_changed");
  };
  await expect(
    h.client.push({ ...(await h.input()), force: true }),
  ).rejects.toThrow("academic_changed");
  expect(h.writes).toHaveLength(0);
});

test("successful push fingerprints imported content, persists its confirmed base and detects identical content", async () => {
  const h = new Harness();
  const file = bytes("ZIP including photo and images");
  expect(await h.client.push(await h.input(file))).toMatchObject({
    status: "saved",
    changed: true,
    sha256: await sha(file),
  });
  expect(h.client.binding(h.context().sessionId, document.id)?.baseSha256).toBe(
    await sha(file),
  );
  expect(await h.client.push(await h.input(file))).toMatchObject({
    status: "saved",
    changed: false,
  });
});

test("unlinked existing cloud requires explicit replacement and a backup before upload", async () => {
  const h = new Harness();
  h.remote = bytes("previous student version");
  const previous = new Uint8Array(h.remote);
  await expect(h.client.push(await h.input())).rejects.toThrow(
    "replacement_required",
  );
  expect(h.writes).toHaveLength(0);
  await expect(
    h.client.push({
      ...(await h.input()),
      replace: true,
      expectedCloudSha256: await sha(bytes("stale")),
    }),
  ).rejects.toThrow("replacement_required");
  expect(
    (await h.client.push({ ...(await h.input()), replace: true })).status,
  ).toBe("saved");
  expect(h.backups).toEqual([previous]);
});

test("backup failure prevents replacement upload", async () => {
  const h = new Harness();
  h.remote = bytes("A");
  h.transport.backup = async () => {
    throw new Error("disk full");
  };
  await expect(
    h.client.push({ ...(await h.input()), replace: true }),
  ).rejects.toThrow("disk full");
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
    await sha(bytes("A")),
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
  await expect(h.client.push(await h.input())).rejects.toThrow(
    "not_authenticated",
  );
  expect(h.bindings).toEqual({});
});

test("bad hash, missing/mismatched document headers and incorrect requested archive are rejected", async () => {
  for (const headers of [
    {},
    { "X-Document-ID": "other", "X-HighTex-SHA256": await sha(bytes("A")) },
    {
      "X-Document-ID": "server-doc",
      "X-HighTex-SHA256": await sha(bytes("wrong")),
    },
  ] as Record<string, string>[]) {
    const h = new Harness();
    h.override = async () => h.response(bytes("A"), 200, headers);
    await expect(
      h.client.pull({
        sessionId: h.context().sessionId,
        serverDocumentId: "server-doc",
      }),
    ).rejects.toBeInstanceOf(CloudError);
    expect(h.bindings).toEqual({});
  }
});

test("server error, unknown category and KP never create a base or bypass service policy", async () => {
  const h = new Harness();
  h.allowedCategory = { ...category, variant: "intern" };
  await expect(h.client.push(await h.input())).rejects.toThrow(
    "kp_unsupported",
  );
  expect(h.writes).toHaveLength(0);
  h.allowedCategory = undefined;
  await expect(h.client.push(await h.input())).rejects.toThrow(
    "unknown_category",
  );
  h.allowedCategory = category;
  h.override = async () => h.response({}, 403);
  await expect(h.client.push(await h.input())).rejects.toThrow("http_403");
  expect(h.bindings).toEqual({});
});

test("profile/context changes and repacking do not create a different cloud content hash", async () => {
  const h = new Harness();
  const original = bytes("Content stays the same");
  const saved = await h.client.push(await h.input(original));
  expect(saved.status).toBe("saved");
  const entries = unzipSync(original);
  entries["files/profile.json"] = strToU8(
    JSON.stringify({ name: "New profile", nim: "123" }),
  );
  entries["files/assets/profile.webp"] = strToU8("new photo");
  entries["meta/export.json"] = strToU8(
    JSON.stringify({ timestamp: Date.now() }),
  );
  const repacked = zipSync(
    Object.fromEntries(Object.entries(entries).reverse()),
    { level: 0, mtime: new Date(2025, 0, 1) },
  );
  expect(byteSha(repacked)).not.toBe(byteSha(original));
  expect(await h.client.push(await h.input(repacked))).toMatchObject({
    status: "saved",
    changed: false,
    sha256: saved.status === "saved" ? saved.sha256 : undefined,
  });
  expect(h.remote).toEqual(original);
});

test("malformed pulled packages cannot be accepted as a sync base", async () => {
  const h = new Harness();
  h.override = async () =>
    h.response(strToU8("not a hightex archive"), 200, {
      "X-Document-ID": "server-doc",
      "X-HighTex-SHA256": "a".repeat(64),
    });
  await expect(
    h.client.pull({
      sessionId: h.context().sessionId,
      serverDocumentId: "server-doc",
    }),
  ).rejects.toMatchObject({ code: "invalid_archive" });
  expect(h.bindings).toEqual({});
});

test("pull rejects a whole-archive checksum instead of treating it as a legacy content hash", async () => {
  const h = new Harness();
  h.remote = bytes("Content hash only");
  h.override = async () =>
    h.response(h.remote, 200, {
      "X-Document-ID": "server-doc",
      "X-HighTex-SHA256": byteSha(h.remote!),
    });
  await expect(
    h.client.pull({
      sessionId: h.context().sessionId,
      serverDocumentId: "server-doc",
    }),
  ).rejects.toThrow("integrity_failed");
});

test("force push backs up an unverifiable cloud package and replaces it with verified local content", async () => {
  const h = new Harness();
  h.remote = bytes("Original cloud");
  await h.bind();
  const previous = bytes("Cloud package with a mismatched recorded hash");
  h.remote = previous;
  h.remoteSha = "a".repeat(64);
  const sessionId = h.context().sessionId;
  await expect(
    h.client.pull({ sessionId, serverDocumentId: "server-doc" }),
  ).rejects.toThrow("integrity_failed");
  const result = await h.client.push({
    ...(await h.input(bytes("Local recovery"))),
    force: true,
  });
  expect(result.status).toBe("saved");
  expect(h.backups).toEqual([previous]);
  expect(h.writes).toHaveLength(1);
  expect(new Headers(h.writes[0].headers).get("X-HighTex-Force")).toBe("true");
  const recovered = await h.client.pull({
    sessionId,
    serverDocumentId: "server-doc",
  });
  expect(recovered.status).toBe("downloaded");
  if (recovered.status === "downloaded")
    expect(recovered.sha256).toBe(await sha(bytes("Local recovery")));
});

test("force push stops if cloud changes while its backup is being saved", async () => {
  const h = new Harness();
  h.remote = bytes("Original cloud");
  await h.bind();
  const binding = structuredClone(h.bindings);
  h.transport.backup = async (_session, file) => {
    h.backups.push(new Uint8Array(file));
    h.remote = bytes("Changed during backup");
    return "/fixture/backup.hightex";
  };
  await expect(
    h.client.push({ ...(await h.input(bytes("Local recovery"))), force: true }),
  ).rejects.toMatchObject({ code: "cloud_changed" });
  expect(h.writes).toHaveLength(0);
  expect(h.bindings).toEqual(binding);
});
