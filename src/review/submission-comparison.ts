import { compareDocumentModels } from "@/editor/storage/document-comparison";
import { readSnapshot } from "./snapshot-reader";

export function recipientSubmissionHistory(current: Pick<SubmissionSummary, "documentId" | "recipientId">, history: readonly SubmissionSummary[]) {
  if (!current.recipientId) return [];
  return history.filter(item => item.documentId === current.documentId && item.recipientId === current.recipientId)
    .slice().sort((left, right) => {
      const time = Date.parse(left.createdAt ?? "") - Date.parse(right.createdAt ?? "");
      return (Number.isFinite(time) && time !== 0 ? time : left.id.localeCompare(right.id, "en", { numeric: true }));
    });
}

/** Previous means immediately preceding submission to the same recipient, including purged records. */
export function previousSubmission(current: SubmissionSummary, history: readonly SubmissionSummary[]) {
  const ordered = recipientSubmissionHistory(current, history);
  const index = ordered.findIndex(item => item.id === current.id);
  return index > 0 ? ordered[index - 1] : undefined;
}

export async function compareSubmissionSnapshots(before: SubmissionSnapshot, after: SubmissionSnapshot) {
  if (before.documentId !== after.documentId || before.session.accountId !== after.session.accountId
    || before.session.serverUrl !== after.session.serverUrl || before.session.sessionId !== after.session.sessionId) {
    throw Error("Submission comparison scope mismatch");
  }
  // Verify both portable snapshots at the existing read boundary before comparing their models.
  const snapshots = await Promise.all([before, after].map(snapshot => readSnapshot(snapshot.file, {
    kind: "submission", ...snapshot,
  })));
  const [main, branch] = await Promise.all(snapshots.map(snapshot => snapshot.renderModel()));
  // Archive IDs belong to local workspaces. The authenticated snapshot envelope
  // owns server document identity, and readSnapshot verifies its content hash.
  return compareDocumentModels(main, branch);
}
