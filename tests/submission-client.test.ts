import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  SubmissionClient,
  parseSubmissionList,
} from "../electron/service/submission-client";

const document = (documentId = "student-doc", submissionId = 87) => ({
  id: documentId,
  title: "Student title",
  author: 12,
  author_data: { id: 12, name: "Student A" },
  submission: [
    {
      id: submissionId,
      document_id: documentId,
      recipient_id: 24,
      recipient_name: "Advisor A",
      recipient_roles: { primary_advisor: "Pembimbing I" },
      snapshot_purged_at: null,
      status: "waiting_for_review",
      created_at: "2026-10-21T00:00:00Z",
    },
  ],
});
const credentials = {
  accountId: "24",
  token: "private-token",
  serverUrl: "https://server.test/api/",
};
const response = (data: unknown, status = 200, headers = new Headers()) => ({
  ok: status >= 200 && status < 300,
  status,
  data,
  headers,
});
const download = (
  file = new Uint8Array([1, 2, 3]),
  documentId = "student-doc",
) =>
  response(
    file,
    200,
    new Headers({
      "X-Document-ID": documentId,
      "X-HighTex-SHA256": createHash("sha256").update(file).digest("hex"),
    }),
  );
const sessionId = (client: SubmissionClient) => {
  const result = client.context();
  if (!result.ok) throw new Error("Expected session");
  return result.data.sessionId;
};

describe("submission response contract", () => {
  test("reads advisor documents and student history without guessing from the first role", () => {
    const advisor = parseSubmissionList({ message: "ok", data: [document()] });
    const student = parseSubmissionList({
      message: "ok",
      data: { document: document() },
    });
    expect(advisor.audience).toBe("advisor");
    expect(student.audience).toBe("student");
    expect(advisor.items).toEqual(student.items);
    expect(advisor.items[0]).toMatchObject({
      id: "87",
      documentId: "student-doc",
      studentName: "Student A",
      ownerId: "12",
    });
    expect(parseSubmissionList({ data: { document: null } }).items).toEqual([]);
    expect(parseSubmissionList({ data: [] }).items).toEqual([]);
  });

  test("rejects unsupported shapes, statuses and mismatched document relationships", () => {
    expect(() => parseSubmissionList({ message: "unexpected" })).toThrow();
    const wrong = document();
    wrong.submission[0].document_id = "another-doc";
    expect(() => parseSubmissionList({ data: [wrong] })).toThrow();
    const unknown = document();
    unknown.submission[0].status = "unknown";
    expect(() => parseSubmissionList({ data: [unknown] })).toThrow();
  });
});

