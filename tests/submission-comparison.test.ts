import { expect, test } from "bun:test";
import { previousSubmission } from "../src/review/submission-comparison";
import { compareSubmissionSnapshots } from "../src/review/submission-comparison";
import { zipSync, strToU8 } from "fflate";
import { sha256Bytes } from "../src/utils/sha256";

const submission = (id: string, recipientId = "advisor", documentId = "doc"): SubmissionSummary => ({
  id, recipientId, documentId, title: "Thesis", ownerId: "student", studentName: "Student",
  status: "reviewed", createdAt: "2026-11-22T01:00:00Z", reviewedAt: null,
  recipientName: "Advisor", recipientRoles: {}, snapshotPurgedAt: null,
});

test("previous submission uses the same document and recipient, including equal timestamps", () => {
  const history = [submission("11"), submission("8"), submission("10", "other"), submission("9"), submission("10", "advisor", "other-doc")];
  expect(previousSubmission(submission("11"), history)?.id).toBe("9");
  expect(previousSubmission(submission("8"), history)).toBeUndefined();
  expect(previousSubmission(submission("missing"), history)).toBeUndefined();
});

test("purged previous snapshots remain explicit rather than silently comparing an older version", () => {
  const purged = { ...submission("2"), snapshotPurgedAt: "2026-11-22T02:00:00Z" };
  expect(previousSubmission(submission("3"), [submission("1"), purged, submission("3")])).toBe(purged);
});

test("comparison reads desktop and web snapshots without importing into a workspace", async () => {
  const encode = (value: unknown) => strToU8(JSON.stringify(value));
  const nodes = (text: string) => [{ type: "paragraph", attrs: { id: "source" }, content: [{ type: "text", text }] }];
  const desktop = zipSync({
    "manifest.json": encode({ format: "json", schema_version: 2, document: { id: "local-workspace-id", title: { id: "Thesis" } } }),
    "files/chapters/1.json": encode(nodes("Updated method")),
  });
  const web = zipSync({
    "manifest.json": encode({ format: "hightex", schema_version: 1, document: { id: "doc", title: { main: "Thesis" } }, structure: { chapters: [{ id: "1", file: "data/1.json" }] } }),
    "data/1.json": encode(nodes("Original method")),
  });
  const session = { sessionId: "session", accountId: "advisor", serverUrl: "https://fixture.test/" };
  const before = { session, documentId: "doc", submissionId: "1", file: web, sha256: await sha256Bytes(web) };
  const after = { session, documentId: "doc", submissionId: "2", file: desktop, sha256: await sha256Bytes(desktop) };
  const result = await compareSubmissionSnapshots(before, after);
  expect(result.sections.find(section => section.key === "chapters")?.entries[0]).toMatchObject({ status: "modified", beforeText: "Original method", afterText: "Updated method" });
  await expect(compareSubmissionSnapshots(before, { ...after, session: { ...session, accountId: "other" } })).rejects.toThrow("scope mismatch");
  await expect(compareSubmissionSnapshots(before, { ...after, sha256: "0".repeat(64) })).rejects.toThrow("integrity_failed");
});
