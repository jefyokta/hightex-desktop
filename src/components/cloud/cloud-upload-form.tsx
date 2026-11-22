import { AlertCircle, Link2, LoaderCircle, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CloudCommit } from "@/cloud/documents";
import type { RemoteDocumentTask } from "@/hooks/use-remote-documents";
import { ParsedItalic } from "@/utils/parse-italic";
import { t } from "@/utils/lang";

interface Props {
  documents: HighTexDocument[];
  selectedId: string;
  selectedDocument?: HighTexDocument;
  current?: CloudCommit;
  isLinked: boolean;
  isIntern: boolean;
  cloudAhead: boolean;
  loaded: boolean;
  busy: boolean;
  task: RemoteDocumentTask | null;
  pushHint: string;
  commitMessage: string;
  onSelectDocument(id: string): void;
  onCommitMessageChange(message: string): void;
  onPush(force: boolean): void;
}

export function CloudUploadForm({
  documents, selectedId, selectedDocument, current, isLinked, isIntern,
  cloudAhead, loaded, busy, task, pushHint, commitMessage,
  onSelectDocument, onCommitMessageChange, onPush,
}: Props) {
  return (
    <section className="rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UploadCloud className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold">{t("remote.save_to_cloud")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("remote.save_to_cloud_description")}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <label htmlFor="cloud-doc-select" className="text-sm font-medium">
            {t("remote.document_label")}
          </label>
          <Select
            value={selectedId}
            onValueChange={onSelectDocument}
            disabled={!documents.length || busy}
          >
            <SelectTrigger
              id="cloud-doc-select"
              className="w-full bg-white dark:bg-neutral-950"
            >
              <SelectValue
                placeholder={
                  !loaded
                    ? t("common.loading")
                    : documents.length
                      ? t("remote.choose_document")
                      : t("remote.no_local_document")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {documents.map((doc) => (
                <SelectItem key={doc.id} value={doc.id}>
                  <ParsedItalic text={doc.title || t("remote.untitled")} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedDocument && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isLinked ? (
                <>
                  <Link2 className="size-3.5 shrink-0" />
                  {t("remote.already_linked")}
                </>
              ) : current?.sha256 ? (
                <>
                  <AlertCircle className="size-3.5 shrink-0" />
                  {t("remote.not_linked")}
                </>
              ) : (
                t("remote.first_cloud_version")
              )}
            </p>
          )}
          {selectedDocument && loaded && (
            <div
              role="status"
              className={`rounded-xl border p-3 text-sm ${cloudAhead ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" : "bg-background"}`}
            >
              <p className="font-medium">
                {isIntern
                  ? t("remote.kp_local")
                  : cloudAhead
                    ? t("remote.cloud_changed")
                    : isLinked
                      ? t("remote.linked_cloud")
                      : current
                        ? t("remote.replaces_cloud_slot")
                        : t("remote.ready_first_backup")}
              </p>
              <p className="mt-1 text-xs leading-5">
                {cloudAhead
                  ? t("remote.cloud_ahead_hint")
                  : isLinked
                    ? t("remote.linked_save_hint")
                    : t("remote.save_review_hint")}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="cloud-commit-message"
            className="flex items-baseline justify-between text-sm font-medium"
          >
            <span>
              {t("remote.note")}{" "}
              <span className="font-normal text-muted-foreground">
                ({t("remote.optional")})
              </span>
            </span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {[...commitMessage].length}/255
            </span>
          </label>
          <Textarea
            id="cloud-commit-message"
            value={commitMessage}
            onChange={(event) => onCommitMessageChange(event.target.value)}
            maxLength={255}
            rows={2}
            placeholder={t("remote.commit_placeholder")}
            disabled={busy}
            className="min-h-16 resize-y bg-white dark:bg-neutral-950"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            id="cloud-push-readiness"
            role="status"
            className="text-xs text-muted-foreground"
          >
            {pushHint}
          </p>
          <Button
            onClick={() => onPush(false)}
            disabled={
              Boolean(pushHint)
            }
            className="ml-auto w-full sm:w-auto"
            aria-describedby="cloud-push-readiness"
            title={pushHint || t("remote.save_local_to_cloud")}
          >
            {task?.kind === "push" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            {task?.kind === "push"
              ? t("remote.saving")
              : t("remote.save_version")}
          </Button>
        </div>
        {current && (
          <Disclosure
            data-cloud-force-push
            className="rounded-xl border border-amber-200 p-4 dark:border-amber-900"
            triggerClassName="cursor-pointer text-sm font-medium"
            label={t("remote.force_push")}
          >
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {t("remote.force_push_description")}
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="mt-3"
              disabled={Boolean(pushHint)}
              aria-describedby="cloud-push-readiness"
              onClick={() => onPush(true)}
            >
              {task?.kind === "push" && task.force ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <UploadCloud className="size-4" />
              )}
              {t("remote.force_push_local")}
            </Button>
          </Disclosure>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
          <p className="text-muted-foreground">
            {t("remote.advisor_review_ready")}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/submissions">
              {t("remote.open_review_request")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
