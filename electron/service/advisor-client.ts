import {
  parseSubmissionComments,
  parseSubmissionList,
  type SubmissionClient,
} from "./submission-client";

export interface AdvisorStoreData {
  documents: Record<
    string,
    { studentId: string; documentId: string; title: string }
  >;
  pending: Record<string, AdvisorPendingAction>;
  completed: string[];
}
interface AdvisorTransport {
  request(
    endpoint: string,
    options?: RequestInit,
  ): Promise<{ ok: boolean; status: number; data: unknown }>;
  read(): AdvisorStoreData;
  write(data: AdvisorStoreData): void;
}
class ReviewError extends Error {
  constructor(
    readonly code: SubmissionErrorCode,
    readonly status?: number,
  ) {
    super(code);
  }
}
const fail = (code: SubmissionErrorCode, status?: number): never => {
  throw new ReviewError(code, status);
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("invalid_response");
  return value as Record<string, unknown>;
};
const id = (value: unknown): string => {
  if (
    (typeof value !== "string" &&
      !(typeof value === "number" && Number.isSafeInteger(value))) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(String(value))
  )
    return fail("invalid_response");
  return String(value);
};
const flag = (value: unknown) => value === true || value === 1 || value === "1";
const unwrap = <T>(result: SubmissionResult<T>): T =>
  result.ok ? result.data : fail(result.error.code, result.error.status);

export class AdvisorClient {
  private writing = false;
  constructor(
    private submissions: Pick<
      SubmissionClient,
      "context" | "list" | "history" | "detail"
    >,
    private transport: AdvisorTransport,
  ) {}

  private context(sessionId?: string) {
    const context = unwrap(this.submissions.context());
    if (sessionId !== undefined && sessionId !== context.sessionId)
      return fail("session_changed");
    return context;
  }
  private scope(session: ReviewSession) {
    return JSON.stringify([session.serverUrl, session.accountId]);
  }
  private key(session: ReviewSession, documentId: string, submissionId = "") {
    return JSON.stringify([
      session.serverUrl,
      session.accountId,
      documentId,
      submissionId,
    ]);
  }
  private async result<T>(
    action: () => Promise<T>,
  ): Promise<SubmissionResult<T>> {
    let session: ReviewSession | undefined;
    try {
      session = this.context();
      return { ok: true, data: await action() };
    } catch (error) {
      if (session) {
        const current = this.submissions.context();
        if (!current.ok || current.data.sessionId !== session.sessionId)
          return { ok: false, error: { code: "session_changed" } };
      }
      return {
        ok: false,
        error:
          error instanceof ReviewError
            ? { code: error.code, status: error.status }
            : { code: "request_failed" },
      };
    }
  }

  private async directoryData(
    session: ReviewSession,
  ): Promise<AdvisorDirectory> {
    const [queue, response] = await Promise.all([
      this.submissions.list(),
      this.transport.request("/advisor/students"),
    ]);
    this.context(session.sessionId);
    const listed = unwrap(queue);
    if (!response.ok)
      return fail(
        response.status === 401
          ? "not_authenticated"
          : response.status === 403
            ? "forbidden"
            : "request_failed",
        response.status,
      );
    if (listed.audience !== "advisor") return fail("forbidden");
    const data = object(response.data).data;
    if (!Array.isArray(data)) return fail("invalid_response");
    const seen = new Set<string>();
    const students = data
      .filter((value) => flag(object(value).is_active))
      .map((value): AdvisorStudent => {
        const mentorship = object(value);
        const student = object(mentorship.student);
        const studentId = id(student.id);
        if (
          id(mentorship.advisor_id) !== session.accountId ||
          id(mentorship.student_id) !== studentId ||
          seen.has(studentId) ||
          typeof student.name !== "string"
        )
          return fail("invalid_response");
        seen.add(studentId);
        return {
          id: studentId,
          name: student.name,
          nim:
            typeof student.identity_number === "string"
              ? student.identity_number
              : null,
          advisorRole: flag(mentorship.is_first_advisor)
            ? "primary"
            : "secondary",
          documents: [],
        };
      });
    const store = this.transport.read();
    const documents = { ...store.documents };
    const prefix = this.scope(session);
    // Forget revoked mentorships in this scope; other accounts keep their data.
    for (const [key, value] of Object.entries(documents))
      if (
        key.startsWith(prefix.slice(0, -1) + ",") &&
        !seen.has(value.studentId)
      )
        delete documents[key];
    for (const item of listed.items) {
      if (item.ownerId && seen.has(item.ownerId))
        documents[this.key(session, item.documentId)] = {
          studentId: item.ownerId,
          documentId: item.documentId,
          title: item.title,
        };
    }
    this.context(session.sessionId);
    this.transport.write({ ...store, documents });
    for (const student of students)
      student.documents = Object.entries(documents)
        .filter(
          ([key, value]) =>
            key.startsWith(prefix.slice(0, -1) + ",") &&
            value.studentId === student.id,
        )
        .map(([, value]) => ({ id: value.documentId, title: value.title }));
    return {
      session,
      students,
      queue: listed.items.filter(
        (item) => item.ownerId && seen.has(item.ownerId),
      ),
    };
  }

