import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Languages, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuthModal } from "@/context/auth-modal-context";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LANGUAGE_OPTIONS,
  t,
  useAppLanguage,
  type SupportedLanguage,
} from "@/utils/lang";

export function WorkspaceWelcomeDialog() {
  const language = useAppLanguage();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { loginOpen } = useAuthModal();
  const { state } = useWorkspaces();
  const workspace = state?.profiles.find(
    (profile) => profile.id === state.activeId,
  );
  const workspaceId = workspace?.id;
  const [installation, setInstallation] = useState<{
    workspaceId: string;
    status: OnboardingStatus;
  }>();
  const [saving, setSaving] = useState(false);
  const operation = useRef(false);

  useEffect(() => {
    if (!workspaceId || window.application?.editorDocumentId) return;
    let alive = true;
    const refresh = () => {
      void window.hightex.onboarding
        .status()
        .then((status) => {
          if (alive) setInstallation({ workspaceId, status });
        })
        .catch(() => {
          // A failed welcome read must not block access to the workspace.
        });
    };
    refresh();
    window.addEventListener("hightex:onboarding-changed", refresh);
    return () => {
      alive = false;
      window.removeEventListener("hightex:onboarding-changed", refresh);
    };
  }, [workspaceId]);

  const cloud = workspace?.type === "cloud";
  const waitingForLogin =
    workspace?.pendingCloudBinding || (cloud && !workspace?.accountId);
  const mainPage =
    pathname === "/" ||
    pathname === "/settings" ||
    pathname.startsWith("/dashboard");
  const open = Boolean(
    state?.migrationComplete &&
    workspace &&
    mainPage &&
    !window.application?.editorDocumentId &&
    !waitingForLogin &&
    !loginOpen &&
    installation?.workspaceId === workspace.id &&
    installation.status.profileSetupPending,
  );

  const changeLanguage = async (value: SupportedLanguage) => {
    if (operation.current) return;
    operation.current = true;
    setSaving(true);
    try {
      await window.config.set({ language: value });
    } catch {
      toast.error(t("onboarding.welcome.language_failed"));
    } finally {
      operation.current = false;
      setSaving(false);
    }
  };

  const finish = async (editProfile = false) => {
    if (!workspaceId || operation.current) return;
    operation.current = true;
    setSaving(true);
    try {
      const status = await window.hightex.onboarding.acknowledgeProfileSetup();
      setInstallation({ workspaceId, status });
      if (editProfile) navigate("/profile");
      window.dispatchEvent(new Event("hightex:onboarding-changed"));
    } catch {
      toast.error(t("onboarding.profile.dismiss_failed"));
    } finally {
      operation.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void finish();
      }}
    >
      <DialogContent
        data-workspace-welcome
        showCloseButton={!saving}
        className="workspace flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogHeader className="shrink-0 px-6 pt-7 pb-5 pr-12">
          <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <DialogTitle className="break-words text-2xl leading-tight font-semibold tracking-tight">
            {t("onboarding.welcome.title", { name: workspace?.name })}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {t("onboarding.welcome.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-5 overflow-y-auto px-6 pb-6">
          <div className="space-y-2">
            <label
              htmlFor="workspace-welcome-language"
              className="flex items-center gap-2 text-sm font-medium"
            >
              <Languages
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              {t("onboarding.welcome.language")}
            </label>
            <NativeSelect
              id="workspace-welcome-language"
              value={language}
              disabled={saving}
              onChange={(event) =>
                void changeLanguage(event.target.value as SupportedLanguage)
              }
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("onboarding.welcome.language_hint")}
            </p>
          </div>

          <div className="flex gap-3 rounded-xl border bg-muted/30 p-4">
            <UserRound
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                {t(
                  cloud
                    ? "onboarding.welcome.cloud_profile"
                    : "onboarding.welcome.local_profile",
                )}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t(
                  cloud
                    ? "onboarding.welcome.cloud_hint"
                    : "onboarding.welcome.local_hint",
                )}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="m-0 shrink-0 rounded-none px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            data-welcome-later
            onClick={() => void finish()}
            disabled={saving}
          >
            {t("onboarding.profile.skip")}
          </Button>
          <Button
            type="button"
            data-welcome-profile
            onClick={() => void finish(true)}
            disabled={saving}
          >
            {t(
              cloud
                ? "onboarding.welcome.review_profile"
                : "onboarding.welcome.complete_profile",
            )}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
