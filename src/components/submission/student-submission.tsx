import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, LoaderCircle, RefreshCw, Send } from "lucide-react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { exportCloudArtifact } from "@/cloud/academic-data";
import { readSnapshot } from "@/review/snapshot-reader";
import { confirm } from "@/utils/confirm";
import { ParsedItalic } from "@/utils/parse-italic";
import { t } from "@/utils/lang";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SubmissionHistoryList } from "./history-list";

export const StudentSubmission = ({
  onUpdated,
  fallbackHistory,
  revision = 0,
}: {
  onUpdated(): void;
  fallbackHistory?: SubmissionSummary[];
  revision?: number;
}) => {
  const alive = useRef(true);
  const operation = useRef(false);
  const [session, setSession] = useState<CloudSession>();
  const [docs, setDocs] = useState<HighTexDocument[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bindings, setBindings] = useState<Record<string, CloudBinding | null>>(
    {},
  );
  const [selected, setSelected] = useState("");
  const [current, setCurrent] =
    useState<CommitListResponse["commits"][number]>();
  const [history, setHistory] = useState<SubmissionSummary[]>([]);
  const [attempt, setAttempt] = useState<SubmissionAttempt | null>(null);
  const [task, setTask] = useState<string | null>("load");
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);

  const assertCurrent = async (context: CloudSession) => {
    if (
      !alive.current ||
      (await window.hightex.cloud.context()).sessionId !== context.sessionId
    )
      throw new Error("submission_error:session_changed");
  };
  const load = useCallback(async () => {
    const context = await window.hightex.cloud.context();
    const [list, local, available, pending] = await Promise.all([
      window.hightex.cloud.list(context.sessionId),
      HighTexDB.getInstance().documents.toArray(),
      window.hightex.categories(),
      window.hightex.submission.workflow.pending(context.sessionId),
    ]);
    const mapped = Object.fromEntries(
      await Promise.all(
        local.map(async (doc) => [
          doc.id,
          await window.hightex.cloud.binding(context.sessionId, doc.id),
        ]),
      ),
    );
    const latest = list.commits.find((item) => item.type === "current");
    let items: SubmissionSummary[] = [];
    if (latest) {
      const review = await window.hightex.submission.context();
      if (!review.ok) throw new Error(`submission_error:${review.error.code}`);
      const response = await window.hightex.submission.history({
        sessionId: review.data.sessionId,
        documentId: latest.document_id,
      });
      if (!response.ok)
        throw new Error(`submission_error:${response.error.code}`);
      if (response.data.ownerId !== context.accountId)
        throw new Error("submission_error:forbidden");
      items = response.data.items;
    }
    await assertCurrent(context);
    setSession(context);
    setDocs(local);
    setCategories(available);
    setBindings(mapped);
    setCurrent(latest);
    setHistory(items);
    setAttempt(pending);
    setLoaded(true);
    setSelected((previous) =>
      local.some((doc) => doc.id === previous)
        ? previous
        : (local.find(
            (doc) => mapped[doc.id]?.serverDocumentId === latest?.document_id,
          )?.id ??
          local[0]?.id ??
          ""),
    );
  }, []);

  useEffect(() => {
    alive.current = true;
    let canceled = false;
    void load()
      .catch((cause) => {
        if (!canceled) setError(submissionError(cause));
      })
      .finally(() => {
        if (!canceled) setTask(null);
      });
    return () => {
      canceled = true;
      alive.current = false;
    };
  }, [load, revision]);

  const run = async (kind: string, action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setTask(kind);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      if (alive.current) setError(submissionError(cause));
    } finally {
      operation.current = false;
      if (alive.current) setTask(null);
    }
  };
  const selectedDoc = docs.find((doc) => doc.id === selected);
  const category = categories.find(
    (item) => String(item.id) === selectedDoc?.category,
  );
  const kp = Boolean(
    selectedDoc?.config.intern || category?.variant === "intern",
  );
  const linked = Boolean(
    current &&
    selectedDoc &&
    bindings[selectedDoc.id]?.serverDocumentId === current.document_id,
  );
  const active = history.some((item) => item.status !== "reviewed");
  const ongoing =
    attempt && ["uploaded", "uncertain", "unverified"].includes(attempt.state);
  const busy = task !== null;
  const prepare = () =>
    run("prepare", async () => {
      if (!session || !selectedDoc || !current || !linked || !category) return;
      if (kp) throw new Error("submission_error:kp_unsupported");
      if (await window.editor.has(selectedDoc.id))
        throw new Error("submission_error:editor_open");
      if (
        !(await confirm({
          title: t("submission_student.confirm_title"),
          desc: t("submission_student.confirm_description"),
        }))
      )
        return;
      await assertCurrent(session);
      if (await window.editor.has(selectedDoc.id))
        throw new Error("submission_error:editor_open");
      const artifact = await exportCloudArtifact(
        selectedDoc.id,
        session,
        current.document_id,
      );
      const model = await readSnapshot(artifact.file, {
        kind: "local",
        filename: "submission.hightex",
      });
      if (
        !model.document.profile?.name.trim() ||
        !model.document.profile.nim.trim() ||
        !model.document.title.trim()
      )
        throw new Error("submission_error:invalid_document");
      await assertCurrent(session);
      const prepared = await window.hightex.submission.workflow.prepare({
        sessionId: session.sessionId,
        file: artifact.file,
        document: { ...artifact.document, profile: undefined },
        message: t("submission_student.commit_message"),
        expectedServerDocumentId: current.document_id,
        expectedCloudSha256: current.sha256 ?? null,
        replace: false,
      });
      await assertCurrent(session);
      setAttempt(prepared);
      await HighTexDB.getInstance().cacheCloudAcademic(selectedDoc.id, {
        ...artifact.academic,
        serverDocumentId: prepared.documentId,
      });
      setTask("submit");
      const result = await window.hightex.submission.workflow.submit(
        session.sessionId,
      );
      await assertCurrent(session);
      setAttempt(result);
      await load();
      onUpdated();
    });
  const resume = (check: boolean) =>
    run(check ? "check" : "submit", async () => {
      if (!session) return;
      await assertCurrent(session);
      const result = check
        ? await window.hightex.submission.workflow.reconcile(session.sessionId)
        : await window.hightex.submission.workflow.submit(session.sessionId);
      await assertCurrent(session);
      setAttempt(result);
      await load();
      onUpdated();
    });
  const discard = () =>
    run("discard", async () => {
      if (
        !session ||
        !(await confirm({
          title: t("submission_student.discard_title"),
          desc: t("submission_student.discard_description"),
        }))
      )
        return;
      await assertCurrent(session);
      await window.hightex.submission.workflow.discard(session.sessionId);
      await load();
    });

  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Send className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">{t("submission_student.title")}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("submission_student.description")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            aria-label={t("submission_review.refresh")}
            onClick={() => void run("load", load)}
          >
            <RefreshCw
              className={`size-4 ${task === "load" ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {attempt && (
          <div
            className="rounded-xl border bg-background p-4 space-y-3"
            role="status"
          >
            <p className="font-medium flex items-center gap-2">
              {attempt.state === "submitted" && <Check className="size-4" />}
              <ParsedItalic text={attempt.title} />
            </p>
            <p className="text-sm text-muted-foreground">
              {t(`submission_student.attempt.${attempt.state}`)}
            </p>
            {attempt.error &&
              !["submitted", "mismatch"].includes(attempt.state) && (
                <p className="text-sm">
                  {submissionError(
                    new Error(`submission_error:${attempt.error}`),
                  )}
                </p>
              )}
            <div className="flex flex-wrap gap-2">
              {attempt.state === "uploaded" && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void resume(false)}
                >
                  {task === "submit" && (
                    <LoaderCircle className="size-4 animate-spin" />
                  )}
                  {t("submission_student.retry")}
                </Button>
              )}
              {["uncertain", "unverified"].includes(attempt.state) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void resume(true)}
                >
                  {task === "check" && (
                    <LoaderCircle className="size-4 animate-spin" />
                  )}
                  {t("submission_student.check")}
                </Button>
              )}
              {attempt.submissionId && (
                <Button asChild variant="outline" size="sm">
                  <Link
                    to={`/dashboard/submissions/${encodeURIComponent(attempt.documentId)}/${encodeURIComponent(attempt.submissionId)}`}
                  >
                    {t("submission_review.open_snapshot")}
                  </Link>
                </Button>
              )}
              {attempt.state === "uploaded" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void discard()}
                >
                  {t("submission_student.discard")}
                </Button>
              )}
            </div>
          </div>
        )}
        {!ongoing && (
          <>
            <div className="space-y-2">
              <label
                htmlFor="submission-document"
                className="text-sm font-medium"
              >
                {t("submission_student.document")}
              </label>
              <Select
                value={selected}
                onValueChange={setSelected}
                disabled={busy || !docs.length}
              >
                <SelectTrigger
                  id="submission-document"
                  className="w-full bg-white dark:bg-neutral-950"
                >
                  <SelectValue
                    placeholder={t("submission_student.choose_document")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {docs.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      <ParsedItalic
                        text={doc.title || t("common.untitled_document")}
                      />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {kp ? (
                <p className="text-sm text-muted-foreground">
                  {t("submission_student.errors.kp_unsupported")}
                </p>
              ) : (
                !linked &&
                loaded && (
                  <p className="text-sm text-muted-foreground">
                    {t("submission_student.link_first")}{" "}
                    <Link
                      className="underline underline-offset-4"
                      to="/dashboard/projects/cloud"
                    >
                      {t("submission_student.open_cloud")}
                    </Link>
                  </p>
                )
              )}
            </div>
            {active && (
              <p className="text-sm text-muted-foreground">
                {t("submission_student.errors.active_submission")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t("submission_student.version_limit")}
            </p>
            <Button
              size="sm"
              disabled={busy || !loaded || !linked || kp || active || !category}
              onClick={() => void prepare()}
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {t(
                task === "submit"
                  ? "submission_student.submitting"
                  : task === "prepare"
                    ? "submission_student.preparing"
                    : "submission_student.submit",
              )}
            </Button>
          </>
        )}
      </div>
      {((loaded && current) || fallbackHistory !== undefined) && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium">
            {t("submission_review.student_history")}
          </h2>
          <SubmissionHistoryList
            items={loaded && current ? history : (fallbackHistory ?? [])}
          />
        </div>
      )}
    </section>
  );
};

const submissionError = (cause: unknown) => {
  const code =
    cause instanceof Error
      ? /(?:submission_error|cloud_error):([a-zA-Z0-9_]+)/.exec(
          cause.message,
        )?.[1]
      : undefined;
  const known = [
    "active_submission",
    "invalid_document",
    "not_linked",
    "busy",
    "pending_attempt",
    "check_history",
    "cloud_changed",
    "cloud_conflict",
    "kp_unsupported",
    "editor_open",
    "forbidden",
    "not_authenticated",
    "session_changed",
    "integrity_failed",
    "not_found",
    "invalid_response",
    "request_failed",
    "pending_missing",
    "academic_changed",
    "academic_invalid",
    "academic_scope",
  ] as const;
  const matched = known.find((item) => item === code) ?? "request_failed";
  return t(`submission_student.errors.${matched}`);
};
