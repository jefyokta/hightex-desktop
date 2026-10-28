export {};

declare global {
  type SubmissionStatus = "waiting_for_review" | "on_review" | "reviewed";
  interface ReviewSession {
    sessionId: string;
    serverUrl: string;
    accountId: string;
  }
  interface SubmissionRecipient {
    id: string;
    name: string;
    roles: Record<string, string>;
  }
  interface SubmissionRecipients {
    session: ReviewSession;
    items: SubmissionRecipient[];
  }
  interface SubmissionPrepareInput extends CloudPushInput {
    recipientId: string;
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
    recipientId: string | null;
    recipientName: string | null;
    recipientRoles: Record<string, string>;
    snapshotPurgedAt: string | null;
    comments?: SubmissionComment[];
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
    | "invalid_recipient"
    | "recipient_required"
    | "invalid_comment"
    | "state_changed"
    | "busy"
    | "outcome_unknown"
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
    title?: string;
    items: SubmissionSummary[];
  }
  interface SubmissionDetail {
    submission: SubmissionSummary;
    comments: SubmissionComment[];
  }
  interface SubmissionComment {
    id: string;
    text: string;
    author: string | null;
    authorId?: string | null;
    createdAt: string | null;
  }
  interface AdvisorStudent {
    id: string;
    name: string;
    nim: string | null;
    advisorRole: "primary" | "secondary";
    documents: { id: string; title: string }[];
  }
  interface AdvisorDirectory {
    session: ReviewSession;
    students: AdvisorStudent[];
    queue: SubmissionSummary[];
  }
  type AdvisorReviewAction = "start" | "comment" | "complete";
  interface AdvisorPendingAction {
    requestId: string;
    documentId: string;
    submissionId: string;
    action: AdvisorReviewAction;
    comment?: string;
    baselineCommentIds: string[];
    commentId?: string;
    mismatch?: boolean;
  }
  interface AdvisorReviewState {
    session: ReviewSession;
    submission: SubmissionSummary;
    comments: SubmissionComment[];
    canReview: boolean;
    active: boolean;
    pending: AdvisorPendingAction | null;
  }
  interface AdvisorReviewInput {
    sessionId: string;
    documentId: string;
    submissionId: string;
  }
  interface AdvisorActionInput extends AdvisorReviewInput {
    requestId: string;
    action: AdvisorReviewAction;
    comment?: string;
  }
  interface AdvisorAPI {
    directory(): Promise<SubmissionResult<AdvisorDirectory>>;
    history(input: {
      sessionId: string;
      studentId: string;
      documentId: string;
    }): Promise<SubmissionResult<SubmissionHistory>>;
    state(
      input: AdvisorReviewInput,
    ): Promise<SubmissionResult<AdvisorReviewState>>;
    action(
      input: AdvisorActionInput,
    ): Promise<SubmissionResult<AdvisorReviewState>>;
  }
  interface SubmissionAttempt {
    // Optional for receipts persisted by older desktop versions. Never inferred on retry.
    recipientId?: string;
    recipientName?: string;
    recipientRoles?: Record<string, string>;
    id: string;
    serverUrl: string;
    accountId: string;
    localDocumentId: string;
    documentId: string;
    title: string;
    sha256: string;
    /** Written-content fingerprint; absent only in legacy receipts. */
    contentSha256?: string;
    baseline: string[];
    state: "uploaded" | "uncertain" | "unverified" | "submitted" | "mismatch";
    submissionId?: string;
    snapshotSha256?: string;
    error?: string;
  }
  interface SubmissionWorkflowAPI {
    pending(sessionId: string): Promise<SubmissionAttempt | null>;
    prepare(input: SubmissionPrepareInput): Promise<SubmissionAttempt>;
    submit(sessionId: string): Promise<SubmissionAttempt>;
    reconcile(sessionId: string): Promise<SubmissionAttempt>;
    discard(sessionId: string): Promise<void>;
  }
}
