import { createHash, randomUUID } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import type { CloudSyncClient } from "./cloud-sync-client";
import type { SubmissionClient } from "./submission-client";

interface WorkflowStore {
  read(): Record<string, SubmissionAttempt>;
  write(attempts: Record<string, SubmissionAttempt>): void;
}
const fail = (code: string): never => {
  throw new Error(`submission_error:${code}`);
};

// Only upload artifacts made by the desktop exporter. Validation does not
// import a draft, read the actor profile, or change any compiler behavior.
const validateArtifact = (input: CloudPushInput) => {
  if (
    !(input.file instanceof Uint8Array) ||
    !input.file.length ||
    input.file.length > 64 * 1024 * 1024
  )
    return fail("invalid_document");
  try {
    let total = 0;
    const entries = unzipSync(input.file, {
      filter: (entry) => {
        total += entry.originalSize;
        if (total > 128 * 1024 * 1024) throw new Error("Archive too large");
        return (
          entry.name === "manifest.json" ||
          entry.name === "files/profile.json" ||
          /^files\/chapters\/.+\.json$/.test(entry.name)
        );
      },
    });
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
    const profile = JSON.parse(strFromU8(entries["files/profile.json"]));
    const hasContent = (value: unknown): boolean => {
      if (Array.isArray(value)) return value.some(hasContent);
      if (!value || typeof value !== "object") return false;
      const node = value as { text?: string; type?: string; content?: unknown };
      return Boolean(
        node.text?.trim() ||
        ["image", "blockMath", "mathInline"].includes(node.type ?? "") ||
        hasContent(node.content),
      );
    };
    if (
      manifest.version !== 2 ||
      manifest.format !== "json" ||
      manifest.document?.id !== input.document.id ||
      String(manifest.document.category) !== input.document.category ||
      manifest.document.title?.id !== input.document.title ||
      !input.document.title.trim() ||
      typeof profile.name !== "string" ||
      !profile.name.trim() ||
      typeof profile.nim !== "string" ||
      !profile.nim.trim() ||
      !Object.entries(entries).some(
        ([path, data]) =>
          path.startsWith("files/chapters/") &&
          hasContent(JSON.parse(strFromU8(data))),
      )
    )
      throw new Error("Incomplete artifact");
  } catch {
    return fail("invalid_document");
  }
};

/** Receipts survive renderer navigation and restarts; retries never re-export. */
export class SubmissionWorkflow {
  private busy = false;

  constructor(
    private cloud: Pick<
      CloudSyncClient,
      "context" | "binding" | "push" | "list" | "pull"
    >,
    private submissions: Pick<
      SubmissionClient,
      "context" | "history" | "create" | "file" | "recipients"
    >,
    private store: WorkflowStore,
    private validateStored?: (input: {
      sessionId: string;
      file: Uint8Array;
      serverDocumentId: string;
    }) => Promise<void>,
  ) {}

  private context(sessionId: string) {
    const session = this.cloud.context();
    const review = this.submissions.context();
    if (
      session.sessionId !== sessionId ||
      !review.ok ||
      review.data.accountId !== session.accountId ||
      review.data.serverUrl !== session.serverUrl
    )
      return fail("session_changed");
    return { session, review: review.data };
  }

  private key(session: CloudSession) {
    return JSON.stringify([session.serverUrl, session.accountId]);
  }

  pending(sessionId: string): SubmissionAttempt | null {
    const { session } = this.context(sessionId);
    return structuredClone(this.store.read()[this.key(session)] ?? null);
  }

  private save(sessionId: string, attempt: SubmissionAttempt) {
    const { session } = this.context(sessionId);
    if (
      attempt.accountId !== session.accountId ||
      attempt.serverUrl !== session.serverUrl
    )
      return fail("session_changed");
    this.store.write({
      ...this.store.read(),
      [this.key(session)]: structuredClone(attempt),
    });
    return structuredClone(attempt);
  }

  private async recipient(sessionId: string, recipientId?: string) {
    if (!recipientId) return fail("recipient_required");
    const { review } = this.context(sessionId);
    const result = await this.submissions.recipients({
      sessionId: review.sessionId,
    });
    this.context(sessionId);
    if (!result.ok) return fail(result.error.code);
    const recipient = result.data.items.find((item) => item.id === recipientId);
    return recipient ?? fail("invalid_recipient");
  }

  private async history(sessionId: string, documentId: string) {
    const { session, review } = this.context(sessionId);
    const result = await this.submissions.history({
      sessionId: review.sessionId,
      documentId,
    });
    this.context(sessionId);
    if (!result.ok) return fail(result.error.code);
    if (result.data.ownerId !== session.accountId) return fail("forbidden");
    return result.data.items;
  }

