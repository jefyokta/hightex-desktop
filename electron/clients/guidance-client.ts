import type { CreateRevision, GuidanceAPI, GuidanceList, GuidanceRevision, GuidanceTarget, UpdateRevision } from "../../shared/guidance-contract";
import type { SubmissionClient } from "./submission-client";

type Request = (endpoint: string, options?: RequestInit) => Promise<{ ok: boolean; status: number; data: unknown }>;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid revision response");
  return value as Record<string, unknown>;
}

/** Decode remote data once, retaining the server's authorization and source identity. */
export function parseGuidanceList(value: unknown, target: GuidanceTarget, session: ReviewSession): GuidanceList {
  const data = object(object(value).data);
  if (String(data.document_id) !== target.documentId || String(data.submission_id) !== target.submissionId
    || typeof data.can_manage !== "boolean" || typeof data.can_progress !== "boolean" || !Array.isArray(data.items)) throw Error("Revision scope mismatch");
  for (const raw of data.items) {
    const item = object(raw), anchor = object(item.anchor);
    if (typeof item.id !== "string" || item.submissionId !== target.submissionId || typeof item.reviewerId !== "string"
      || typeof item.instruction !== "string" || !["open", "in_progress", "ready", "resolved"].includes(String(item.status))
      || !Number.isSafeInteger(item.version) || Number(item.version) < 1 || !Array.isArray(item.events)
      || typeof anchor.snapshotSha256 !== "string" || !/^[a-f0-9]{64}$/.test(anchor.snapshotSha256)
      || typeof anchor.chapterId !== "string" || typeof anchor.quote !== "string" || !Array.isArray(anchor.path)
      || anchor.path.some(index => !Number.isSafeInteger(index) || index < 0)
      || (anchor.nodeId != null && typeof anchor.nodeId !== "string")) throw Error("Invalid revision fields");
    for (const rawEvent of item.events) {
      const event = object(rawEvent);
      if (typeof event.id !== "string" || typeof event.requestId !== "string" || typeof event.authorId !== "string"
        || !["created", "reply", "open", "in_progress", "ready", "resolved"].includes(String(event.action))
        || (event.author !== null && typeof event.author !== "string")
        || (event.message !== null && typeof event.message !== "string")) throw Error("Invalid revision event");
    }
  }
  return {
    session, documentId: target.documentId, submissionId: target.submissionId,
    recipientId: data.recipient_id == null ? null : String(data.recipient_id),
    canManage: data.can_manage, canProgress: data.can_progress,
    items: data.items as GuidanceRevision[],
  };
}

export class GuidanceClient implements GuidanceAPI {
  constructor(private readonly submissions: Pick<SubmissionClient, "context">, private readonly request: Request) {}

  list(input: GuidanceTarget) {
    return this.send(input);
  }

  create(input: CreateRevision) {
    return this.send(input, {
      method: "POST", body: JSON.stringify({ id: input.id, instruction: input.instruction, anchor: input.anchor }),
    });
  }

  update(input: UpdateRevision) {
    return this.send(input, {
      method: "PATCH", body: JSON.stringify({ request_id: input.requestId, version: input.version, action: input.action, message: input.message }),
    }, input.revisionId);
  }

  private async send(input: GuidanceTarget, options?: RequestInit, revisionId?: string): Promise<SubmissionResult<GuidanceList>> {
    const session = this.submissions.context();
    if (!session.ok) return session;
    if (input?.sessionId !== session.data.sessionId) return { ok: false, error: { code: "session_changed" } };
    const current = () => {
      const context = this.submissions.context();
      return context.ok && context.data.sessionId === input.sessionId;
    };
    let received = false;
    try {
      const suffix = revisionId === undefined ? "" : `/${encodeURIComponent(revisionId)}`;
      const response = await this.request(`/submission/${encodeURIComponent(input.submissionId)}/revisions${suffix}`, {
        ...options, headers: { "Content-Type": "application/json" },
      });
      received = true;
      if (!current()) return { ok: false, error: { code: "session_changed" } };
      if (!response.ok) return { ok: false, error: {
        code: response.status === 401 ? "not_authenticated" : response.status === 403 ? "forbidden"
          : response.status === 404 ? "not_found" : response.status === 409 ? "state_changed" : "request_failed",
        status: response.status,
      } };
      return { ok: true, data: parseGuidanceList(response.data, input, session.data) };
    } catch {
      return { ok: false, error: { code: !current() ? "session_changed" : received ? "invalid_response" : "request_failed" } };
    }
  }
}
