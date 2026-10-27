import { expect, test } from "bun:test";
import {
  AdvisorClient,
  type AdvisorStoreData,
} from "../electron/service/advisor-client";
import { SubmissionClient } from "../electron/service/submission-client";

const fixture = () => {
  let actor = {
    accountId: "24",
    serverUrl: "http://demo/api/",
    token: "secret",
  };
  let allowed = true;
  let lag = false;
  let beforeWrite: (() => void) | undefined;
  let afterWrite: (() => void) | undefined;
  let store: AdvisorStoreData = { documents: {}, pending: {}, completed: [] };
  const comments: {
    id: number;
    submission_id: number;
    advisor_id: number;
    comment: string;
    commentator: { name: string };
    created_at: string;
  }[] = [];
  const row = (
    id: number,
    document_id: string,
    status: SubmissionStatus = "waiting_for_review",
  ) => ({
    id,
    document_id,
    recipient_id: 24,
    status,
    created_at: "2026-10-21T00:00:00Z",
    reviewed_at: null as string | null,
  });
  const documents = [
    {
      id: "student-doc",
      author: 12,
      title: "Student A thesis",
      author_data: { name: "Student A" },
      submission: [row(87, "student-doc")],
    },
    {
      id: "other-doc",
      author: 13,
      title: "Student B thesis",
      author_data: { name: "Student B" },
      submission: [row(99, "other-doc")],
    },
    {
      id: "completed-doc",
      author: 14,
      title: "Student C thesis",
      author_data: { name: "Student C" },
      submission: [row(71, "completed-doc", "reviewed")],
    },
  ];
  const students = documents.map((doc) => ({
    id: doc.author,
    student_id: doc.author,
    advisor_id: 24,
    is_active: 1,
    is_first_advisor: 1,
    student: {
      id: doc.author,
      name: doc.author_data.name,
      identity_number: `NIM${doc.author}`,
    },
  }));
  const posts: { path: string; options: RequestInit }[] = [];
  const paths: string[] = [];
  const response = (data: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    data: structuredClone(data),
    headers: new Headers(),
  });
  const serializeRow = (item: ReturnType<typeof row>) => ({
    ...item,
    comment: lag
      ? []
      : comments.filter((comment) => comment.submission_id === item.id),
  });
  const serializeDoc = (doc: (typeof documents)[number]) => ({
    ...doc,
    submission: doc.submission.map(serializeRow),
  });
  const request = async (path: string, options: RequestInit = {}) => {
    paths.push(path);
    if (options.method === "POST") {
      posts.push({ path, options });
      beforeWrite?.();
      if (!allowed) return response({}, 403);
      const commentPath = /^\/submission\/(\d+)\/comment$/.exec(path);
      if (commentPath) {
        const input = JSON.parse(String(options.body));
        const comment = {
          id: comments.length + 1,
          submission_id: Number(commentPath[1]),
          advisor_id: Number(actor.accountId),
          comment: input.comment,
          commentator: { name: "Advisor D" },
          created_at: "2026-10-21T01:00:00Z",
        };
        comments.push(comment);
        afterWrite?.();
        return response({ data: comment }, 201);
      }
      const match = /^\/submission\/([^/]+)\/(on-review|review)$/.exec(path)!;
      const doc = documents.find((doc) => doc.id === match[1]);
      const item = doc?.submission.find((item) => item.status !== "reviewed");
      if (!item) return response({}, 404);
      item.status = match[2] === "review" ? "reviewed" : "on_review";
      if (item.status === "reviewed") item.reviewed_at = "2026-10-21T02:00:00Z";
      afterWrite?.();
      return response({ data: serializeRow(item) });
    }
    if (path === "/advisor/students")
      return actor.accountId === "24" && allowed
        ? response({ data: students })
        : response({}, 403);
    if (path === "/submission")
      return actor.accountId === "24" && allowed
        ? response({
            data: documents
              .map(serializeDoc)
              .map((doc) => ({
                ...doc,
                submission: doc.submission.filter(
                  (item) => item.status !== "reviewed",
                ),
              }))
              .filter((doc) => doc.submission.length),
          })
        : response({
            data: {
              document:
                documents.find(
                  (doc) => String(doc.author) === actor.accountId,
                ) ?? null,
            },
          });
    const detail = /^\/submission\/(\d+)\/detail$/.exec(path);
    if (detail) {
      const doc = documents.find((doc) =>
        doc.submission.some((item) => String(item.id) === detail[1]),
      );
      const item = doc?.submission.find(
        (item) => String(item.id) === detail[1],
      );
      return item?.status === "reviewed"
        ? response({
            data: { ...serializeRow(item), document: serializeDoc(doc!) },
          })
        : response({}, 404);
    }
    const doc = documents.find((doc) => path === `/submission/${doc.id}`);
    if (doc)
      return (allowed && actor.accountId === "24") ||
        String(doc.author) === actor.accountId
        ? response({ data: serializeDoc(doc) })
        : response({}, 401);
    return response({}, 404);
  };
  const submissions = new SubmissionClient({ session: () => actor, request });
  const transport = {
    request,
    read: () => structuredClone(store),
    write: (value: AdvisorStoreData) => {
      store = structuredClone(value);
    },
  };
  const client = new AdvisorClient(submissions, transport);
  const context = () => {
    const result = submissions.context();
    if (!result.ok) throw Error("No session");
    return result.data;
  };
  const input = (): AdvisorReviewInput => ({
    sessionId: context().sessionId,
    documentId: "student-doc",
    submissionId: "87",
  });
  const action = (
    kind: AdvisorReviewAction,
    text?: string,
  ): AdvisorActionInput => ({
    ...input(),
    action: kind,
    comment: text,
    requestId: crypto.randomUUID(),
  });
  return {
    client,
    posts,
    paths,
    documents,
    students,
    comments,
    context,
    input,
    action,
    rebuild: () => new AdvisorClient(submissions, transport),
    lag: (value: boolean) => {
      lag = value;
    },
    before: (value?: () => void) => {
      beforeWrite = value;
    },
    after: (value?: () => void) => {
      afterWrite = value;
    },
    revoke: () => {
      allowed = false;
    },
    account: (accountId: string) => {
      actor = { ...actor, accountId };
    },
    token: () => {
      actor = { ...actor, token: "new-token" };
    },
  };
};
const data = <T>(result: SubmissionResult<T>) => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.error.code);
  return result.data;
};

