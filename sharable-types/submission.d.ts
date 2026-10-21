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
    | "active_submission"
    | "invalid_document"
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
  interface SubmissionHistory {
    session: ReviewSession;
    documentId: string;
    ownerId: string;
    items: SubmissionSummary[];
  }
  interface SubmissionDetail {
    submission: SubmissionSummary;
    comments: {
      id: string;
      text: string;
      author: string | null;
      createdAt: string | null;
    }[];
  }
  interface SubmissionAttempt {
    id: string;
    serverUrl: string;
    accountId: string;
    localDocumentId: string;
    documentId: string;
    title: string;
    sha256: string;
    baseline: string[];
    state: "uploaded" | "uncertain" | "unverified" | "submitted" | "mismatch";
    submissionId?: string;
    snapshotSha256?: string;
    error?: string;
  }
  interface SubmissionWorkflowAPI {
    pending(sessionId: string): Promise<SubmissionAttempt | null>;
    prepare(input: CloudPushInput): Promise<SubmissionAttempt>;
    submit(sessionId: string): Promise<SubmissionAttempt>;
    reconcile(sessionId: string): Promise<SubmissionAttempt>;
    discard(sessionId: string): Promise<void>;
  }
}
