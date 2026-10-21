import { createHash, randomUUID } from "node:crypto";

interface SessionCredentials {
  serverUrl: string;
  accountId: string;
  token: string;
}
interface SubmissionTransport {
  session(): SessionCredentials | null;
  request(
    endpoint: string,
    options?: RequestInit,
  ): Promise<{ ok: boolean; status: number; data: unknown; headers: Headers }>;
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid response");
  return value as Record<string, unknown>;
};
const id = (value: unknown) => {
  const result =
    typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : value;
  if (typeof result !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(result))
    throw new Error("Invalid ID");
  return result;
};
const text = (value: unknown) => (typeof value === "string" ? value : null);

export const parseSubmissionComments = (
  value: unknown,
  submissionId: string,
): SubmissionComment[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Invalid comments");
  return value.map((value) => {
    const comment = record(value);
    if (
      id(comment.submission_id) !== submissionId ||
      typeof comment.comment !== "string"
    )
      throw new Error("Invalid comment");
    return {
      id: id(comment.id),
      text: comment.comment,
      author: comment.commentator
        ? text(record(comment.commentator).name)
        : null,
      authorId: comment.advisor_id == null ? null : id(comment.advisor_id),
      createdAt: text(comment.created_at),
    };
  });
};

// The two shapes follow Api/Submission::index in the connected backend source.
export const parseSubmissionList = (
  value: unknown,
): Omit<SubmissionList, "session"> => {
  const data = record(value).data;
  const audience = Array.isArray(data) ? "advisor" : "student";
  const documents =
    audience === "advisor"
      ? (data as unknown[])
      : [record(data).document].filter((document) => document !== null);
  const items = documents.flatMap((value) => {
    const document = record(value);
    const documentId = id(document.id);
    if (!Array.isArray(document.submission))
      throw new Error("Invalid submissions");
    const author = document.author_data ? record(document.author_data) : null;
    return document.submission.map((value): SubmissionSummary => {
      const submission = record(value);
      if (id(submission.document_id) !== documentId)
        throw new Error("Document mismatch");
      const status = submission.status;
      if (
        status !== "waiting_for_review" &&
        status !== "on_review" &&
        status !== "reviewed"
      )
        throw new Error("Unknown status");
      return {
        id: id(submission.id),
        documentId,
        title: text(document.title) ?? "",
        studentName: text(author?.name),
        ownerId: document.author == null ? null : id(document.author),
        status,
        createdAt: text(submission.created_at),
        reviewedAt: text(submission.reviewed_at),
        comments: parseSubmissionComments(
          submission.comment,
          id(submission.id),
        ),
      };
    });
  });
  return { audience, items };
};

export class SubmissionClient {
  private credentials?: SessionCredentials;
  private current?: ReviewSession;

  constructor(private transport: SubmissionTransport) {}

  context(): SubmissionResult<ReviewSession> {
    const credentials = this.transport.session();
    if (!credentials) {
      this.credentials = undefined;
      this.current = undefined;
      return { ok: false, error: { code: "not_authenticated" } };
    }
    if (
      !this.credentials ||
      this.credentials.token !== credentials.token ||
      this.credentials.accountId !== credentials.accountId ||
      this.credentials.serverUrl !== credentials.serverUrl
    ) {
      this.credentials = { ...credentials };
      this.current = {
        accountId: credentials.accountId,
        serverUrl: credentials.serverUrl,
        sessionId: randomUUID(),
      };
    }
    return { ok: true, data: { ...this.current! } };
  }

  private isCurrent(session: ReviewSession) {
    const current = this.context();
    return current.ok && current.data.sessionId === session.sessionId;
  }

  private failure(status: number): SubmissionResult<never> {
    const code =
      status === 401
        ? "not_authenticated"
        : status === 403
          ? "forbidden"
          : status === 404
            ? "not_found"
            : status === 409
              ? "active_submission"
              : status === 422
                ? "invalid_document"
                : "request_failed";
    return { ok: false, error: { code, status } };
  }

  async list(): Promise<SubmissionResult<SubmissionList>> {
    const context = this.context();
    if (!context.ok) return context;
    try {
      const response = await this.transport.request("/submission");
      if (!this.isCurrent(context.data))
        return { ok: false, error: { code: "session_changed" } };
      if (!response.ok) return this.failure(response.status);
      try {
        return {
          ok: true,
          data: {
            ...parseSubmissionList(response.data),
            session: context.data,
          },
        };
      } catch {
        return { ok: false, error: { code: "invalid_response" } };
      }
    } catch {
      return {
        ok: false,
        error: {
          code: this.isCurrent(context.data)
            ? "request_failed"
            : "session_changed",
        },
      };
    }
  }

