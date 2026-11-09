import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { confirm } from "@/utils/confirm";
import { isMac } from "@/utils/is-mac";
import { t } from "@/utils/lang";

const TOAST_ID = "hightex-updater";
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

export function UpdaterStatusListener() {
  const installPromptOpen = useRef(false);
  const downloadPromptOpen = useRef(false);
  useEffect(() => {
    const api = window.updater;
    if (!api) return;
    const download = async () => {
      try {
        await api.download();
      } catch (error) {
        toast.error(t("settings.updater.download_failed"), {
          id: TOAST_ID,
          description: error instanceof Error ? error.message : undefined,
        });
      }
    };
    const install = async () => {
      try {
        const result = await api.install();
        if (!result.ok && !result.cancelled)
          toast.error(t("settings.updater.install_failed"), {
            id: TOAST_ID,
            description: result.message,
          });
      } catch (error) {
        toast.error(t("settings.updater.install_failed"), {
          id: TOAST_ID,
          description: error instanceof Error ? error.message : undefined,
        });
      }
    };
    return api.onStatus(async (event) => {
      switch (event.status) {
        case "disabled":
          if (event.manual)
            toast.info(t("settings.updater.unavailable"), {
              id: TOAST_ID,
              description: event.reason,
            });
          break;
        case "checking":
          if (event.manual)
            toast.loading(t("settings.updater.checking"), { id: TOAST_ID });
          break;
        case "available": {
          if (downloadPromptOpen.current) break;
          downloadPromptOpen.current = true;
          try {
            toast.info(
              t("settings.updater.available", { version: event.info.version }),
              {
                id: TOAST_ID,
                description: t("settings.updater.available_description"),
                duration: Infinity,
                action: {
                  label: t("settings.updater.download"),
                  onClick: () => void download(),
                },
                cancel: {
                  label: t("settings.updater.later"),
                  onClick: () => toast.dismiss(TOAST_ID),
                },
              },
            );
            if (
              event.manual &&
              !localStorage.getItem(`canceled-${event.info.version}`)
            ) {
              const accepted = await confirm({
                title: t("settings.updater.available", {
                  version: event.info.version,
                }),
                desc: t("settings.updater.available_description"),
                confirmText: t("settings.updater.download"),
                cancelText: t("settings.updater.later"),
              });
              if (accepted) await download();
              else {
                localStorage.setItem(`canceled-${event.info.version}`, "1");
                toast.dismiss(TOAST_ID);
              }
            }
          } finally {
            downloadPromptOpen.current = false;
          }
          break;
        }
        case "not-available":
          if (event.manual)
            toast.success(t("settings.updater.up_to_date"), {
              id: TOAST_ID,
              description: t("settings.updater.current_version", {
                version: event.info.version,
              }),
            });
          break;
        case "downloading":
          toast.loading(
            t("settings.updater.downloading", {
              percent: Math.max(
                0,
                Math.min(100, event.progress.percent),
              ).toFixed(0),
            }),
            {
              id: TOAST_ID,
              description: `${mb(event.progress.transferred)} / ${mb(event.progress.total)} MB`,
            },
          );
          break;
        case "downloaded": {
          toast.success(
            t("settings.updater.ready", { version: event.info.version }),
            {
              id: TOAST_ID,
              duration: Infinity,
              action: {
                label: t("settings.updater.restart_install"),
                onClick: () => void install(),
              },
            },
          );
          if (installPromptOpen.current || event.retry) break;
          installPromptOpen.current = true;
          try {
            const accepted = await confirm({
              title: t("settings.updater.ready", {
                version: event.info.version,
              }),
              desc: t(
                isMac
                  ? "settings.updater.mac_install_hint"
                  : "settings.updater.install_hint",
              ),
              confirmText: t("settings.updater.restart_install"),
              cancelText: t("settings.updater.later"),
            });
            if (accepted) await install();
          } finally {
            installPromptOpen.current = false;
          }
          break;
        }
        case "installing":
          toast.loading(t("settings.updater.installing"), {
            id: TOAST_ID,
            description: t("settings.updater.preparing_hint"),
          });
          break;
        case "error":
          if (event.manual)
            toast.error(t("settings.updater.check_failed"), {
              id: TOAST_ID,
              description: event.message,
            });
          break;
      }
    });
  }, []);
  return null;
}
