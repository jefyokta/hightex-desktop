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
}
