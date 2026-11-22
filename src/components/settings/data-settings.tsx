import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettingsMaintenance } from "@/hooks/use-settings-maintenance";
import { t } from "@/utils/lang";

export function DataSettings() {
  const maintenance = useSettingsMaintenance();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.data.title")}</CardTitle>
        <CardDescription>{t("settings.data.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DangerAction
          label={t("settings.data.clear_cache.label")}
          description={t("settings.data.clear_cache.description")}
          action={t("settings.data.clear_action")}
          busy={maintenance.task === "cache"}
          disabled={maintenance.busy}
          onClick={() => void maintenance.clearCache()}
        />
        <Separator />
        <DangerAction
          label={t("settings.data.unused_citations.label")}
          description={t("settings.data.unused_citations.description")}
          action={t(maintenance.cleaningCitations
            ? "settings.data.unused_citations.checking"
            : "settings.data.unused_citations.action")}
          busy={maintenance.cleaningCitations}
          disabled={maintenance.busy}
          onClick={() => void maintenance.deleteUnusedCitations()}
        />
        <Separator />
        <DangerAction
          label={t("settings.data.config.label")}
          description={t("settings.data.config.description")}
          action={t("settings.data.reset_action")}
          busy={maintenance.task === "config"}
          disabled={maintenance.busy}
          onClick={() => void maintenance.resetPreferences()}
        />
        <Separator />
        <DangerAction
          label={t("settings.data.clear_data.label")}
          description={t("settings.data.clear_data.description")}
          action={t("settings.data.clear_action")}
          busy={maintenance.task === "documents"}
          disabled={maintenance.busy}
          onClick={() => void maintenance.clearDocuments()}
        />
      </CardContent>
    </Card>
  );
}

function DangerAction({
  label,
  description,
  action,
  onClick,
  busy = false,
  disabled = false,
}: {
  label: string;
  description?: string;
  action: string;
  onClick?: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      <Button
        variant="destructive"
        size="sm"
        onClick={onClick}
        disabled={busy || disabled}
        aria-busy={busy}
      >
        {busy && <Loader2 className="animate-spin" />}
        {action}
      </Button>
    </div>
  );
}
