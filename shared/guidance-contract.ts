export type RevisionStatus = "open" | "in_progress" | "ready" | "resolved";
export type RevisionAction = RevisionStatus | "reply";
export interface RevisionAnchor {
  snapshotSha256: string;
  chapterId: string;
  path: number[];
  nodeId?: string;
  quote: string;
}
export interface RevisionEvent {
  id: string;
  requestId: string;
  authorId: string;
  author: string | null;
  action: RevisionAction | "created";
  message: string | null;
  createdAt: string | null;
}
export interface GuidanceRevision {
  id: string;
  submissionId: string;
  reviewerId: string;
  instruction: string;
  anchor: RevisionAnchor;
  status: RevisionStatus;
  version: number;
  createdAt: string | null;
  events: RevisionEvent[];
}
export interface GuidanceTarget {
  sessionId: string;
  documentId: string;
  submissionId: string;
}
export interface GuidanceList {
  session: ReviewSession;
  documentId: string;
  submissionId: string;
  recipientId: string | null;
  canManage: boolean;
  canProgress: boolean;
  items: GuidanceRevision[];
}
export interface CreateRevision extends GuidanceTarget {
  id: string;
  instruction: string;
  anchor: RevisionAnchor;
}
export interface UpdateRevision extends GuidanceTarget {
  revisionId: string;
  requestId: string;
  version: number;
  action: RevisionAction;
  message?: string;
}
export interface GuidanceAPI {
  list(input: GuidanceTarget): Promise<SubmissionResult<GuidanceList>>;
  create(input: CreateRevision): Promise<SubmissionResult<GuidanceList>>;
  update(input: UpdateRevision): Promise<SubmissionResult<GuidanceList>>;
}
