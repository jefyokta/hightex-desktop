import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { FileText, FolderOpen, LoaderCircle, RefreshCw } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useOnline } from "@/hooks/use-online";
import {
  readSnapshot,
  SnapshotReadError,
  type SnapshotReadModel,
} from "@/review/snapshot-reader";
import { snapshotCache } from "@/review/snapshot-cache";
import { t } from "@/utils/lang";
import { LoginGate } from "../login-gate";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { Card, CardContent } from "../ui/card";
import { ParsedItalic } from "@/utils/parse-italic";
import { SubmissionSnapshotViewer } from "./snapshot-viewer";

export const SubmissionListView = () => {
  const { user } = useUser();
  const online = useOnline();
  const [result, setResult] = useState<SubmissionList>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [snapshot, setSnapshot] = useState<SnapshotReadModel>();
  const [opening, setOpening] = useState(false);
  const [revision, setRevision] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const localRequest = useRef(0);

  useEffect(() => {
    let canceled = false;
    setResult(undefined);
    setError(undefined);
    snapshotCache.clear();
    if (!user || !online) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void window.hightex.submission
      .list()
      .then((response) => {
        if (canceled) return;
        if (response.ok) {
          snapshotCache.useSession(response.data.session);
          setResult(response.data);
        } else setError(t(`submission_review.errors.${response.error.code}`));
      })
      .catch(() => {
        if (!canceled) setError(t("submission_review.errors.request_failed"));
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
      snapshotCache.clear();
    };
  }, [user, online, revision]);

  useEffect(
    () => () => {
      localRequest.current++;
    },
    [],
  );

  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const request = ++localRequest.current;
    setOpening(true);
    setError(undefined);
    try {
      if (file.size > 64 * 1024 * 1024)
        throw new SnapshotReadError("too_large");
      const model = await readSnapshot(
        new Uint8Array(await file.arrayBuffer()),
        { kind: "local", filename: file.name },
      );
      if (request === localRequest.current) setSnapshot(model);
    } catch (error) {
      if (request === localRequest.current)
        setError(
          t(
            `submission_review.errors.${error instanceof SnapshotReadError ? error.code : "invalid_archive"}`,
          ),
        );
    } finally {
      if (request === localRequest.current) setOpening(false);
    }
  };

  if (snapshot)
    return (
      <SubmissionSnapshotViewer
        key={snapshot.sha256}
        snapshot={snapshot}
        onBack={() => setSnapshot(undefined)}
      />
    );

  return (
    <main className="mx-auto max-w-3xl space-y-5 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {t("submission_review.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("submission_review.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".hightex"
            className="hidden"
            onChange={openFile}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={opening}
            onClick={() => fileRef.current?.click()}
          >
            {opening ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <FolderOpen className="size-4" />
            )}
            {t("submission_review.open_file")}
          </Button>
          {user && (
            <Button
              size="sm"
              variant="outline"
              disabled={!online || loading}
              onClick={() => setRevision((value) => value + 1)}
            >
              <RefreshCw
                className={`size-4 ${loading ? "animate-spin" : ""}`}
              />
              {t("submission_review.refresh")}
            </Button>
          )}
        </div>
      </header>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!user ? (
        <LoginGate />
      ) : !online ? (
        <Alert>
          <AlertDescription>{t("submission_review.offline")}</AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((key) => (
            <div key={key} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        result && (
          <>
            <p className="text-sm text-muted-foreground">
              {t(
                result.audience === "advisor"
                  ? "submission_review.advisor_queue"
                  : "submission_review.student_history",
              )}
            </p>
            {!result.items.length && (
              <div className="rounded-2xl bg-muted/30 p-8 text-center">
                <FileText className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("submission_review.empty")}
                </p>
              </div>
            )}
            {result.items.map((item) => (
              <Card key={`${item.documentId}:${item.id}`} size="sm">
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      <ParsedItalic
                        text={item.title || t("common.untitled_document")}
                      />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.studentName || t("submission_review.not_recorded")}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {t(`submission_review.status.${item.status}`)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        #{item.id}
                        {item.createdAt &&
                        !Number.isNaN(Date.parse(item.createdAt))
                          ? ` · ${new Date(item.createdAt).toLocaleDateString()}`
                          : ""}
                      </span>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to={`/dashboard/submissions/${encodeURIComponent(item.documentId)}/${encodeURIComponent(item.id)}`}
                    >
                      {t("submission_review.open_snapshot")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </>
        )
      )}
    </main>
  );
};
