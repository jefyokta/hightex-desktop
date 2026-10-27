import { createHash, randomUUID } from "node:crypto";

interface Credentials {
  serverUrl: string;
  accountId: string;
  token: string;
}
interface Response {
  ok: boolean;
  status: number;
  data: unknown;
  headers: Headers;
}
export interface CloudTransport {
  session(): Credentials | null;
  request(endpoint: string, options?: RequestInit): Promise<Response>;
  readBindings(): Record<string, CloudBinding>;
  writeBindings(bindings: Record<string, CloudBinding>): void;
  backup(session: CloudSession, file: Uint8Array): Promise<string>;
  category(document: HighTexDocument): Promise<Category | undefined>;
  validatePush?(
    input: CloudPushInput,
    serverDocumentId: string | null,
  ): Promise<void>;
}

const hash = (file: Uint8Array) =>
  createHash("sha256").update(file).digest("hex");
const validHash = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value);
const fail = (code: string): never => {
  throw new Error(`cloud_error:${code}`);
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("invalid_response");
  return value as Record<string, unknown>;
};

/** Account slot observations never change the base of a local document. */
export class CloudSyncClient {
  private credentials?: Credentials;
  private current?: CloudSession;
  private pending = new Map<
    string,
    { download: CloudDownload; expires: number }
  >();
  private writing = false;

  constructor(private transport: CloudTransport) {}

  context(): CloudSession {
    const credentials = this.transport.session();
    if (!credentials) {
      this.current = undefined;
      this.credentials = undefined;
      this.pending.clear();
      return fail("not_authenticated");
    }
    if (
      !this.credentials ||
      Object.keys(credentials).some(
        (key) =>
          credentials[key as keyof Credentials] !==
          this.credentials![key as keyof Credentials],
      )
    ) {
      this.credentials = { ...credentials };
      this.current = {
        serverUrl: credentials.serverUrl,
        accountId: credentials.accountId,
        sessionId: randomUUID(),
      };
      this.pending.clear();
    }
    return { ...this.current! };
  }

  private require(sessionId: string) {
    const session = this.context();
    if (session.sessionId !== sessionId) return fail("session_changed");
    return session;
  }

  private key(session: CloudSession, localId: string) {
    return JSON.stringify([session.serverUrl, session.accountId, localId]);
  }

  binding(sessionId: string, localId: string): CloudBinding | null {
    const session = this.require(sessionId);
    return this.transport.readBindings()[this.key(session, localId)] ?? null;
  }

  academicLocked(localId: string) {
    if (!validId(localId)) return fail("invalid_request");
    return Object.values(this.transport.readBindings()).some(
      (binding) => binding.localDocumentId === localId,
    );
  }

  private saveBinding(
    sessionId: string,
    localId: string,
    serverId: string,
    sha256: string,
  ) {
    const session = this.require(sessionId);
    if (!validId(localId)) return fail("invalid_request");
    const bindings = this.transport.readBindings();
    const binding = {
      serverUrl: session.serverUrl,
      accountId: session.accountId,
      localDocumentId: localId,
      serverDocumentId: serverId,
      baseSha256: sha256,
    };
    bindings[this.key(session, localId)] = binding;
    this.transport.writeBindings(bindings);
    return binding;
  }

  async list(sessionId: string): Promise<CommitListResponse> {
    this.require(sessionId);
    const response = await this.transport.request("/v2/documents/commits", {
      method: "GET",
    });
    this.require(sessionId);
    if (response.status === 404) return { commits: [] };
    if (!response.ok) return fail(`http_${response.status}`);
    const commits = object(response.data).commits;
    if (!Array.isArray(commits)) return fail("invalid_response");
    for (const value of commits) {
      const commit = object(value);
      if (
        !validId(commit.document_id) ||
        !validHash(commit.sha256) ||
        typeof commit.type !== "string"
      )
        return fail("invalid_response");
    }
    if (commits.filter((value) => object(value).type === "current").length > 1)
      return fail("invalid_response");
    return { commits: commits as CommitListResponse["commits"] };
  }

