import { contentFingerprint } from "../src/utils/htx/content-fingerprint";
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { strToU8, zipSync, unzipSync } from "fflate";
import { CloudSyncClient } from "../electron/service/cloud-sync-client";
import { SubmissionClient } from "../electron/service/submission-client";
import { SubmissionWorkflow } from "../electron/service/submission-workflow";

const hash = (file: Uint8Array) =>
  createHash("sha256").update(file).digest("hex");
const document: HighTexDocument = {
  id: "local-a",
  title: "Student document",
  altTitle: "",
  category: "1",
  keywords: { indonesian: [], english: [] },
  config: {},
};
const artifact = (name = "Student A", content = "Frozen chapter A") =>
  zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        version: 2,
        schema_version: 2,
        format: "json",
        document: {
          id: document.id,
          title: { id: document.title },
          category: "1",
        },
      }),
    ),
    "files/profile.json": strToU8(JSON.stringify({ name, nim: "A001" })),
    "files/chapters/1.json": strToU8(
      JSON.stringify([
        { type: "paragraph", content: [{ type: "text", text: content }] },
      ]),
    ),
  });
const response = (data: unknown, status = 200, headers = new Headers()) => ({
  data,
  status,
  ok: status >= 200 && status < 300,
  headers,
});
const fixture = () => {
  let actor = {
    serverUrl: "http://demo/api/",
    accountId: "12",
    token: "secret",
  };
  let owner = "12";
  let current: Uint8Array = artifact("Older author", "Older version");
  let bindings: Record<string, CloudBinding> = {};
  let receipts: Record<string, SubmissionAttempt> = {};
  const snapshots = new Map<string, Uint8Array>();
  const rows: {
    id: string;
    document_id: string;
    status: SubmissionStatus;
    recipient_id: string;
  }[] = [];
  const calls: { path: string; method: string }[] = [];
  let post:
    | ((options: RequestInit) => Promise<ReturnType<typeof response>>)
    | undefined;
  let hideHistory = false;
  let corrupt = false;
  let uploadConflict = false;
  let onUpload: (() => void) | undefined;
  const rawDocument = () => ({
    id: "server-a",
    author: owner,
    title: document.title,
    author_data: { name: "Account Student" },
    submission: hideHistory ? [] : rows,
  });
  let recipients = [
    { id: 24, name: "Advisor A", roles: { primary_advisor: "Pembimbing I" } },
    {
      id: 25,
      name: "Advisor B",
      roles: { secondary_advisor: "Pembimbing II" },
    },
  ];
  const create = (recipientId = "24") => {
    const row = {
      id: String(rows.length + 1),
      document_id: "server-a",
      recipient_id: recipientId,
      status: "waiting_for_review" as const,
    };
    snapshots.set(row.id, new Uint8Array(current));
    rows.unshift(row);
    return response({ data: { ...row, document: rawDocument() } }, 201);
  };
  const transport = {
    session: () => actor,
    request: async (path: string, options: RequestInit = {}) => {
      calls.push({ path, method: options.method ?? "GET" });
      if (path === "/v2/documents/commits")
        return response({
          commits: [
            {
              type: "current",
              document_id: "server-a",
              sha256: await contentFingerprint(current),
            },
          ],
        });
      if (path === "/v2/documents/push") {
        onUpload?.();
        if (uploadConflict)
          return response(
            { error: "conflict", sha256: await contentFingerprint(current) },
            409,
          );
        current = new Uint8Array(
          await ((options.body as FormData).get("file") as Blob).arrayBuffer(),
        );
        return response({
          sha256: await contentFingerprint(current),
          changed: true,
        });
      }
      if (path === "/v2/documents/pull")
        return response(
          current,
          200,
          new Headers({
            "X-HighTex-SHA256": await contentFingerprint(current),
            "X-Document-ID": "server-a",
          }),
        );
      if (path === "/submission/recipients")
        return response({ data: recipients });
      if (path === "/submission/server-a")
        return response({ data: rawDocument() });
      if (path === "/submission" && options.method === "POST")
        return post
          ? post(options)
          : create(JSON.parse(String(options.body)).recipient_id);
      if (/^\/submission\/\d+\/file$/.test(path)) {
        const file = snapshots.get(path.split("/")[2]);
        return file
          ? response(
              file,
              200,
              new Headers({
                "X-Document-ID": "server-a",
                "X-HighTex-SHA256": corrupt ? "0".repeat(64) : hash(file),
              }),
            )
          : response({}, 404);
      }
      throw Error(`Unexpected request ${path}`);
    },
  };
  const cloud = new CloudSyncClient({
    ...transport,
    readBindings: () => bindings,
    writeBindings: (value) => {
      bindings = value;
    },
    category: async () =>
      ({ id: 1, name: "Thesis", variant: "thesis", chapters: [] }) as Category,
    backup: async () => {
      throw Error("Must not replace a slot");
    },
  });
  const submissions = new SubmissionClient(transport);
  const store = {
    read: () => receipts,
    write: (value: typeof receipts) => {
      receipts = structuredClone(value);
    },
  };
  const workflow = new SubmissionWorkflow(cloud, submissions, store);
  const sessionId = cloud.context().sessionId;
  bindings[JSON.stringify([actor.serverUrl, actor.accountId, document.id])] = {
    ...cloud.context(),
    localDocumentId: document.id,
    serverDocumentId: "server-a",
    baseSha256: hash(current),
  };
  const input = (): SubmissionPrepareInput => ({
    recipientId: "24",
    sessionId,
    document: structuredClone(document),
    file: artifact(),
    message: "Review",
    expectedServerDocumentId: "server-a",
    expectedCloudSha256: hash(current),
    replace: false,
  });
  return {
    cloud,
    submissions,
    workflow,
    store,
    sessionId,
    input,
    calls,
    rows,
    snapshots,
    create,
    setRecipients: (value: typeof recipients) => {
      recipients = value;
    },
    rebuild: (
      validate?: (input: {
        sessionId: string;
        file: Uint8Array;
        serverDocumentId: string;
      }) => Promise<void>,
    ) => new SubmissionWorkflow(cloud, submissions, store, validate),
    setPost: (value: typeof post) => {
      post = value;
    },
    hideHistory: (value: boolean) => {
      hideHistory = value;
    },
    corrupt: () => {
      corrupt = true;
    },
    conflict: () => {
      uploadConflict = true;
    },
    onUpload: (value: () => void) => {
      onUpload = value;
    },
    setCurrent: (value: Uint8Array) => {
      current = value;
    },
    switchAccount: () => {
      actor = { ...actor, accountId: "13" };
    },
    setAccount: (accountId: string) => {
      actor = { ...actor, accountId };
    },
    setOwner: (value: string) => {
      owner = value;
    },
  };
};
const posts = (f: ReturnType<typeof fixture>) =>
  f.calls.filter(
    (call) => call.path === "/submission" && call.method === "POST",
  );

