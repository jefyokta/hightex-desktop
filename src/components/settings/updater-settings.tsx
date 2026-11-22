import { AlertCircle, CheckCircle, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAppUpdater } from "@/hooks/use-app-updater";
import { t } from "@/utils/lang";

export function UpdaterSettings() {
  const { status, checking, canCheck, check, download, install } = useAppUpdater();
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>{t("settings.updater.label")}</Label>

        <div className="mt-1"><UpdateStatus status={status} onDownload={download} onInstall={install} /></div>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={!canCheck}
        onClick={check}
        className="gap-2"
      >
        <RefreshCw
          size={13}
          className={
            checking || status?.status === "checking" ? "animate-spin" : ""
          }
        />

        {t("settings.updater.check")}
      </Button>
    </div>
  );
}

function UpdateStatus({ status, onDownload, onInstall }: {
  status: UpdaterStatus | null;
  onDownload(): Promise<void>;
  onInstall(): Promise<void>;
}) {
  if (!status) return null;

  switch (status.status) {
    case "checking":
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />
          {t("settings.updater.checking")}
        </div>
      );

    case "not-available":
      return (
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
          <CheckCircle size={12} />
          {t("settings.updater.up_to_date")}
        </div>
      );

    case "available":
      return (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <Download size={12} />
            {t("settings.updater.available", {
              version: status.info.version,
            })}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onDownload}
          >
            {t("settings.updater.download")}
          </Button>
        </div>
      );

    case "downloading":
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />
          {t("settings.updater.downloading", {
            percent: Math.round(status.progress.percent),
          })}
        </div>
      );

    case "downloaded":
      return (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
            <CheckCircle size={12} />
            {t("settings.updater.ready", {
              version: status.info.version,
            })}
          </div>

          <Button size="sm" className="h-7 text-xs" onClick={onInstall}>
            {t("settings.updater.restart_install")}
          </Button>
        </div>
      );

    case "installing":
      return (
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Loader2 size={12} className="animate-spin" />
          {t("settings.updater.installing")}
        </p>
      );

    case "error":
      return (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle size={12} />
          {status.message}
        </div>
      );

    case "disabled":
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle size={12} />
          {status.reason}
        </div>
      );

    default:
      return null;
  }
}