  directory() {
    return this.result(() => this.directoryData(this.context()));
  }

  private rememberHistory(session: ReviewSession, history: SubmissionHistory) {
    const store = this.transport.read();
    this.context(session.sessionId);
    this.transport.write({
      ...store,
      documents: {
        ...store.documents,
        [this.key(session, history.documentId)]: {
          studentId: history.ownerId,
          documentId: history.documentId,
          title: history.title ?? history.items[0]?.title ?? "",
        },
      },
    });
  }

  history(input: { sessionId: string; studentId: string; documentId: string }) {
    return this.result(async () => {
      const session = this.context(input.sessionId);
      id(input.documentId);
      id(input.studentId);
      const directory = await this.directoryData(session);
      if (!directory.students.some((student) => student.id === input.studentId))
        return fail("forbidden");
      const history = unwrap(await this.submissions.history(input));
      this.context(session.sessionId);
      if (history.ownerId !== input.studentId) return fail("forbidden");
      this.rememberHistory(session, history);
      return history;
    });
  }

  private completeReceipt(
    session: ReviewSession,
    pending: AdvisorPendingAction,
  ) {
    const store = this.transport.read();
    const remaining = { ...store.pending };
    delete remaining[
      this.key(session, pending.documentId, pending.submissionId)
    ];
    const completedKey = this.key(session, pending.requestId);
    this.context(session.sessionId);
    this.transport.write({
      ...store,
      pending: remaining,
      completed: [
        ...store.completed.filter((key) => key !== completedKey),
        completedKey,
      ].slice(-200),
    });
  }

  private async stateData(
    input: AdvisorReviewInput,
  ): Promise<AdvisorReviewState> {
    const session = this.context(input.sessionId);
    id(input.documentId);
    id(input.submissionId);
    const history = unwrap(await this.submissions.history(input));
    this.context(session.sessionId);
    const submission = history.items.find(
      (item) => item.id === input.submissionId,
    );
    if (!submission) return fail("not_found");
    let canReview = false;
    if (history.ownerId !== session.accountId) {
      const directory = await this.directoryData(session);
      canReview = directory.students.some(
        (student) => student.id === history.ownerId,
      );
      if (!canReview) return fail("forbidden");
    }
    const active = history.items.filter((item) => item.status !== "reviewed");
    let comments = submission.comments ?? [];
    if (submission.status === "reviewed")
      comments = unwrap(await this.submissions.detail(input)).comments;
    this.context(session.sessionId);
    if (canReview) this.rememberHistory(session, history);
    let pending: AdvisorPendingAction | null =
      this.transport.read().pending[
        this.key(session, input.documentId, input.submissionId)
      ] ?? null;
    if (pending && !pending.mismatch) {
      const confirmed =
        pending.action === "start"
          ? submission.status !== "waiting_for_review"
          : pending.action === "complete"
            ? submission.status === "reviewed"
            : comments.some(
                (comment) =>
                  !pending!.baselineCommentIds.includes(comment.id) &&
                  comment.text === pending!.comment &&
                  comment.authorId === session.accountId &&
                  (!pending!.commentId || comment.id === pending!.commentId),
              );
      if (confirmed) {
        this.completeReceipt(session, pending);
        pending = null;
      }
    }
    return {
      session,
      submission,
      comments: canReview || submission.status === "reviewed" ? comments : [],
      canReview,
      active: active.length === 1 && active[0].id === submission.id,
      pending,
    };
  }