test("directory connects queue documents to active mentorship owners, without inventing IDs", async () => {
  const f = fixture();
  const directory = data(await f.client.directory());
  expect(directory.students[0]).toMatchObject({
    id: "12",
    name: "Student A",
    documents: [{ id: "student-doc" }],
  });
  expect(directory.students[2].documents).toEqual([]);
  expect(f.paths).toContain("/advisor/students");
  expect(f.posts).toHaveLength(0);
});

test("a completed document can be learned by explicit ID and survives a client restart", async () => {
  const f = fixture();
  const history = data(
    await f.client.history({
      sessionId: f.context().sessionId,
      studentId: "14",
      documentId: "completed-doc",
    }),
  );
  expect(history.items[0].status).toBe("reviewed");
  const directory = data(await f.rebuild().directory());
  expect(directory.students[2].documents).toEqual([
    { id: "completed-doc", title: "Student C thesis" },
  ]);
  expect(
    await f.client.history({
      sessionId: f.context().sessionId,
      studentId: "12",
      documentId: "other-doc",
    }),
  ).toMatchObject({ ok: false, error: { code: "forbidden" } });
});

test("start, comment, complete use document/submission IDs correctly and expose the result to the student", async () => {
  const f = fixture();
  expect(data(await f.client.action(f.action("start"))).submission.status).toBe(
    "on_review",
  );
  const comment = data(
    await f.client.action(f.action("comment", "Perbaiki bab 1")),
  );
  expect(comment.comments[0]).toMatchObject({
    text: "Perbaiki bab 1",
    authorId: "24",
    author: "Advisor D",
  });
  expect(
    data(await f.client.action(f.action("complete"))).submission.status,
  ).toBe("reviewed");
  expect(f.posts.map((post) => post.path)).toEqual([
    "/submission/student-doc/on-review",
    "/submission/87/comment",
    "/submission/student-doc/review",
  ]);
  expect(JSON.parse(String(f.posts[0].options.body))).toEqual({
    submission_id: "87",
  });
  expect(JSON.parse(String(f.posts[2].options.body))).toEqual({
    submission_id: "87",
  });
  expect(JSON.parse(String(f.posts[1].options.body))).toEqual({
    comment: "Perbaiki bab 1",
  });
  f.account("12");
  const student = data(await f.client.state(f.input()));
  expect(student.canReview).toBe(false);
  expect(student.comments[0].text).toBe("Perbaiki bab 1");
  expect(f.paths).toContain("/submission/87/detail");
  expect(f.documents[1].submission[0].status).toBe("waiting_for_review");
});