test("freezes, pushes, creates targeted submission and verifies server snapshot without importing", async () => {
  const f = fixture();
  const input = f.input();
  const staged = await f.workflow.prepare(input);
  input.file.fill(0);
  input.document.title = "Changed local draft";
  expect(staged.state).toBe("uploaded");
  const done = await f.workflow.submit(f.sessionId);
  expect(done).toMatchObject({
    state: "submitted",
    sha256: await contentFingerprint(artifact()),
    snapshotSha256: hash(artifact()),
    submissionId: "1",
  });
  expect(posts(f)).toHaveLength(1);
  f.setCurrent(artifact("Later draft", "Version B"));
  expect(hash(f.snapshots.get("1")!)).toBe(done.snapshotSha256!);
  expect(JSON.stringify(done)).not.toContain("secret");
});

test("active submission and an unlinked draft stop before upload", async () => {
  const f = fixture();
  f.create();
  await expect(f.workflow.prepare(f.input())).rejects.toThrow(
    "active_submission",
  );
  expect(f.calls.some((call) => call.method === "POST")).toBe(false);
  const g = fixture();
  const input = g.input();
  input.document.id = "another-local-id";
  await expect(g.workflow.prepare(input)).rejects.toThrow("not_linked");
  expect(g.calls).toHaveLength(0);
});

