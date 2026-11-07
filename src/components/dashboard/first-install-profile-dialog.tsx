import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ProfileFields,
  type EditableProfile,
} from "@/components/profile-fields";
import { t } from "@/utils/lang";

const emptyProfile = (): EditableProfile => ({
  name: "",
  nim: "",
  advisorName: "",
  advisorNip: "",
  secondAdvisor: undefined,
  committee: {},
});

export function FirstInstallProfileDialog({
  guide,
}: {
  guide: GuideController;
}) {
  const [profile, setProfile] = useState<EditableProfile>(emptyProfile);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const attempted = useRef(false);
  const savingRef = useRef(false);
  const { status, plan, phase } = guide;

  useEffect(() => {
    if (
      !status?.profileSetupPending ||
      plan ||
      phase ||
      open ||
      attempted.current
    )
      return;

    attempted.current = true;
    let alive = true;
    let loaded = false;
    void window.profile
      .get()
      .then((value) => {
        loaded = true;
        if (!alive) return;
        setProfile({
          name: value.name ?? "",
          nim: value.nim ?? "",
          advisorName: value.advisorName ?? "",
          advisorNip: value.advisorNip ?? "",
          secondAdvisor: value.secondAdvisor,
          committee: value.committee ?? {},
        });
        setOpen(true);
      })
      .catch(() => {
        loaded = true;
        if (!alive) return;
        attempted.current = false;
        toast.error(t("onboarding.profile.load_failed"));
      });

    return () => {
      alive = false;
      if (!loaded) attempted.current = false;
    };
  }, [status, plan, phase, open]);

  const finish = async (saveProfile: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (saveProfile) await window.profile.set(profile);
      await window.hightex.onboarding.acknowledgeProfileSetup();
      setOpen(false);
    } catch {
      toast.error(
        t(
          saveProfile
            ? "onboarding.profile.save_failed"
            : "onboarding.profile.dismiss_failed",
        ),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else void finish(false);
      }}
    >
      <DialogContent
        showCloseButton={!saving}
        className="workspace flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4 pr-12">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {t("onboarding.profile.title")}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {t("onboarding.profile.description")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
            void finish(true);
          }}
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            <ProfileFields
              profile={profile}
              disabled={saving}
              onChange={(patch) =>
                setProfile((previous) => ({ ...previous, ...patch }))
              }
            />
          </div>
          <DialogFooter className="m-0 shrink-0 rounded-none px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void finish(false)}
              disabled={saving}
            >
              {t("onboarding.profile.skip")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? t("settings.profile.saving")
                : t("settings.profile.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
