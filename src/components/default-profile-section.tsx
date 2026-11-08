import { useEffect, useState } from "react";
import { InfoIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileFields } from "@/components/profile-fields";
import {
  Tooltip,
  TooltipPanel,
  TooltipTrigger,
} from "@/components/animate-ui/components/base/tooltip";
import { executeInteractively } from "@/utils/execute-interactively";
import { t } from "@/utils/lang";
import { useWorkspaces } from "@/hooks/use-workspaces";

export function DefaultProfileSection({
  onDirtyChange,
  onBusyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
} = {}) {
  const { state } = useWorkspaces();
  const [profile, setProfile] = useState<Omit<Profile, "cv">>({
    name: "",
    nim: "",
    advisorName: "",
    advisorNip: "",
    secondAdvisor: undefined,
    committee: {},
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState("");
  const active = state?.profiles.find((item) => item.id === state.activeId);
  const activeId = active?.id;
  const local = active?.type === "local";
  const dirty = !loading && !loadError && JSON.stringify(profile) !== original;
  useEffect(() => {
    if (local) onDirtyChange?.(dirty);
  }, [dirty, local, onDirtyChange]);
  useEffect(() => {
    if (local) onBusyChange?.(saving);
  }, [saving, local, onBusyChange]);

  useEffect(() => {
    if (!local || !activeId) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      setLoadError(false);
      setProfile({
        name: "",
        nim: "",
        advisorName: "",
        advisorNip: "",
        secondAdvisor: undefined,
        committee: {},
      });
      try {
        const prof = await window.profile.get();
        if (!mounted) return;
        const loaded: Omit<Profile, "cv"> = {
          name: prof?.name ?? "",
          nim: prof?.nim ?? "",
          advisorName: prof?.advisorName ?? "",
          advisorNip: prof?.advisorNip ?? "",
          secondAdvisor: prof.secondAdvisor,
          committee: prof.committee ?? {},
        };
        setProfile(loaded);
        setOriginal(JSON.stringify(loaded));
      } catch {
        if (mounted) setLoadError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [activeId, local, loadRevision]);

  const saveProfile = async () => {
    try {
      setSaving(true);
      const updated = { ...profile };
      await window.profile.set(updated);
      await window.hightex.onboarding.acknowledgeProfileSetup();
      setProfile(updated);
      setOriginal(JSON.stringify(updated));
    } finally {
      setSaving(false);
    }
  };

  if (!state || !active || !local) return null;

  return (
    <Card data-tour="default-profile">
      <CardHeader>
        <CardTitle>{t("settings.profile.label")}</CardTitle>
        <CardDescription className="flex items-center space-x-2">
          <span>{t("settings.profile.description")}</span>
          <Tooltip>
            <TooltipTrigger>
              <InfoIcon size={12} />
            </TooltipTrigger>
            <TooltipPanel>{t("settings.profile.tooltip")}</TooltipPanel>
          </Tooltip>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t("settings.profile.loading")}
          </p>
        ) : loadError ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {t("onboarding.profile.load_failed")}
            </p>
            <Button
              variant="outline"
              onClick={() => setLoadRevision((value) => value + 1)}
            >
              {t("dashboard.retry")}
            </Button>
          </div>
        ) : (
          <>
            <ProfileFields
              profile={profile}
              disabled={saving}
              onChange={(patch) =>
                setProfile((previous) => ({ ...previous, ...patch }))
              }
            />
            <div className="flex justify-end pt-4">
              <Button
                data-tour="default-profile-save"
                onClick={() =>
                  executeInteractively(saveProfile, {
                    successMessage: "Saved",
                  })
                }
                disabled={saving || !dirty}
              >
                {saving
                  ? t("settings.profile.saving")
                  : t("settings.profile.save")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