test("invalid author/empty content and KP cannot reach submission creation", async () => {
  for (const file of [
    artifact(""),
    artifact("A", ""),
    new Uint8Array([1, 2]),
  ]) {
    const f = fixture();
    await expect(f.workflow.prepare({ ...f.input(), file })).rejects.toThrow(
      "invalid_document",
    );
    expect(f.calls).toHaveLength(0);
  }
  const f = fixture();
  const input = f.input();
  input.document.config.intern = {} as HighTexDocument["config"]["intern"];
  await expect(f.workflow.prepare(input)).rejects.toThrow("kp_unsupported");
  expect(posts(f)).toHaveLength(0);
});

test("push failure/conflict does not create a receipt or a submission", async () => {
  const f = fixture();
  f.conflict();
  await expect(f.workflow.prepare(f.input())).rejects.toThrow("cloud_conflict");
  expect(f.workflow.pending(f.sessionId)).toBeNull();
  expect(posts(f)).toHaveLength(0);
});

test("double clicks and a second stage cannot replace an in-flight artifact", async () => {
  const f = fixture();
  const first = f.workflow.prepare(f.input());
  await expect(f.workflow.prepare(f.input())).rejects.toThrow("busy");
  await first;
  await expect(f.workflow.prepare(f.input())).rejects.toThrow(
    "pending_attempt",
  );
  const submit = f.workflow.submit(f.sessionId);
  await expect(f.workflow.submit(f.sessionId)).rejects.toThrow("busy");
  await submit;
  expect(posts(f)).toHaveLength(1);
});

test("definite 422 failure retains the uploaded version for retry, without another push/export", async () => {
  const f = fixture();
  f.setPost(async (options) => {
    expect(JSON.parse(String(options.body))).toEqual({ recipient_id: "24" });
    return response({ errors: { document: ["Invalid"] } }, 422);
  });
  const prepared = await f.workflow.prepare(f.input());
  expect(await f.workflow.submit(f.sessionId)).toMatchObject({
    state: "uploaded",
    error: "invalid_document",
    sha256: prepared.sha256,
  });
  f.setPost(undefined);
  expect((await f.workflow.submit(f.sessionId)).state).toBe("submitted");
  expect(
    f.calls.filter((call) => call.path === "/v2/documents/push"),
  ).toHaveLength(1);
});

test("a changed cloud version blocks retry rather than submitting another draft", async () => {
  const f = fixture();
  await f.workflow.prepare(f.input());
  f.setCurrent(artifact("B", "Different document"));
  await expect(f.workflow.submit(f.sessionId)).rejects.toThrow("cloud_changed");
  expect(posts(f)).toHaveLength(0);
  expect(f.workflow.pending(f.sessionId)?.state).toBe("uploaded");
});

test("new academic assignments block a stored submission version before POST without changing its receipt", async () => {
  const f = fixture();
  await f.workflow.prepare(f.input());
  const guarded = f.rebuild(async () => {
    throw new Error("cloud_error:academic_changed");
  });
  await expect(guarded.submit(f.sessionId)).rejects.toThrow("academic_changed");
  expect(posts(f)).toHaveLength(0);
  expect(guarded.pending(f.sessionId)?.state).toBe("uploaded");
});

