import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { t } from "@/utils/lang";
import { useWorkspaces } from "@/hooks/use-workspaces";

export function FirstInstallProfileDialog({
  guide,
}: {
  guide: GuideController;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const attempted = useRef(false);
  const { status, plan, phase } = guide;
  const { state: workspaceState } = useWorkspaces();
  const activeWorkspace = workspaceState?.profiles.find(
    (profile) => profile.id === workspaceState.activeId,
  );
  const local =
    activeWorkspace?.type === "local" && !activeWorkspace.pendingCloudBinding;

  useEffect(() => {
    if (
      !local ||
      pathname === "/workspaces" ||
      pathname === "/profile" ||
      !status?.profileSetupPending ||
      plan ||
      phase ||
      open ||
      attempted.current
    )
      return;

    attempted.current = true;
    setOpen(true);
  }, [status, plan, phase, open, local, pathname]);

  const chooseWorkspace = () => {
    attempted.current = false;
    setOpen(false);
    navigate("/workspaces");
  };

  const finish = async () => {
    setSaving(true);
    try {
      await window.hightex.onboarding.acknowledgeProfileSetup();
      setOpen(false);
    } catch {
      toast.error(t("onboarding.profile.dismiss_failed"));
    } finally {
      setSaving(false);
    }
  };

  const editProfile = () => {
    attempted.current = true;
    setOpen(false);
    navigate("/profile");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else void finish();
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

        <div className="px-6 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={chooseWorkspace}
            disabled={saving}
          >
            {t("workspace_profiles.choose_before_profile")}
          </Button>
        </div>

        <DialogFooter className="m-0 shrink-0 rounded-none px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void finish()}
            disabled={saving}
          >
            {t("onboarding.profile.skip")}
          </Button>
          <Button type="button" onClick={editProfile} disabled={saving}>
            {t("onboarding.profile.edit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
