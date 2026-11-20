import { UpdaterStatusListener } from "@/components/updater-status-listener";
import "@/App.css";
import { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorProvider } from "@/context/error-context";
import { UserProvider } from "@/context/user-context";
import { AuthModalProvider } from "@/context/auth-modal-context";
import { LogoutModalProvider } from "@/context/logout-modal-context";

import { LoginModal } from "@/components/login-modal";
import { ErrorSlave } from "@/slaves/error";
import { Toaster } from "sonner";
import { OpenFileSlave } from "@/slaves/open-file";
import { CliDocumentsSlave } from "@/slaves/cli-documents";
import { ConfirmProvider } from "@/context/confrim-context";
import { AskProvider } from "@/context/ask-context";
import { useConfig } from "@/hooks/use-config";
import { MultiSelectProvider } from "@/context/multi-select-context";
import { WorkspaceAccessGuard } from "@/components/workspace-access-guard";
import { WorkspaceWelcomeDialog } from "@/components/workspace-welcome-dialog";
import { WindowTitleSlave } from "@/slaves/window-title";
const applyTheme = (theme: "light" | "dark" | "system") => {
  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("dark");
    return;
  }

  if (theme === "light") {
    root.classList.remove("dark");
    return;
  }

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  root.classList.toggle("dark", systemDark);
};

export const MainLayout = () => {
  const { config } = useConfig();
  const theme = config?.theme ?? "system";
  useEffect(() => {
    applyTheme(theme);
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const changed = () => { if (theme === "system") applyTheme(theme); };
    system.addEventListener("change", changed);
    return () => system.removeEventListener("change", changed);
  }, [theme]);

  return (
    <ErrorProvider>
      <ConfirmProvider>
        <AskProvider>
          <MultiSelectProvider>
            <WindowTitleSlave />
            <OpenFileSlave />
            <CliDocumentsSlave />
            <UpdaterStatusListener />
            <TooltipProvider>
              <UserProvider>
                <AuthModalProvider>
                  <LogoutModalProvider>
                    <ErrorSlave />
                    <LoginModal />
                    <WorkspaceWelcomeDialog />
                    <WorkspaceAccessGuard>
                      <Outlet />
                    </WorkspaceAccessGuard>
                  </LogoutModalProvider>
                </AuthModalProvider>
              </UserProvider>
              <Toaster
                position="bottom-right"
                theme={theme}
                className="flex justify-between toasta"
              />
            </TooltipProvider>
          </MultiSelectProvider>
        </AskProvider>
      </ConfirmProvider>
    </ErrorProvider>
  );
};