test("timeout after server commit reconciles exact snapshot; restart and repeat never POST twice", async () => {
  const f = fixture();
  await f.workflow.prepare(f.input());
  f.setPost(async () => {
    f.create();
    throw Error("Connection lost");
  });
  expect((await f.workflow.submit(f.sessionId)).state).toBe("submitted");
  const resumed = f.rebuild();
  expect((await resumed.reconcile(f.sessionId)).state).toBe("submitted");
  await expect(resumed.submit(f.sessionId)).rejects.toThrow("check_history");
  expect(posts(f)).toHaveLength(1);
});

test("an unresolved timeout remains durable and only checks history until a late result appears", async () => {
  const f = fixture();
  await f.workflow.prepare(f.input());
  f.setPost(async () => {
    throw Error("Timeout");
  });
  expect((await f.workflow.submit(f.sessionId)).state).toBe("uncertain");
  const resumed = f.rebuild();
  await expect(resumed.submit(f.sessionId)).rejects.toThrow("check_history");
  await expect(resumed.discard(f.sessionId)).rejects.toThrow("check_history");
  expect((await resumed.reconcile(f.sessionId)).state).toBe("uncertain");
  f.create();
  expect((await resumed.reconcile(f.sessionId)).state).toBe("submitted");
  expect(posts(f)).toHaveLength(1);
});

test("version race during POST reports a different snapshot instead of false success", async () => {
  const f = fixture();
  await f.workflow.prepare(f.input());
  f.setPost(async () => {
    f.setCurrent(artifact("Another device", "Racing version"));
    return f.create();
  });
  expect(await f.workflow.submit(f.sessionId)).toMatchObject({
    state: "mismatch",
    submissionId: "1",
    error: "snapshot_mismatch",
  });
  expect(posts(f)).toHaveLength(1);
});

test("corrupt/unavailable snapshot stays unverified and cannot create a second submission", async () => {
  const f = fixture();
  await f.workflow.prepare(f.input());
  f.corrupt();
  expect(await f.workflow.submit(f.sessionId)).toMatchObject({
    state: "unverified",
    submissionId: "1",
    error: "integrity_failed",
  });
  await expect(f.workflow.submit(f.sessionId)).rejects.toThrow("check_history");
  expect(posts(f)).toHaveLength(1);
});

test("foreign ownership and switched sessions cannot upload or expose another account receipt", async () => {
  const f = fixture();
  f.setOwner("99");
  await expect(f.workflow.prepare(f.input())).rejects.toThrow("forbidden");
  expect(f.calls.some((call) => call.method === "POST")).toBe(false);
  const g = fixture();
  await g.workflow.prepare(g.input());
  g.switchAccount();
  expect(() => g.workflow.pending(g.sessionId)).toThrow("session_changed");
  await expect(g.workflow.submit(g.sessionId)).rejects.toThrow(
    "session_changed",
  );
  expect(posts(g)).toHaveLength(0);
});

test("account switch during push cannot save the old receipt into a new session", async () => {
  const f = fixture();
  f.onUpload(f.switchAccount);
  await expect(f.workflow.prepare(f.input())).rejects.toThrow(
    "session_changed",
  );
  expect(f.workflow.pending(f.cloud.context().sessionId)).toBeNull();
  expect(posts(f)).toHaveLength(0);
});

test("account switch during POST keeps the uncertain receipt only for the original account", async () => {
  const f = fixture();
  await f.workflow.prepare(f.input());
  f.setPost(async () => {
    const result = f.create();
    f.switchAccount();
    return result;
  });
  await expect(f.workflow.submit(f.sessionId)).rejects.toThrow(
    "session_changed",
  );
  expect(f.workflow.pending(f.cloud.context().sessionId)).toBeNull();
  f.setAccount("12");
  const sessionId = f.cloud.context().sessionId;
  expect(f.workflow.pending(sessionId)?.state).toBe("uncertain");
  expect((await f.rebuild().reconcile(sessionId)).state).toBe("submitted");
  expect(posts(f)).toHaveLength(1);
});