describe("submission API session and integrity", () => {
  test("verifies the exact file hash and server document before returning it to the renderer", async () => {
    let endpoint = "";
    const client = new SubmissionClient({
      session: () => credentials,
      request: async (path) => {
        endpoint = path;
        return download();
      },
    });
    const result = await client.file({
      sessionId: sessionId(client),
      submissionId: "87",
      documentId: "student-doc",
    });
    expect(endpoint).toBe("/submission/87/file");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.file).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.data.session.accountId).toBe("24");
    expect(JSON.stringify(result)).not.toContain("private-token");
  });

  test("rejects corrupt bytes and a file belonging to another server document", async () => {
    const corrupt = download();
    corrupt.headers.set("X-HighTex-SHA256", "0".repeat(64));
    const client = new SubmissionClient({
      session: () => credentials,
      request: async () => corrupt,
    });
    expect(
      await client.file({
        sessionId: sessionId(client),
        submissionId: "87",
        documentId: "student-doc",
      }),
    ).toMatchObject({ ok: false, error: { code: "integrity_failed" } });
    const mismatch = new SubmissionClient({
      session: () => credentials,
      request: async () => download(undefined, "other"),
    });
    expect(
      await mismatch.file({
        sessionId: sessionId(mismatch),
        submissionId: "87",
        documentId: "student-doc",
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_response" } });
  });

  test("handles access denial and missing snapshots without clearing the actor session", async () => {
    for (const [status, code] of [
      [401, "not_authenticated"],
      [403, "forbidden"],
      [404, "not_found"],
      [500, "request_failed"],
    ] as const) {
      const client = new SubmissionClient({
        session: () => credentials,
        request: async () => response({ message: "Unavailable" }, status),
      });
      const current = sessionId(client);
      expect(
        await client.file({
          sessionId: current,
          submissionId: "87",
          documentId: "student-doc",
        }),
      ).toMatchObject({ ok: false, error: { code, status } });
      expect(sessionId(client)).toBe(current);
    }
  });

  test("rejects requests from an earlier account, server or token before sending a download", async () => {
    let actor = { ...credentials };
    let requests = 0;
    const client = new SubmissionClient({
      session: () => actor,
      request: async () => {
        requests++;
        return download();
      },
    });
    for (const change of [
      { accountId: "25" },
      { serverUrl: "https://other.test/api/" },
      { token: "new-token" },
    ]) {
      const oldSession = sessionId(client);
      actor = { ...actor, ...change };
      expect(
        await client.file({
          sessionId: oldSession,
          submissionId: "87",
          documentId: "student-doc",
        }),
      ).toMatchObject({ ok: false, error: { code: "session_changed" } });
    }
    expect(requests).toBe(0);
  });

  test("does not deliver a late download after logout or an account switch", async () => {
    let actor: typeof credentials | null = { ...credentials };
    let finish!: (value: ReturnType<typeof download>) => void;
    const client = new SubmissionClient({
      session: () => actor,
      request: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const pending = client.file({
      sessionId: sessionId(client),
      submissionId: "87",
      documentId: "student-doc",
    });
    actor = null;
    finish(download());
    expect(await pending).toMatchObject({
      ok: false,
      error: { code: "session_changed" },
    });
  });

  test("list responses are scoped to the actor that started the request", async () => {
    let actor = { ...credentials };
    const client = new SubmissionClient({
      session: () => actor,
      request: async () => {
        actor = { ...actor, accountId: "new-account" };
        return response({ data: [document()] });
      },
    });
    expect(await client.list()).toMatchObject({
      ok: false,
      error: { code: "session_changed" },
    });
  });

  test("unauthenticated and malformed requests never reach the transport", async () => {
    let requests = 0;
    const client = new SubmissionClient({
      session: () => null,
      request: async () => {
        requests++;
        return download();
      },
    });
    expect(await client.list()).toMatchObject({
      ok: false,
      error: { code: "not_authenticated" },
    });
    const signedIn = new SubmissionClient({
      session: () => credentials,
      request: async () => {
        requests++;
        return download();
      },
    });
    expect(
      await signedIn.file({
        sessionId: sessionId(signedIn),
        submissionId: "../logout",
        documentId: "student-doc",
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_response" } });
    expect(requests).toBe(0);
  });
});

test("document history uses the document endpoint even for multi-role audiences", async () => {
  const paths: string[] = [];
  const client = new SubmissionClient({
    session: () => credentials,
    request: async (path) => {
      paths.push(path);
      return response({ data: document() });
    },
  });
  expect(
    await client.history({
      sessionId: sessionId(client),
      documentId: "student-doc",
    }),
  ).toMatchObject({
    ok: true,
    data: { documentId: "student-doc", ownerId: "12", items: [{ id: "87" }] },
  });
  expect(paths).toEqual(["/submission/student-doc"]);
});

test("create sends the selected recipient and maps active/invalid archive responses", async () => {
  for (const [status, code] of [
    [409, "active_submission"],
    [422, "invalid_document"],
  ] as const) {
    const client = new SubmissionClient({
      session: () => credentials,
      request: async (path, options) => {
        expect(path).toBe("/submission");
        expect(options?.method).toBe("POST");
        expect(JSON.parse(String(options?.body))).toEqual({
          recipient_id: "24",
        });
        expect(options?.signal).toBeDefined();
        return response({}, status);
      },
    });
    expect(
      await client.create({
        sessionId: sessionId(client),
        documentId: "student-doc",
        recipientId: "24",
      }),
    ).toMatchObject({ ok: false, error: { code, status } });
  }
});

test("review detail validates document/submission/comment relationships and preserves comment text", async () => {
  const data = {
    id: 87,
    document_id: "student-doc",
    status: "reviewed",
    document: document(),
    comment: [
      {
        id: 1,
        submission_id: 87,
        comment: "<b>Review text</b>",
        commentator: { name: "Advisor" },
      },
    ],
  };
  const client = new SubmissionClient({
    session: () => credentials,
    request: async () => response({ data }),
  });
  const input = {
    sessionId: sessionId(client),
    documentId: "student-doc",
    submissionId: "87",
  };
  expect(await client.detail(input)).toMatchObject({
    ok: true,
    data: {
      comments: [{ id: "1", text: "<b>Review text</b>", author: "Advisor" }],
    },
  });
  data.comment[0].submission_id = 88;
  expect(await client.detail(input)).toMatchObject({
    ok: false,
    error: { code: "invalid_response" },
  });
  data.comment[0].submission_id = 87;
  data.status = "on_review";
  expect(await client.detail(input)).toMatchObject({
    ok: true,
    data: { submission: { status: "on_review" } },
  });
});

test("history/detail/create reject stale session IDs without requests", async () => {
  let count = 0;
  const client = new SubmissionClient({
    session: () => credentials,
    request: async () => {
      count++;
      return response({});
    },
  });
  const input = {
    sessionId: "stale",
    recipientId: "24",
    documentId: "student-doc",
    submissionId: "87",
  };
  for (const result of await Promise.all([
    client.history(input),
    client.detail(input),
    client.create(input),
  ]))
    expect(result).toMatchObject({
      ok: false,
      error: { code: "session_changed" },
    });
  expect(count).toBe(0);
});

test("recipient choices are validated and scoped to the active session", async () => {
  let actor = { ...credentials };
  let payload: unknown = {
    data: [
      { id: 24, name: "Advisor A", roles: { primary_advisor: "Pembimbing I" } },
    ],
  };
  let switchAccount = false;
  const client = new SubmissionClient({
    session: () => actor,
    request: async (path) => {
      expect(path).toBe("/submission/recipients");
      if (switchAccount) actor = { ...actor, accountId: "another-account" };
      return response(payload);
    },
  });
  const input = { sessionId: sessionId(client) };
  expect(await client.recipients(input)).toMatchObject({
    ok: true,
    data: { items: [{ id: "24", name: "Advisor A" }] },
  });
  payload = { data: [{ id: 24, name: "A", roles: [] }] };
  expect(await client.recipients(input)).toMatchObject({
    ok: false,
    error: { code: "invalid_response" },
  });
  switchAccount = true;
  expect(await client.recipients(input)).toMatchObject({
    ok: false,
    error: { code: "session_changed" },
  });
});

test("parses recipient metadata, purged archives and serialized author relationships", () => {
  const doc = document();
  const result = parseSubmissionList({
    data: [
      {
        ...doc,
        author: { id: 12, name: "Student A" },
        submission: [
          { ...doc.submission[0], snapshot_purged_at: "2026-10-28T00:00:00Z" },
        ],
      },
    ],
  });
  expect(result.items[0]).toMatchObject({
    ownerId: "12",
    recipientId: "24",
    recipientName: "Advisor A",
    snapshotPurgedAt: "2026-10-28T00:00:00Z",
  });
});

test("invalid recipient validation is distinct from invalid document content", async () => {
  const client = new SubmissionClient({
    session: () => credentials,
    request: async () =>
      response({ errors: { recipient_id: ["Not active"] } }, 422),
  });
  expect(
    await client.create({
      sessionId: sessionId(client),
      documentId: "student-doc",
      recipientId: "24",
    }),
  ).toMatchObject({
    ok: false,
    error: { code: "invalid_recipient", status: 422 },
  });
});
