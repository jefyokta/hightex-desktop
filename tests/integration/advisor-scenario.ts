import assert from "node:assert/strict";
import {
  AdvisorClient,
  type AdvisorStoreData,
} from "../../electron/service/advisor-client";
import type { SubmissionClient } from "../../electron/service/submission-client";

// Read-only against the demo server. Review mutations are covered by fixtures.
export const advisorScenario = async (
  transport: {
    request(
      endpoint: string,
      options?: RequestInit,
    ): Promise<{ ok: boolean; status: number; data: unknown }>;
  },
  submissions: SubmissionClient,
  knownDocuments: { studentId: string; documentId: string }[],
) => {
  let store: AdvisorStoreData = { documents: {}, pending: {}, completed: [] };
  let requests = 0;
  const adapter = {
    request: async (endpoint: string, options?: RequestInit) => {
      assert.equal(options?.method ?? "GET", "GET");
      requests++;
      return transport.request(endpoint, options);
    },
    read: () => structuredClone(store),
    write: (value: AdvisorStoreData) => {
      store = structuredClone(value);
    },
  };
  const client = new AdvisorClient(submissions, adapter);
  const directory = await client.directory();
  if (!directory.ok)
    throw new Error(
      `Advisor directory: ${directory.error.code} HTTP ${directory.error.status}`,
    );
  let histories = 0,
    reviewed = 0,
    active = 0;
  for (const document of knownDocuments) {
    if (
      !directory.data.students.some(
        (student) => student.id === document.studentId,
      )
    )
      continue;
    const history = await client.history({
      sessionId: directory.data.session.sessionId,
      ...document,
    });
    if (!history.ok) throw new Error(`Advisor history: ${history.error.code}`);
    assert.equal(history.data.ownerId, document.studentId);
    histories++;
    for (const submission of history.data.items) {
      const state = await client.state({
        sessionId: directory.data.session.sessionId,
        documentId: document.documentId,
        submissionId: submission.id,
      });
      if (!state.ok) throw new Error(`Advisor state: ${state.error.code}`);
      assert.equal(state.data.canReview, true);
      assert.equal(state.data.pending, null);
      if (submission.status === "reviewed") reviewed++;
      else active++;
    }
  }
  const reloaded = await new AdvisorClient(submissions, adapter).directory();
  assert.equal(reloaded.ok, true);
  assert.equal(Object.keys(store.documents).length >= histories, true);
  console.log(
    JSON.stringify({
      advisorWorkflow: "read_only_verified",
      students: directory.data.students.length,
      queue: directory.data.queue.length,
      histories,
      reviewed,
      active,
      directoryRequests: requests,
      reviewWrites: 0,
    }),
  );
};