  async file(input: {
    sessionId: string;
    submissionId: string;
    documentId: string;
  }): Promise<SubmissionResult<SubmissionSnapshot>> {
    const context = this.context();
    if (!context.ok) return context;
    if (!input || typeof input !== "object")
      return { ok: false, error: { code: "invalid_response" } };
    if (input.sessionId !== context.data.sessionId)
      return { ok: false, error: { code: "session_changed" } };
    try {
      id(input.submissionId);
      id(input.documentId);
    } catch {
      return { ok: false, error: { code: "invalid_response" } };
    }
    try {
      const response = await this.transport.request(
        `/submission/${encodeURIComponent(input.submissionId)}/file`,
      );
      if (!this.isCurrent(context.data))
        return { ok: false, error: { code: "session_changed" } };
      if (!response.ok) return this.failure(response.status);
      const sha256 = response.headers.get("X-HighTex-SHA256")?.toLowerCase();
      const documentId = response.headers.get("X-Document-ID");
      if (
        !(response.data instanceof Uint8Array) ||
        !response.data.length ||
        !sha256 ||
        !/^[a-f0-9]{64}$/.test(sha256) ||
        documentId !== input.documentId
      ) {
        return { ok: false, error: { code: "invalid_response" } };
      }
      const actual = createHash("sha256").update(response.data).digest("hex");
      if (actual !== sha256)
        return { ok: false, error: { code: "integrity_failed" } };
      return {
        ok: true,
        data: {
          session: context.data,
          submissionId: input.submissionId,
          documentId,
          sha256,
          file: response.data,
        },
      };
    } catch {
      return {
        ok: false,
        error: {
          code: this.isCurrent(context.data)
            ? "request_failed"
            : "session_changed",
        },
      };
    }
  }

  async history(input: {
    sessionId: string;
    documentId: string;
  }): Promise<SubmissionResult<SubmissionHistory>> {
    const context = this.context();
    if (!context.ok) return context;
    if (input?.sessionId !== context.data.sessionId)
      return { ok: false, error: { code: "session_changed" } };
    let received = false;
    try {
      id(input.documentId);
      const response = await this.transport.request(
        `/submission/${encodeURIComponent(input.documentId)}`,
      );
      received = true;
      if (!this.isCurrent(context.data))
        return { ok: false, error: { code: "session_changed" } };
      if (!response.ok) return this.failure(response.status);
      const document = record(record(response.data).data);
      if (id(document.id) !== input.documentId)
        throw new Error("Document mismatch");
      return {
        ok: true,
        data: {
          session: context.data,
          documentId: input.documentId,
          ownerId: id(document.author),
          title: text(document.title) ?? "",
          items: parseSubmissionList({ data: { document } }).items,
        },
      };
    } catch {
      return {
        ok: false,
        error: {
          code: this.isCurrent(context.data)
            ? received
              ? "invalid_response"
              : "request_failed"
            : "session_changed",
        },
      };
    }
  }

  async create(input: {
    sessionId: string;
    documentId: string;
  }): Promise<SubmissionResult<SubmissionSummary>> {
    const context = this.context();
    if (!context.ok) return context;
    if (input?.sessionId !== context.data.sessionId)
      return { ok: false, error: { code: "session_changed" } };
    try {
      id(input.documentId);
      const response = await this.transport.request("/submission", {
        method: "POST",
        signal: AbortSignal.timeout(30000),
      });
      if (!this.isCurrent(context.data))
        return { ok: false, error: { code: "session_changed" } };
      if (!response.ok) return this.failure(response.status);
      const submission = record(record(response.data).data);
      const document = record(submission.document);
      if (response.status !== 201 || id(document.id) !== input.documentId)
        throw new Error("Document mismatch");
      const items = parseSubmissionList({
        data: { document: { ...document, submission: [submission] } },
      }).items;
      return { ok: true, data: items[0] };
    } catch {
      return {
        ok: false,
        error: {
          code: this.isCurrent(context.data)
            ? "request_failed"
            : "session_changed",
        },
      };
    }
  }

  async detail(input: {
    sessionId: string;
    documentId: string;
    submissionId: string;
  }): Promise<SubmissionResult<SubmissionDetail>> {
    const context = this.context();
    if (!context.ok) return context;
    if (input?.sessionId !== context.data.sessionId)
      return { ok: false, error: { code: "session_changed" } };
    let received = false;
    try {
      id(input.submissionId);
      id(input.documentId);
      const response = await this.transport.request(
        `/submission/${encodeURIComponent(input.submissionId)}/detail`,
      );
      received = true;
      if (!this.isCurrent(context.data))
        return { ok: false, error: { code: "session_changed" } };
      if (!response.ok) return this.failure(response.status);
      const submission = record(record(response.data).data);
      const document = record(submission.document);
      if (
        id(document.id) !== input.documentId ||
        id(submission.id) !== input.submissionId ||
        submission.status !== "reviewed" ||
        !Array.isArray(submission.comment)
      )
        throw new Error("Submission mismatch");
      return {
        ok: true,
        data: {
          submission: parseSubmissionList({
            data: { document: { ...document, submission: [submission] } },
          }).items[0],
          comments: parseSubmissionComments(
            submission.comment,
            input.submissionId,
          ),
        },
      };
    } catch {
      return {
        ok: false,
        error: {
          code: this.isCurrent(context.data)
            ? received
              ? "invalid_response"
              : "request_failed"
            : "session_changed",
        },
      };
    }
  }
}
