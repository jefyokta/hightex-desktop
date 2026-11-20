import { Cloud, LogIn, PanelsTopLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthModal } from "@/context/auth-modal-context";
import { t } from "@/utils/lang";
import { Button, buttonVariants } from "./ui/button";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { WorkspaceAccount } from "./workspace-account";

export function CloudWorkspaceAuthGate() {
  const { openLogin } = useAuthModal();
  const { state } = useWorkspaces();
  const active = state?.profiles.find(
    (profile) => profile.id === state.activeId,
  );
  return (
    <main className="workspace flex min-h-screen items-center justify-center bg-background px-5 py-12 text-foreground">
      <section className="w-full max-w-md space-y-5 text-center">
        <span className="workspace-brand-icon mx-auto flex size-16 items-center justify-center rounded-2xl">
          <Cloud className="size-7" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("workspace_profiles.cloud_login_required")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("workspace_profiles.cloud_login_description")}
          </p>
        </div>
        {active && <WorkspaceAccount profile={active} />}
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={openLogin}>
            <LogIn />
            {t("common.login")}
          </Button>
          <Link
            to="/workspaces"
            className={buttonVariants({ variant: "outline" })}
          >
            <PanelsTopLeft />
            {t("workspace_profiles.manage")}
          </Link>
        </div>
      </section>
    </main>
  );
}
