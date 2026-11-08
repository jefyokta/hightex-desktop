import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useOnline } from "@/hooks/use-online";
import { useAuthModal } from "@/context/auth-modal-context";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { CloudWorkspaceAuthGate } from "./cloud-workspace-auth-gate";
import { t } from "@/utils/lang";

export function WorkspaceAccessGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const online = useOnline();
  const { openLogin } = useAuthModal();
  const { state } = useWorkspaces();
  const prompted = useRef<string>();
  const active = state?.profiles.find((profile) => profile.id === state.activeId);
  const requiresLogin = Boolean(
    online &&
      active &&
      (active.pendingCloudBinding ||
        (active.type === "cloud" && !active.accountId)),
  );

  useEffect(() => {
    if (!requiresLogin || !active || prompted.current === active.id) return;
    prompted.current = active.id;
    openLogin();
  }, [active, openLogin, requiresLogin]);

  if (!state)
    return (
      <main className="workspace flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        {t("common.loading")}
      </main>
    );
  if (requiresLogin && pathname !== "/workspaces")
    return <CloudWorkspaceAuthGate />;
  return children;
}