test("targeted pending reviews do not block submissions to another advisor", async () => {
  const f = fixture();
  f.create("25");
  const prepared = await f.workflow.prepare(f.input());
  expect(prepared).toMatchObject({
    recipientId: "24",
    recipientName: "Advisor A",
  });
  // Another advisor receives the same uploaded bytes after preparation.
  f.create("25");
  const result = await f.workflow.submit(f.sessionId);
  expect(result).toMatchObject({
    state: "submitted",
    recipientId: "24",
    submissionId: "3",
  });
  expect(posts(f)).toHaveLength(1);
});

test("the selected recipient is frozen with the receipt and checked again before POST", async () => {
  const f = fixture();
  const input = f.input();
  await f.workflow.prepare(input);
  input.recipientId = "25";
  f.setRecipients([
    {
      id: 25,
      name: "Advisor B",
      roles: { secondary_advisor: "Pembimbing II" },
    },
  ]);
  await expect(f.workflow.submit(f.sessionId)).rejects.toThrow(
    "invalid_recipient",
  );
  expect(f.workflow.pending(f.sessionId)).toMatchObject({
    recipientId: "24",
    state: "uploaded",
  });
  expect(posts(f)).toHaveLength(0);
});

test("a missing or unknown recipient cannot upload or create a submission", async () => {
  for (const [recipientId, error] of [
    ["", "recipient_required"],
    ["999", "invalid_recipient"],
  ]) {
    const f = fixture();
    await expect(
      f.workflow.prepare({ ...f.input(), recipientId }),
    ).rejects.toThrow(error);
    expect(f.calls.some((call) => call.method === "POST")).toBe(false);
  }
});

test("a lost response cannot be confirmed from an identical snapshot sent to another recipient", async () => {
  const f = fixture();
  await f.workflow.prepare(f.input());
  f.setPost(async () => {
    f.create("25");
    throw Error("lost response");
  });
  const result = await f.workflow.submit(f.sessionId);
  expect(result.state).toBe("uncertain");
  expect(result.submissionId).toBeUndefined();
  await f.workflow.reconcile(f.sessionId);
  expect(posts(f)).toHaveLength(1);
});

test("older prepared receipts never guess a recipient when retried", async () => {
  const f = fixture();
  await f.workflow.prepare(f.input());
  f.store.write(
    Object.fromEntries(
      Object.entries(f.store.read()).map(([key, value]) => [
        key,
        { ...value, recipientId: undefined },
      ]),
    ),
  );
  await expect(f.workflow.submit(f.sessionId)).rejects.toThrow(
    "recipient_required",
  );
  expect(posts(f)).toHaveLength(0);
  await f.workflow.discard(f.sessionId);
  expect(f.workflow.pending(f.sessionId)).toBeNull();
});

test("repacked snapshot and updated profile still match the prepared written content", async () => {
  const f = fixture();
  await f.workflow.prepare(f.input());
  f.setPost(async (options) => {
    const result = f.create(JSON.parse(String(options.body)).recipient_id);
    const saved = f.snapshots.get("1")!;
    const entries = unzipSync(saved);
    entries["files/profile.json"] = strToU8(
      JSON.stringify({ name: "Updated profile", nim: "B002" }),
    );
    entries["files/assets/profile.webp"] = strToU8("new photo");
    f.snapshots.set(
      "1",
      zipSync(Object.fromEntries(Object.entries(entries).reverse()), {
        level: 0,
        mtime: new Date(2025, 0, 1),
      }),
    );
    return result;
  });
  const result = await f.workflow.submit(f.sessionId);
  expect(result.state).toBe("submitted");
  expect(result.snapshotSha256).not.toBe(result.sha256);
});

test("profile changes on cloud do not invalidate a prepared submission", async () => {
  const f = fixture();
  await f.workflow.prepare(f.input());
  f.setCurrent(artifact("Updated profile"));
  expect((await f.workflow.submit(f.sessionId)).state).toBe("submitted");
});
