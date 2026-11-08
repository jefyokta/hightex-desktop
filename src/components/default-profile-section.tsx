import { useEffect, useState } from "react";
import { InfoIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileFields } from "@/components/profile-fields";
import {
  Tooltip,
  TooltipPanel,
  TooltipTrigger,
} from "@/components/animate-ui/components/base/tooltip";
import { executeInteractively } from "@/utils/execute-interactively";
import { t } from "@/utils/lang";

export function DefaultProfileSection() {
  const [profile, setProfile] = useState<Omit<Profile, "cv">>({
    name: "",
    nim: "",
    advisorName: "",
    advisorNip: "",
    secondAdvisor: undefined,
    committee: {},
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const prof = await window.profile.get();
        if (!mounted) return;
        setProfile({
          name: prof?.name ?? "",
          nim: prof?.nim ?? "",
          advisorName: prof?.advisorName ?? "",
          advisorNip: prof?.advisorNip ?? "",
          secondAdvisor: prof.secondAdvisor,
          committee: prof.committee ?? {},
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const saveProfile = async () => {
    try {
      setSaving(true);
      await window.profile.set(profile);
    } finally {
      setSaving(false);
    }
  };

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
        ) : (
          <>
            <ProfileFields
              profile={profile}
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
                disabled={saving}
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
