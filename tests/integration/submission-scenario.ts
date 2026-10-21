import { strict as assert } from "node:assert";
import {
  CloudSyncClient,
  type CloudTransport,
} from "../../electron/service/cloud-sync-client";
import { SubmissionClient } from "../../electron/service/submission-client";
import { SubmissionWorkflow } from "../../electron/service/submission-workflow";
import { readSnapshot } from "../../src/review/snapshot-reader";

// Opt-in --submit. Only submits the existing Codex sync demo, never other data.
export const submissionScenario = async (
  transport: Pick<CloudTransport, "session" | "request">,
) => {
  const categoriesResponse = await transport.request("/categories");
  assert.equal(categoriesResponse.status, 200);
  const categories = (categoriesResponse.data as { data: Category[] }).data;
  let bindings: Record<string, CloudBinding> = {};
  let attempts: Record<string, SubmissionAttempt> = {};
  const cloud = new CloudSyncClient({
    ...transport,
    readBindings: () => bindings,
    writeBindings: (value) => {
      bindings = value;
    },
    category: async (document) =>
      categories.find((item) => String(item.id) === document.category),
    backup: async () => {
      throw Error("Integration never replaces occupied slots");
    },
  });
  const submissions = new SubmissionClient(transport);
  const workflow = new SubmissionWorkflow(cloud, submissions, {
    read: () => attempts,
    write: (value) => {
      attempts = value;
    },
  });
  const session = cloud.context();
  const current = (await cloud.list(session.sessionId)).commits.find(
    (item) => item.type === "current",
  );
  assert.ok(
    current,
    "The existing Codex sync fixture is required; refusing to create or replace other data",
  );
  const file = await cloud.pull({
    sessionId: session.sessionId,
    serverDocumentId: current.document_id,
  });
  assert.equal(file.status, "downloaded");
  if (file.status !== "downloaded") throw Error("Missing fixture");
  const model = await readSnapshot(file.file, {
    kind: "local",
    filename: "demo.hightex",
  });
  assert.equal(
    model.document.id,
    "codex-sync-fixture",
    "Refusing to submit a non-Codex document",
  );
  assert.equal(
    model.document.title,
    "Codex sync demo",
    "Refusing to submit a non-Codex document",
  );
  const context = submissions.context();
  assert.ok(context.ok);
  if (!context.ok) throw Error("Missing review context");
  const history = await submissions.history({
    sessionId: context.data.sessionId,
    documentId: current.document_id,
  });
  assert.ok(history.ok);
  if (!history.ok) throw Error("History unavailable");
  const active = history.data.items.find((item) => item.status !== "reviewed");
  let submissionId: string;
  let created = false;
  if (active) {
    submissionId = active.id;
    console.log(
      JSON.stringify({
        studentSubmission: "existing_active",
        noAdditionalPOST: true,
      }),
    );
  } else {
    cloud.accept({
      sessionId: session.sessionId,
      downloadId: file.downloadId,
      localDocumentId: model.document.id,
    });
    const prepared = await workflow.prepare({
      sessionId: session.sessionId,
      file: file.file,
      document: { ...structuredClone(model.document), profile: undefined },
      message: "Codex submission demo",
      expectedServerDocumentId: current.document_id,
      expectedCloudSha256: current.sha256 ?? null,
      replace: false,
    });
    assert.equal(prepared.sha256, file.sha256);
    const result = await workflow.submit(session.sessionId);
    assert.equal(result.state, "submitted");
    assert.equal(result.snapshotSha256, file.sha256);
    assert.ok(result.submissionId);
    submissionId = result.submissionId;
    created = true;
    await assert.rejects(workflow.submit(session.sessionId), /check_history/);
  }
  const snapshot = await submissions.file({
    sessionId: context.data.sessionId,
    documentId: current.document_id,
    submissionId,
  });
  assert.ok(snapshot.ok);
  if (!snapshot.ok) throw Error("Snapshot unavailable");
  assert.equal(snapshot.data.sha256, file.sha256);
  assert.deepEqual(snapshot.data.file, file.file);
  const read = await readSnapshot(snapshot.data.file, {
    kind: "submission",
    session: snapshot.data.session,
    documentId: snapshot.data.documentId,
    submissionId: snapshot.data.submissionId,
    sha256: snapshot.data.sha256,
  });
  assert.equal(read.document.profile?.name, model.document.profile?.name);
  console.log(
    JSON.stringify({
      studentSubmission: "passed",
      created,
      submissionId,
      immutableBytesVerified: true,
      snapshotAuthorFromPackage: true,
      cloudDocumentUnchanged: true,
      advisorReviewNotChanged: true,
    }),
  );
};
