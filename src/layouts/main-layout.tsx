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
import { CliDocumentsSlave } from "@/slaves/cli-documents";
import { ConfirmProvider } from "@/context/confrim-context";
import { AskProvider } from "@/context/ask-context";
import { confirm } from "@/utils/confirm";
import { isMac } from "@/utils/is-mac";
import { Copy } from "lucide-react";

const UPDATER_TOAST_ID = "hightex-updater";
const mb = (bytes: number) => {
  return (bytes / 1024 / 1024).toFixed(2);
};
const formatPercent = (value: number) =>
  Math.max(0, Math.min(100, value)).toFixed(0);

const UpdaterStatusListener = () => {
  const installPromptOpen = useRef(false);
  const downloadPromptOpen = useRef(false);

  useEffect(() => {
    if (!window.updater?.onStatus) return;

    const downloadAndInstall = async () => {
      await window.updater.download();
    };

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
            toast.loading("Checking for updates...", { id: UPDATER_TOAST_ID });
          }
          break;
        }

        case "available": {
          if (downloadPromptOpen.current) break;
          downloadPromptOpen.current = true;

          try {
            toast.info(`HighTex ${event.info.version} is available`, {
              id: UPDATER_TOAST_ID,
              description: "A new version is ready to download.",
              duration: Infinity,
              action: {
                label: "Download",
                onClick: () => void downloadAndInstall(),
              },
              cancel: {
                label: "Later",
                onClick: () => toast.dismiss(UPDATER_TOAST_ID),
              },
            });

            if (event.manual) {
              const shouldDownload = await confirm({
                title: `HighTex ${event.info.version} Available`,
                desc: "A new version is ready to download. Download now?",
                confirmText: "Download",
                cancelText: "Later",
              });

              if (shouldDownload) {
                toast.loading(`Downloading HighTex ${event.info.version}...`, {
                  id: UPDATER_TOAST_ID,
                  description: "The update will be ready to install shortly.",
                });
                await downloadAndInstall();
              } else {
                toast.dismiss(UPDATER_TOAST_ID);
              }
            }
          } finally {
            downloadPromptOpen.current = false;
          }
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
            `Downloading update ${formatPercent(event.progress.percent)}%`,
            {
              id: UPDATER_TOAST_ID,
              description: `${mb(event.progress.transferred)} / ${mb(event.progress.total)} mb`,
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

          if (installPromptOpen.current) break;
          installPromptOpen.current = true;

          try {
            if (isMac) {
              toast.error("Auto-update failed", {
                description:
                  "macOS blocked the update due to a signature issue. Copy and run the command to install it manually.",
                action: {
                  label: <Copy size={12} />,
                  onClick: () =>
                    navigator.clipboard
                      .writeText(
                        "rm -rf /Applications/HighTex.app && unzip ~/Library/Caches/hightex-desktop-updater/update.zip -d /Applications/",
                      )
                      .then((_) => {
                        toast.success("copied", { id: UPDATER_TOAST_ID });
                      })
                      .catch((_) => {
                        toast.error("failed to copy", { id: UPDATER_TOAST_ID });
                      }),
                },
                id: UPDATER_TOAST_ID,
              });

              return;
            }
            const shouldRestart = await confirm({
              title: "HighTex update is ready",
              desc: `HighTex ${event.info.version} has been downloaded. Restart now to install it.`,
              confirmText: "Restart now",
              cancelText: "Later",
            });

            if (shouldRestart) await installUpdate();
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
          <CliDocumentsSlave />
          <UpdaterStatusListener />
          <TooltipProvider>
            <UserProvider>
              <AuthModalProvider>
                <LogoutModalProvider>
                  <ErrorSlave />
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