test("comments and completion require the selected submission to be the active on-review version", async () => {
  const f = fixture();
  expect(await f.client.action(f.action("comment", "Too early"))).toMatchObject(
    { ok: false, error: { code: "state_changed" } },
  );
  expect(await f.client.action(f.action("complete"))).toMatchObject({
    ok: false,
    error: { code: "state_changed" },
  });
  expect(f.posts).toHaveLength(0);
  f.documents[0].submission[0].status = "reviewed";
  f.documents[0].submission.unshift({
    ...f.documents[0].submission[0],
    id: 88,
    status: "waiting_for_review",
  });
  expect(await f.client.action(f.action("start"))).toMatchObject({
    ok: false,
    error: { code: "state_changed" },
  });
  expect(f.posts).toHaveLength(0);
});

test("200 Unicode characters are accepted and empty/overlong comments never POST", async () => {
  const f = fixture();
  f.documents[0].submission[0].status = "on_review";
  for (const text of ["", "   ", "a".repeat(201)])
    expect(await f.client.action(f.action("comment", text))).toMatchObject({
      ok: false,
      error: { code: "invalid_comment" },
    });
  expect(f.posts).toHaveLength(0);
  expect(
    data(await f.client.action(f.action("comment", "🙂".repeat(200))))
      .comments[0].text,
  ).toBe("🙂".repeat(200));
});

test("parallel clicks and replayed request IDs cannot duplicate comments", async () => {
  const f = fixture();
  f.documents[0].submission[0].status = "on_review";
  const input = f.action("comment", "One comment");
  const first = f.client.action(input);
  expect(await f.client.action(input)).toMatchObject({
    ok: false,
    error: { code: "busy" },
  });
  data(await first);
  data(await f.rebuild().action(input));
  expect(f.comments).toHaveLength(1);
  expect(f.posts).toHaveLength(1);
});

test("timeout after comment commit reconciles the exact new comment without another POST", async () => {
  const f = fixture();
  f.documents[0].submission[0].status = "on_review";
  f.after(() => {
    throw Error("Connection lost");
  });
  expect(
    data(await f.client.action(f.action("comment", "Saved once"))).pending,
  ).toBeNull();
  expect(f.comments).toHaveLength(1);
  expect(f.posts).toHaveLength(1);
});

test("a delayed timeout outcome stays durable, blocks resubmission, and resolves after history catches up", async () => {
  const f = fixture();
  f.documents[0].submission[0].status = "on_review";
  f.after(() => {
    f.lag(true);
    throw Error("Timeout");
  });
  expect(
    data(await f.client.action(f.action("comment", "Late result"))).pending
      ?.action,
  ).toBe("comment");
  const resumed = f.rebuild();
  expect(
    await resumed.action(f.action("comment", "Late result")),
  ).toMatchObject({ ok: false, error: { code: "outcome_unknown" } });
  f.lag(false);
  expect(data(await resumed.state(f.input())).pending).toBeNull();
  expect(f.posts).toHaveLength(1);
});

test("an unresolved POST timeout cannot use an older identical comment as confirmation", async () => {
  const f = fixture();
  f.documents[0].submission[0].status = "on_review";
  f.comments.push({
    id: 1,
    submission_id: 87,
    advisor_id: 24,
    comment: "Same text",
    commentator: { name: "Advisor D" },
    created_at: "2026-10-20T00:00:00Z",
  });
  f.before(() => {
    throw Error("Timeout before commit");
  });
  expect(
    data(await f.client.action(f.action("comment", "Same text"))).pending
      ?.comment,
  ).toBe("Same text");
  expect(data(await f.rebuild().state(f.input())).pending).not.toBeNull();
  expect(f.comments).toHaveLength(1);
});

test("revoked access and stale sessions cannot mutate or restore previous actor results", async () => {
  const f = fixture();
  const old = f.action("start");
  f.token();
  expect(await f.client.action(old)).toMatchObject({
    ok: false,
    error: { code: "session_changed" },
  });
  f.revoke();
  expect(await f.client.action(f.action("start"))).toMatchObject({ ok: false });
  expect(f.posts).toHaveLength(0);
});