  state(input: AdvisorReviewInput) {
    return this.result(() => this.stateData(input));
  }

  action(
    input: AdvisorActionInput,
  ): Promise<SubmissionResult<AdvisorReviewState>> {
    return this.result(async () => {
      const session = this.context(input?.sessionId);
      id(input?.requestId);
      id(input?.documentId);
      id(input?.submissionId);
      if (!["start", "comment", "complete"].includes(input.action))
        return fail("invalid_response");
      if (
        input.action === "comment" &&
        (typeof input.comment !== "string" ||
          !input.comment.trim() ||
          [...input.comment].length > 200)
      )
        return fail("invalid_comment");
      if (this.writing) return fail("busy");
      this.writing = true;
      try {
        const state = await this.stateData(input);
        if (
          this.transport
            .read()
            .completed.includes(this.key(session, input.requestId))
        )
          return state;
        if (state.pending) return fail("outcome_unknown");
        if (!state.canReview) return fail("forbidden");
        if (
          !state.active ||
          state.submission.status !==
            (input.action === "start" ? "waiting_for_review" : "on_review")
        )
          return fail("state_changed");
        const pending: AdvisorPendingAction = {
          requestId: input.requestId,
          documentId: input.documentId,
          submissionId: input.submissionId,
          action: input.action,
          comment: input.action === "comment" ? input.comment : undefined,
          baselineCommentIds: state.comments.map((comment) => comment.id),
        };
        const key = this.key(session, input.documentId, input.submissionId);
        const store = this.transport.read();
        this.context(session.sessionId);
        this.transport.write({
          ...store,
          pending: { ...store.pending, [key]: pending },
        });
        const endpoint =
          input.action === "comment"
            ? `/submission/${encodeURIComponent(input.submissionId)}/comment`
            : `/submission/${encodeURIComponent(input.documentId)}/${input.action === "start" ? "on-review" : "review"}`;
        let response;
        try {
          response = await this.transport.request(endpoint, {
            method: "POST",
            signal: AbortSignal.timeout(30000),
            ...(input.action === "comment"
              ? {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ comment: input.comment }),
                }
              : {}),
          });
        } catch {
          this.context(session.sessionId);
          return await this.stateData(input);
        }
        this.context(session.sessionId);
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) {
            const current = this.transport.read();
            const remaining = { ...current.pending };
            delete remaining[key];
            this.transport.write({ ...current, pending: remaining });
            return fail(
              response.status === 422
                ? "invalid_comment"
                : response.status === 401 || response.status === 403
                  ? "forbidden"
                  : "state_changed",
              response.status,
            );
          }
          return this.stateData(input);
        }
        try {
          const result = object(object(response.data).data);
          if (input.action === "comment") {
            const comment = parseSubmissionComments(
              [result],
              input.submissionId,
            )[0];
            if (
              comment.text !== input.comment ||
              comment.authorId !== session.accountId ||
              response.status !== 201
            )
              return fail("invalid_response");
            const current = this.transport.read();
            this.transport.write({
              ...current,
              pending: {
                ...current.pending,
                [key]: { ...pending, commentId: comment.id },
              },
            });
          } else {
            const parsed = parseSubmissionList({
              data: {
                document: {
                  id: input.documentId,
                  title: state.submission.title,
                  author: state.submission.ownerId,
                  submission: [result],
                },
              },
            }).items[0];
            if (
              parsed.id !== input.submissionId ||
              parsed.status !==
                (input.action === "start" ? "on_review" : "reviewed") ||
              response.status !== 200
            )
              return fail("state_changed");
          }
        } catch {
          const current = this.transport.read();
          this.transport.write({
            ...current,
            pending: {
              ...current.pending,
              [key]: { ...pending, mismatch: true },
            },
          });
          return fail("state_changed");
        }
        return this.stateData(input);
      } finally {
        this.writing = false;
      }
    });
  }
}
