export {};

declare global {
  type SubmissionStatus = "waiting_for_review" | "on_review" | "reviewed";
  interface ReviewSession {
    sessionId: string;
    serverUrl: string;
    accountId: string;
  }
  interface SubmissionSummary {
    id: string;
    documentId: string;
    title: string;
    studentName: string | null;
    ownerId: string | null;
    status: SubmissionStatus;
    createdAt: string | null;
    reviewedAt: string | null;
  }
  type SubmissionErrorCode =
    | "not_authenticated"
    | "session_changed"
    | "forbidden"
    | "not_found"
    | "invalid_response"
    | "integrity_failed"
    | "request_failed";
  type SubmissionResult<T> =
    | { ok: true; data: T }
    | {
        ok: false;
        error: { code: SubmissionErrorCode; status?: number };
      };
  interface SubmissionList {
    session: ReviewSession;
    audience: "advisor" | "student";
    items: SubmissionSummary[];
  }
  interface SubmissionSnapshot {
    session: ReviewSession;
    submissionId: string;
    documentId: string;
    sha256: string;
    file: Uint8Array;
  }
}