  private async exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (this.busy) return fail("busy");
    this.busy = true;
    try {
      return await action();
    } finally {
      this.busy = false;
    }
  }

  async prepare(input: SubmissionPrepareInput): Promise<SubmissionAttempt> {
    return this.exclusive(async () => {
      const { session } = this.context(input.sessionId);
      const previous = this.pending(input.sessionId);
      if (previous && !["submitted", "mismatch"].includes(previous.state))
        return fail("pending_attempt");
      input = {
        ...input,
        document: structuredClone(input.document),
        file: new Uint8Array(input.file),
        replace: false,
      };
      const binding = this.cloud.binding(input.sessionId, input.document.id);
      if (
        !binding ||
        !input.expectedServerDocumentId ||
        binding.serverDocumentId !== input.expectedServerDocumentId
      )
        return fail("not_linked");
      validateArtifact(input);
      const recipient = await this.recipient(
        input.sessionId,
        input.recipientId,
      );
      const baseline = await this.history(
        input.sessionId,
        binding.serverDocumentId,
      );
      if (
        baseline.some(
          (item) =>
            item.recipientId === input.recipientId &&
            item.status !== "reviewed",
        )
      )
        return fail("active_submission");
      const pushed = await this.cloud.push(input);
      this.context(input.sessionId);
      if (pushed.status !== "saved") return fail("cloud_conflict");
      if (
        pushed.sha256 !== createHash("sha256").update(input.file).digest("hex")
      )
        return fail("cloud_changed");
      return this.save(input.sessionId, {
        id: randomUUID(),
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientRoles: recipient.roles,
        serverUrl: session.serverUrl,
        accountId: session.accountId,
        localDocumentId: input.document.id,
        documentId: pushed.serverDocumentId,
        title: input.document.title,
        sha256: pushed.sha256,
        baseline: baseline.map((item) => item.id),
        state: "uploaded",
      });
    });
  }

  async submit(sessionId: string): Promise<SubmissionAttempt> {
    return this.exclusive(async () => {
      const attempt = this.pending(sessionId);
      if (!attempt || attempt.state !== "uploaded")
        return fail("check_history");
      await this.recipient(sessionId, attempt.recipientId);
      // A changed cloud version must never be submitted by retrying this receipt.
      const current = (await this.cloud.list(sessionId)).commits.find(
        (item) => item.type === "current",
      );
      if (
        current?.document_id !== attempt.documentId ||
        current.sha256 !== attempt.sha256
      )
        return fail("cloud_changed");
      const downloaded = await this.cloud.pull({
        sessionId,
        serverDocumentId: attempt.documentId,
      });
      this.context(sessionId);
      if (
        downloaded.status !== "downloaded" ||
        downloaded.sha256 !== attempt.sha256
      )
        return fail("cloud_changed");
      await this.validateStored?.({
        sessionId,
        file: downloaded.file,
        serverDocumentId: attempt.documentId,
      });
      const items = await this.history(sessionId, attempt.documentId);
      if (
        items.some(
          (item) =>
            item.recipientId === attempt.recipientId &&
            !attempt.baseline.includes(item.id),
        )
      ) {
        this.save(sessionId, { ...attempt, state: "uncertain" });
        return this.resolve(sessionId);
      }
      if (
        items.some(
          (item) =>
            item.recipientId === attempt.recipientId &&
            item.status !== "reviewed",
        )
      )
        return fail("active_submission");
      // Persist before POST: a timeout or app exit must not enable a blind retry.
      this.save(sessionId, {
        ...attempt,
        state: "uncertain",
        error: undefined,
      });
      const { review } = this.context(sessionId);
      const result = await this.submissions.create({
        sessionId: review.sessionId,
        documentId: attempt.documentId,
        recipientId: attempt.recipientId!,
      });
      this.context(sessionId);
      if (result.ok) {
        this.save(sessionId, {
          ...attempt,
          state: "unverified",
          submissionId: result.data.id,
        });
      } else if (
        [
          "forbidden",
          "invalid_document",
          "invalid_recipient",
          "not_found",
          "not_authenticated",
        ].includes(result.error.code)
      ) {
        return this.save(sessionId, {
          ...attempt,
          state: "uploaded",
          error: result.error.code,
        });
      } else {
        this.save(sessionId, {
          ...attempt,
          state: "uncertain",
          error: result.error.code,
        });
      }
      return this.resolve(sessionId);
    });
  }

  private async resolve(sessionId: string): Promise<SubmissionAttempt> {
    const attempt = this.pending(sessionId);
    if (!attempt) return fail("pending_missing");
    if (["uploaded", "submitted", "mismatch"].includes(attempt.state))
      return attempt;
    try {
      const items = await this.history(sessionId, attempt.documentId);
      const candidates = items.filter(
        (item) =>
          (!attempt.recipientId || item.recipientId === attempt.recipientId) &&
          (attempt.submissionId
            ? item.id === attempt.submissionId
            : !attempt.baseline.includes(item.id)),
      );
      const snapshots: SubmissionSnapshot[] = [];
      for (const item of candidates) {
        const { review } = this.context(sessionId);
        const result = await this.submissions.file({
          sessionId: review.sessionId,
          documentId: attempt.documentId,
          submissionId: item.id,
        });
        this.context(sessionId);
        if (!result.ok)
          return this.save(sessionId, { ...attempt, error: result.error.code });
        snapshots.push(result.data);
      }
      const matches = snapshots.filter(
        (item) => item.sha256 === attempt.sha256,
      );
      if (matches.length === 1)
        return this.save(sessionId, {
          ...attempt,
          state: "submitted",
          submissionId: matches[0].submissionId,
          snapshotSha256: matches[0].sha256,
          error: undefined,
        });
      if (snapshots.length === 1)
        return this.save(sessionId, {
          ...attempt,
          state: "mismatch",
          submissionId: snapshots[0].submissionId,
          snapshotSha256: snapshots[0].sha256,
          error: "snapshot_mismatch",
        });
      return this.save(sessionId, { ...attempt, error: "check_history" });
    } catch (error) {
      // Leave the durable receipt uncertain; this action never sends another POST.
      this.context(sessionId);
      return this.save(sessionId, {
        ...attempt,
        error:
          error instanceof Error
            ? error.message.replace(/^submission_error:/, "")
            : "request_failed",
      });
    }
  }

  reconcile(sessionId: string) {
    return this.exclusive(() => this.resolve(sessionId));
  }

  async discard(sessionId: string) {
    return this.exclusive(async () => {
      const { session } = this.context(sessionId);
      const attempt = this.pending(sessionId);
      if (attempt && ["uncertain", "unverified"].includes(attempt.state))
        return fail("check_history");
      const attempts = { ...this.store.read() };
      delete attempts[this.key(session)];
      this.store.write(attempts);
    });
  }
}
