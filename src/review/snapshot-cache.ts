import type { SnapshotReadModel } from "./snapshot-reader";

// Memory only. Draft tables and cloud bindings never participate in this cache.
export class SnapshotCache {
  private scope: string | null = null;
  private entries = new Map<string, SnapshotReadModel>();

  useSession(session: ReviewSession) {
    const scope = JSON.stringify([
      session.serverUrl,
      session.accountId,
      session.sessionId,
    ]);
    if (scope !== this.scope) this.clear();
    this.scope = scope;
  }

  get(source: SubmissionSnapshot) {
    this.useSession(source.session);
    return this.entries.get(
      JSON.stringify([source.documentId, source.submissionId, source.sha256]),
    );
  }

  put(snapshot: SnapshotReadModel) {
    if (snapshot.source.kind !== "submission") return;
    const source = snapshot.source;
    this.useSession(source.session);
    const key = JSON.stringify([
      source.documentId,
      source.submissionId,
      snapshot.sha256,
    ]);
    this.entries.delete(key);
    this.entries.set(key, snapshot);
    while (this.entries.size > 3)
      this.entries.delete(this.entries.keys().next().value!);
  }

  clear() {
    this.entries.clear();
    this.scope = null;
  }
}

export const snapshotCache = new SnapshotCache();