test("a switched account after POST cannot receive the previous advisor state", async () => {
  const f = fixture();
  f.after(() => f.account("25"));
  expect(await f.client.action(f.action("start"))).toMatchObject({
    ok: false,
    error: { code: "session_changed" },
  });
  f.account("24");
  expect(data(await f.rebuild().state(f.input())).pending).toBeNull();
  expect(f.posts).toHaveLength(1);
});

test("a document-level transition returning a different submission is reported as changed", async () => {
  const f = fixture();
  f.before(() => {
    f.documents[0].submission[0].status = "reviewed";
    f.documents[0].submission.unshift({
      ...f.documents[0].submission[0],
      id: 88,
      status: "waiting_for_review",
    });
  });
  expect(await f.client.action(f.action("start"))).toMatchObject({
    ok: false,
    error: { code: "state_changed" },
  });
  expect(data(await f.client.state(f.input())).pending?.mismatch).toBe(true);
  expect(f.posts).toHaveLength(1);
});

test("student state hides pending comments and never grants advisor controls", async () => {
  const f = fixture();
  f.account("12");
  f.documents[0].submission[0].status = "on_review";
  f.comments.push({
    id: 1,
    submission_id: 87,
    advisor_id: 24,
    comment: "Pending comment",
    commentator: { name: "Advisor D" },
    created_at: "2026-10-21T00:00:00Z",
  });
  const state = data(await f.client.state(f.input()));
  expect(state.comments).toEqual([]);
  expect(state.canReview).toBe(false);
  expect(
    await f.client.action(f.action("comment", "Not allowed")),
  ).toMatchObject({ ok: false, error: { code: "forbidden" } });
  expect(f.posts).toHaveLength(0);
});

test("completed documents remain in the advisor directory and revoked mentorship records disappear", async () => {
  const f = fixture();
  data(await f.client.directory());
  f.documents[0].submission[0].status = "reviewed";
  expect(data(await f.rebuild().directory()).students[0].documents).toEqual([
    { id: "student-doc", title: "Student A thesis" },
  ]);
  f.students.splice(0, 1);
  expect(
    data(await f.client.directory()).students.some(
      (student) => student.id === "12",
    ),
  ).toBe(false);
  expect(await f.client.state(f.input())).toMatchObject({
    ok: false,
    error: { code: "forbidden" },
  });
});

test("opening a completed snapshot directly remembers its document for future history", async () => {
  const f = fixture();
  const directory = data(await f.client.directory());
  expect(directory.students[2].documents).toEqual([]);
  data(
    await f.client.state({
      ...f.input(),
      documentId: "completed-doc",
      submissionId: "71",
    }),
  );
  expect(data(await f.rebuild().directory()).students[2].documents).toEqual([
    { id: "completed-doc", title: "Student C thesis" },
  ]);
});

test("lost start and complete responses reconcile status without repeating either POST", async () => {
  const f = fixture();
  f.after(() => {
    throw Error("Response lost after commit");
  });
  const started = data(await f.client.action(f.action("start")));
  expect(started.submission.status).toBe("on_review");
  expect(started.pending).toBeNull();
  const completed = data(await f.client.action(f.action("complete")));
  expect(completed.submission.status).toBe("reviewed");
  expect(completed.pending).toBeNull();
  data(await f.rebuild().state(f.input()));
  expect(f.posts).toHaveLength(2);
});

test("a definitive access rejection is reported without changing review status", async () => {
  const f = fixture();
  f.before(() => f.revoke());
  expect(await f.client.action(f.action("start"))).toMatchObject({
    ok: false,
    error: { code: "forbidden", status: 403 },
  });
  expect(f.documents[0].submission[0].status).toBe("waiting_for_review");
  expect(f.posts).toHaveLength(1);
});

test("another active advisor recipient cannot gain review controls or send a POST", async () => {
  const f = fixture();
  f.documents[0].submission[0].recipient_id = 25;
  expect(await f.client.action(f.action("start"))).toMatchObject({
    ok: false,
    error: { code: "forbidden" },
  });
  expect(f.posts).toHaveLength(0);
});

test("another recipient pending submission does not prevent this advisor from reviewing their own", async () => {
  const f = fixture();
  f.documents[0].submission.unshift({
    ...f.documents[0].submission[0],
    id: 88,
    recipient_id: 25,
  });
  const state = await f.client.state(f.input());
  expect(state).toMatchObject({
    ok: true,
    data: { active: true, canReview: true },
  });
});
