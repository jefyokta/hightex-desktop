import { useAppLanguage } from "@/hooks/use-app-language";
import { useUser } from "@/hooks/use-user";
import { useOnline } from "@/hooks/use-online";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useRemoteDocuments } from "@/hooks/use-remote-documents";
import { LoginGate } from "@/components/login-gate";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { CloudVersionCard } from "@/components/cloud/cloud-version-card";
import { CloudUploadForm } from "@/components/cloud/cloud-upload-form";
import { CloudVersionHistory, useCloudHistoryPanel } from "@/components/cloud/cloud-version-history";
import { AlertCircle, CloudOff, History, LoaderCircle, RefreshCw, X } from "lucide-react";
import { t } from "@/utils/lang";

export const RemoteDocuments = () => {
  useAppLanguage();
  const { user } = useUser();
  const online = useOnline();
  const { state } = useWorkspaces();
  const local =
    !state ||
    state.profiles.find((profile) => profile.id === state.activeId)?.type ===
      "local";
  if (local || !user) return <LoginGate />;
  return (
    <RemoteDocumentsContent key={`${user.id}:${online}`} online={online} />
  );
};

const RemoteDocumentsContent = ({ online }: { online: boolean }) => {
  const cloud = useRemoteDocuments(online);
  const history = useCloudHistoryPanel();
  const { current, archives, task, busy, loaded, notice, dismissNotice, refresh } = cloud;
  const pullingSha = task?.kind === "pull" ? (task.sha ?? "latest") : null;

  return (
    <main className="flex items-stretch gap-6 pb-10">
      <div className="mx-auto w-full min-w-0 max-w-3xl flex-1 space-y-5">
        <PageHeader
          title={t("remote.title")}
          description={t("remote.subtitle")}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="xl:hidden"
                onClick={() => history.setOpen(true)}
              >
                <History className="size-4" />
                {t("remote.history")}
                {archives.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-[11px] leading-5">
                    {archives.length}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refresh()}
                disabled={!online || busy}
              >
                {task?.kind === "refresh" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t("remote.refresh")}
              </Button>
            </div>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [t("remote.guide_select"), t("remote.guide_select_description")],
            [t("remote.guide_save"), t("remote.guide_save_description")],
            [t("remote.guide_review"), t("remote.guide_review_description")],
          ].map(([title, description]) => (
            <div key={title} className="rounded-xl border bg-background p-4">
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>

        {!online && (
          <div className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4 text-sm text-muted-foreground dark:bg-neutral-900">
            <CloudOff className="mt-0.5 size-4 shrink-0" />
            <p>{t("remote.offline_description")}</p>
          </div>
        )}

        {notice && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="wrap-break-word">{notice.message}</p>
              {notice.action && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={notice.action.run}
                  disabled={busy || !online}
                  className="bg-white/60 dark:bg-transparent"
                >
                  {notice.action.label}
                </Button>
              )}
            </div>
            <button
              type="button"
              aria-label={t("remote.close_notice")}
              onClick={dismissNotice}
              className="-m-1 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <CloudVersionCard
          current={current}
          linkedDocument={cloud.linkedDocument}
          selectedBinding={cloud.selectedBinding}
          online={online}
          loaded={loaded}
          busy={busy}
          showSkeleton={!loaded && online && task?.kind === "refresh"}
          pullingSha={pullingSha}
          onDownload={target => void cloud.download(target)}
        />
        <CloudUploadForm
          documents={cloud.documents}
          selectedId={cloud.selectedId}
          selectedDocument={cloud.selectedDocument}
          current={current}
          isLinked={cloud.isLinked}
          isIntern={cloud.isIntern}
          cloudAhead={cloud.cloudAhead}
          loaded={loaded}
          busy={busy}
          task={task}
          pushHint={cloud.pushHint}
          commitMessage={cloud.commitMessage}
          onSelectDocument={cloud.setSelectedId}
          onCommitMessageChange={cloud.setCommitMessage}
          onPush={force => void cloud.push(force)}
        />
      </div>
      <CloudVersionHistory
        archives={archives}
        online={online}
        busy={busy}
        pullingSha={pullingSha}
        canRestore={Boolean(cloud.selectedDocument)}
        open={history.open}
        onOpenChange={history.setOpen}
        onDownload={sha256 => void cloud.download({ kind: "history", sha256 })}
        onRestore={sha256 => void cloud.download({ kind: "restore", sha256 })}
      />
    </main>
  );
};