  async pull(input: {
    sessionId: string;
    serverDocumentId: string;
    sha256?: string;
  }): Promise<CloudDownload | { status: "empty" | "not_found" }> {
    const session = this.require(input.sessionId);
    if (
      !validId(input.serverDocumentId) ||
      (input.sha256 !== undefined && !validHash(input.sha256))
    )
      return fail("invalid_request");
    const response = await this.transport.request(
      `/v2/documents/pull${input.sha256 ? `?sha256=${input.sha256}` : ""}`,
      { method: "GET" },
    );
    this.require(input.sessionId);
    if (response.status === 204) return { status: "empty" };
    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) return fail(`http_${response.status}`);
    const sha256 = response.headers.get("X-HighTex-SHA256")?.toLowerCase();
    const serverDocumentId = response.headers.get("X-Document-ID");
    if (
      !(response.data instanceof Uint8Array) ||
      !response.data.length ||
      response.data.length > 64 * 1024 * 1024 ||
      !validHash(sha256) ||
      serverDocumentId !== input.serverDocumentId
    )
      return fail("invalid_response");
    if (
      hash(response.data) !== sha256 ||
      (input.sha256 && input.sha256 !== sha256)
    )
      return fail("integrity_failed");
    const download: CloudDownload = {
      status: "downloaded",
      session,
      downloadId: randomUUID(),
      serverDocumentId,
      sha256,
      archive: Boolean(input.sha256),
      file: new Uint8Array(response.data),
    };
    for (const [key, item] of this.pending)
      if (item.expires < Date.now()) this.pending.delete(key);
    while (this.pending.size >= 3)
      this.pending.delete(this.pending.keys().next().value!);
    this.pending.set(download.downloadId, {
      download,
      expires: Date.now() + 10 * 60 * 1000,
    });
    return download;
  }

  accept(input: {
    sessionId: string;
    downloadId: string;
    localDocumentId: string;
  }): CloudBinding {
    this.require(input.sessionId);
    const pending = this.pending.get(input.downloadId);
    if (!pending || pending.expires < Date.now() || pending.download.archive)
      return fail("invalid_download");
    const binding = this.saveBinding(
      input.sessionId,
      input.localDocumentId,
      pending.download.serverDocumentId,
      pending.download.sha256,
    );
    this.pending.delete(input.downloadId);
    return binding;
  }

  async backup(sessionId: string, file: Uint8Array) {
    const session = this.require(sessionId);
    if (
      !(file instanceof Uint8Array) ||
      !file.length ||
      file.length > 64 * 1024 * 1024
    )
      return fail("invalid_request");
    const path = await this.transport.backup(session, file);
    this.require(sessionId);
    return path;
  }

  async push(input: CloudPushInput): Promise<
    | {
        status: "saved";
        changed: boolean;
        sha256: string;
        serverDocumentId: string;
      }
    | { status: "conflict"; sha256: string }
  > {
    this.require(input.sessionId);
    if (this.writing) return fail("busy");
    if (
      !validId(input.document?.id) ||
      !(input.file instanceof Uint8Array) ||
      !input.file.length ||
      input.file.length > 64 * 1024 * 1024 ||
      typeof input.message !== "string" ||
      [...input.message].length > 255 ||
      (input.force !== undefined && typeof input.force !== "boolean")
    )
      return fail("invalid_request");
    if (input.document.config.intern) return fail("kp_unsupported");
    this.writing = true;
    try {
      input = {
        ...input,
        file: new Uint8Array(input.file),
        document: structuredClone(input.document),
      };
      const category = await this.transport.category(input.document);
      this.require(input.sessionId);
      if (!category) return fail("unknown_category");
      if (category.variant === "intern") return fail("kp_unsupported");
      const current = (await this.list(input.sessionId)).commits.find(
        (commit) => commit.type === "current",
      );
      if ((current?.document_id ?? null) !== input.expectedServerDocumentId)
        return fail("cloud_changed");
      if (
        input.force &&
        (!current || input.expectedCloudSha256 !== current.sha256)
      )
        return fail("cloud_changed");
      await this.transport.validatePush?.(input, current?.document_id ?? null);
      this.require(input.sessionId);
      const binding = this.binding(input.sessionId, input.document.id);
      const linked =
        binding?.serverDocumentId === current?.document_id && Boolean(current);
      let base = linked ? binding!.baseSha256 : undefined;
      if (current && (!linked || input.force)) {
        if (
          (!linked && !input.replace) ||
          input.expectedCloudSha256 !== current.sha256
        )
          return fail("replacement_required");
        const previous = await this.pull({
          sessionId: input.sessionId,
          serverDocumentId: current.document_id,
        });
        if (
          previous.status !== "downloaded" ||
          previous.sha256 !== current.sha256
        )
          return fail("cloud_changed");
        await this.backup(input.sessionId, previous.file);
        if (!linked) base = current.sha256!;
      }
      const file = new Uint8Array(input.file);
      const sha256 = hash(file);
      const doc = input.document;
      const form = new FormData();
      form.append(
        "file",
        new Blob([file], { type: "application/x-hightex" }),
        `${doc.id}.hightex`,
      );
      const headers: Record<string, string> = {
        "X-HighTex-SHA256": sha256,
        "X-Document-Title": encodeURIComponent(doc.title),
        "X-Document-En-Title": encodeURIComponent(doc.altTitle || doc.title),
        "X-Document-Category-ID": String(doc.category),
        "X-Document-Keywords-ID": encodeURIComponent(
          doc.keywords.indonesian.join(","),
        ),
        "X-Document-Keywords-EN": encodeURIComponent(
          doc.keywords.english.join(","),
        ),
        "X-HighTex-Commit-Message": encodeURIComponent(input.message),
      };
      // An occupied slot must conflict even if it appeared after our preflight.
      headers["X-HighTex-Base-SHA256"] = base ?? "0".repeat(64);
      if (input.force) headers["X-HighTex-Force"] = "true";
      this.require(input.sessionId);
      const response = await this.transport.request("/v2/documents/push", {
        method: "POST",
        body: form,
        headers,
      });
      this.require(input.sessionId);
      const result = object(response.data);
      if (
        response.status === 409 &&
        result.error === "conflict" &&
        validHash(result.sha256)
      )
        return { status: "conflict", sha256: result.sha256 };
      if (!response.ok) return fail(`http_${response.status}`);
      if (result.sha256 !== sha256 || typeof result.changed !== "boolean")
        return fail("invalid_response");
      // The API does not return the server ID on first push; confirm the commit.
      const latest = (await this.list(input.sessionId)).commits.find(
        (commit) => commit.type === "current",
      );
      if (
        !latest ||
        latest.sha256 !== sha256 ||
        (current && latest.document_id !== current.document_id)
      )
        return fail("cloud_changed");
      this.saveBinding(input.sessionId, doc.id, latest.document_id, sha256);
      return {
        status: "saved",
        changed: result.changed,
        sha256,
        serverDocumentId: latest.document_id,
      };
    } finally {
      this.writing = false;
    }
  }
}
