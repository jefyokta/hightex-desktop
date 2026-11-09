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
import { applyLanguage } from "@/utils/lang";
import { LocaleProvider } from "@/context/locale-context";
import { ConfigContextProvider } from "@/context/config-context";
import { MultiSelectProvider } from "@/context/multi-select-context";
import { WorkspaceAccessGuard } from "@/components/workspace-access-guard";
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
  useEffect(() => {
    const config = window.config.get();

    const theme = config?.theme ?? "system";
    const language = config?.language ?? "en";
    applyTheme(theme);
    applyLanguage(language);

    const unsubscribe = window.config.onChange((cfg) => {
      applyTheme(cfg.theme);
      applyLanguage(cfg.language ?? "en");
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <ConfigContextProvider>
      <LocaleProvider>
        <ErrorProvider>
          <ConfirmProvider>
            <AskProvider>
              <MultiSelectProvider>
                <OpenFileSlave />
                <CliDocumentsSlave />
                <UpdaterStatusListener />
                <TooltipProvider>
                  <UserProvider>
                    <AuthModalProvider>
                      <LogoutModalProvider>
                        <ErrorSlave />
                        <LoginModal />
                        <WorkspaceAccessGuard>
                          <Outlet />
                        </WorkspaceAccessGuard>
                      </LogoutModalProvider>
                    </AuthModalProvider>
                  </UserProvider>
                  <Toaster
                    position="bottom-right"
                    theme={window.config.get()?.theme || "system"}
                    className="flex justify-between toasta"
                  />
                </TooltipProvider>
              </MultiSelectProvider>
            </AskProvider>
          </ConfirmProvider>
        </ErrorProvider>
      </LocaleProvider>
    </ConfigContextProvider>
  );
};
