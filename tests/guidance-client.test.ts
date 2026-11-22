import { expect, test } from "bun:test";
import { GuidanceClient } from "../electron/clients/guidance-client";

const session: ReviewSession = { sessionId: "session", accountId: "advisor", serverUrl: "https://fixture.test/api/" };
const target = { sessionId: session.sessionId, documentId: "doc", submissionId: "1" };
const payload = { data: { document_id: "doc", submission_id: "1", can_manage: true, can_progress: false, items: [] } };

test("guidance requests preserve explicit target and mutation identities", async () => {
  const calls: { endpoint: string; body?: string }[] = [];
  const client = new GuidanceClient({ context: () => ({ ok: true, data: session }) }, async (endpoint, options) => {
    calls.push({ endpoint, body: options?.body as string });
    return { ok: true, status: 200, data: payload };
  });
  expect((await client.list(target)).ok).toBe(true);
  await client.update({ ...target, revisionId: "revision", requestId: "request", version: 3, action: "ready" });
  expect(calls[1]).toEqual({ endpoint: "/submission/1/revisions/revision", body: JSON.stringify({ request_id: "request", version: 3, action: "ready" }) });
  expect(await client.list({ ...target, sessionId: "stale" })).toMatchObject({ ok: false, error: { code: "session_changed" } });
  expect(calls).toHaveLength(2);
});

test("guidance rejects mismatched documents and changed sessions without retrying writes", async () => {
  let active = true;
  const context = (): SubmissionResult<ReviewSession> => active ? { ok: true, data: session } : { ok: false, error: { code: "not_authenticated" } };
  const mismatched = new GuidanceClient({ context }, async () => ({ ok: true, status: 200, data: { data: { ...payload.data, document_id: "other" } } }));
  expect(await mismatched.list(target)).toMatchObject({ ok: false, error: { code: "invalid_response" } });
  const changed = new GuidanceClient({ context }, async () => { active = false; return { ok: true, status: 200, data: payload }; });
  expect(await changed.list(target)).toMatchObject({ ok: false, error: { code: "session_changed" } });
});

test("concurrent edit conflicts remain distinct from network errors", async () => {
  const client = new GuidanceClient({ context: () => ({ ok: true, data: session }) }, async () => ({ ok: false, status: 409, data: {} }));
  expect(await client.list(target)).toMatchObject({ ok: false, error: { code: "state_changed", status: 409 } });
});
