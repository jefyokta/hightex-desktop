import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Users } from "lucide-react";
import { t } from "@/utils/lang";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { SubmissionHistoryList } from "./history-list";

export const AdvisorSubmissions = ({ revision = 0 }: { revision?: number }) => {
  const [directory, setDirectory] = useState<AdvisorDirectory>();
  const [studentId, setStudentId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [history, setHistory] = useState<SubmissionHistory>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const request = useRef(0);
  const operation = useRef(false);

  useEffect(() => {
    const generation = ++request.current;
    setDirectory(undefined);
    setStudentId("");
    setHistory(undefined);
    setError(undefined);
    setLoading(true);
    setOpening(false);
    void window.hightex.submission.advisor
      .directory()
      .then((response) => {
        if (generation !== request.current) return;
        if (response.ok) setDirectory(response.data);
        else setError(t(`submission_review.errors.${response.error.code}`));
      })
      .catch(() => {
        if (generation === request.current)
          setError(t("submission_review.errors.request_failed"));
      })
      .finally(() => {
        if (generation === request.current) setLoading(false);
      });
    return () => {
      // This is a request counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      request.current++;
    };
  }, [revision]);

  const openHistory = async (target: string) => {
    if (!directory || !studentId || operation.current || !target.trim()) return;
    operation.current = true;
    const generation = ++request.current;
    setOpening(true);
    setError(undefined);
    setHistory(undefined);
    setDocumentId(target);
    try {
      const response = await window.hightex.submission.advisor.history({
        sessionId: directory.session.sessionId,
        studentId,
        documentId: target.trim(),
      });
      if (generation !== request.current) return;
      if (response.ok) {
        setHistory(response.data);
        const remembered = {
          id: response.data.documentId,
          title: response.data.title ?? "",
        };
        setDirectory(
          (previous) =>
            previous && {
              ...previous,
              students: previous.students.map((student) =>
                student.id !== studentId
                  ? student
                  : {
                      ...student,
                      documents: [
                        ...student.documents.filter(
                          (doc) => doc.id !== remembered.id,
                        ),
                        remembered,
                      ],
                    },
              ),
            },
        );
      } else setError(t(`submission_review.errors.${response.error.code}`));
    } catch {
      if (generation === request.current)
        setError(t("submission_review.errors.request_failed"));
    } finally {
      operation.current = false;
      if (generation === request.current) setOpening(false);
    }
  };
  const student = directory?.students.find((item) => item.id === studentId);
  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <h2 className="text-sm font-medium">
          {t("submission_review.advisor_queue")}
        </h2>
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        ) : (
          directory && <SubmissionHistoryList items={directory.queue} />
        )}
      </div>
      <div className="rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">
              {t("submission_advisor.students")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("submission_advisor.students_description")}
            </p>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {directory && !directory.students.length && (
          <p className="text-sm text-muted-foreground">
            {t("submission_advisor.no_students")}
          </p>
        )}
        {directory?.students.map((item) => (
          <Card key={item.id} size="sm">
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium">{item.name}</p>
                {item.nim && (
                  <p className="text-sm text-muted-foreground">{item.nim}</p>
                )}
                <Badge variant="secondary">
                  {t(`submission_advisor.${item.advisorRole}`)}
                </Badge>
              </div>
              <Button
                size="sm"
                variant={studentId === item.id ? "secondary" : "outline"}
                disabled={opening}
                onClick={() => {
                  request.current++;
                  setStudentId(item.id);
                  setDocumentId("");
                  setHistory(undefined);
                  setError(undefined);
                }}
              >
                {t("submission_advisor.history")}
              </Button>
            </CardContent>
          </Card>
        ))}
        {student && (
          <div className="rounded-xl border bg-background p-4 space-y-3">
            <h3 className="text-sm font-medium">
              {t("submission_advisor.student_history", { name: student.name })}
            </h3>
            <div className="flex flex-wrap gap-2">
              {student.documents.map((doc) => (
                <Button
                  key={doc.id}
                  size="sm"
                  variant="outline"
                  disabled={opening}
                  onClick={() => void openHistory(doc.id)}
                >
                  {doc.title || doc.id}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("submission_advisor.document_hint")}
            </p>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void openHistory(documentId);
              }}
            >
              <div className="flex-1 min-w-40 space-y-2">
                <label
                  htmlFor="advisor-document"
                  className="text-sm font-medium"
                >
                  {t("submission_advisor.document_id")}
                </label>
                <Input
                  id="advisor-document"
                  value={documentId}
                  disabled={opening}
                  onChange={(event) => {
                    setDocumentId(event.target.value);
                    setHistory(undefined);
                  }}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={opening || !documentId.trim()}
              >
                {opening && <LoaderCircle className="size-4 animate-spin" />}
                {t("submission_advisor.open_history")}
              </Button>
            </form>
            {history && <SubmissionHistoryList items={history.items} />}
          </div>
        )}
      </div>
    </section>
  );
};
