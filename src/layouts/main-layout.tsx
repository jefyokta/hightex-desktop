import "@/App.css";
import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorProvider } from "@/context/error-context";
import { UserProvider } from "@/context/user-context";
import { AuthModalProvider } from "@/context/auth-modal-context";
import { LogoutModalProvider } from "@/context/logout-modal-context";

import { LoginModal } from "@/components/login-modal";
import { ErrorSlave } from "@/slaves/error";
import { toast, Toaster } from "sonner";
import { OpenFileSlave } from "@/slaves/open-file";
import { ConfirmProvider } from "@/context/confrim-context";
import { AskProvider } from "@/context/ask-context";
import { confirm } from "@/utils/confirm";

const UPDATER_TOAST_ID = "hightex-updater";

const formatPercent = (value: number) =>
  Math.max(0, Math.min(100, value)).toFixed(0);

const UpdaterStatusListener = () => {
  const installPromptOpen = useRef(false);

  useEffect(() => {
    if (!window.updater?.onStatus) {
      return;
    }

    const installUpdate = async () => {
      const result = await window.updater.install();

      if (!result.ok) {
        toast.error("Unable to install update", {
          id: UPDATER_TOAST_ID,
          description: result.message,
        });
      }
    };

    const unsubscribe = window.updater.onStatus(async (event) => {
      switch (event.status) {
        case "disabled": {
          if (event.manual) {
            toast.info("Auto updates are unavailable", {
              id: UPDATER_TOAST_ID,
              description: event.reason,
            });
          }
          break;
        }

        case "checking": {
          if (event.manual) {
            toast.loading("Checking for updates...", {
              id: UPDATER_TOAST_ID,
            });
          }
          break;
        }

        case "available": {
          toast.loading(`Downloading HighTex ${event.info.version}...`, {
            id: UPDATER_TOAST_ID,
            description: "The update will be ready to install shortly.",
          });
          break;
        }

        case "not-available": {
          if (event.manual) {
            toast.success("HighTex is up to date", {
              id: UPDATER_TOAST_ID,
              description: `Current version: ${event.info.version}`,
            });
          }
          break;
        }

        case "downloading": {
          toast.loading(
            `Downloading HighTex update ${formatPercent(event.progress.percent)}%`,
            {
              id: UPDATER_TOAST_ID,
              description: `${event.progress.transferred}/${event.progress.total} bytes`,
            },
          );
          break;
        }

        case "downloaded": {
          toast.success("Update ready to install", {
            id: UPDATER_TOAST_ID,
            description: `HighTex ${event.info.version} has been downloaded.`,
            action: {
              label: "Restart",
              onClick: () => void installUpdate(),
            },
            duration: Infinity,
          });

          if (installPromptOpen.current) {
            break;
          }

          installPromptOpen.current = true;

          try {
            const shouldRestart = await confirm({
              title: "HighTex update is ready",
              desc: `HighTex ${event.info.version} has been downloaded. Restart now to install it.`,
              confirmText: "Restart now",
              cancelText: "Later",
            });

            if (shouldRestart) {
              await installUpdate();
            }
          } finally {
            installPromptOpen.current = false;
          }

          break;
        }

        case "error": {
          if (event.manual) {
            toast.error("Unable to check for updates", {
              id: UPDATER_TOAST_ID,
              description: event.message,
            });
          }
          break;
        }
      }
    });

    return () => unsubscribe?.();
  }, []);

  return null;
};

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
    applyTheme(theme);

    const unsubscribe = window.config.onChange((cfg) => {
      applyTheme(cfg.theme);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return (
    <ErrorProvider>
      <ConfirmProvider>
        <AskProvider>
          <OpenFileSlave />
          <UpdaterStatusListener />
          <ErrorSlave />
          <TooltipProvider>
            <UserProvider>
              <AuthModalProvider>
                <LogoutModalProvider>
                  <LoginModal />
                  <Outlet />
                </LogoutModalProvider>
              </AuthModalProvider>
            </UserProvider>
            <Toaster
              position="bottom-right"
              theme={window.config.get()?.theme || "system"}
              className="flex justify-between toasta"
            />
          </TooltipProvider>
        </AskProvider>
      </ConfirmProvider>
    </ErrorProvider>
  );
};
