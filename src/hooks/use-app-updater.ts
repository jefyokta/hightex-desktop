import { useIPC } from "@/hooks/use-ipc";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { t } from "@/utils/lang";

export function useAppUpdater() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => useIPC("updater").updater?.onStatus(next => {
    setStatus(next);
    if (next.status !== "checking" && next.status !== "downloading") setChecking(false);
  }), []);

  const check = async () => {
    setChecking(true);
    try {
      await useIPC("updater").updater?.check();
    } finally {
      setChecking(false);
    }
  };

  const download = async () => {
    await useIPC("updater").updater?.download();
  };

  const install = async () => {
    const result = await useIPC("updater").updater?.install();
    if (result && !result.ok && !result.cancelled) {
      toast.error(result.message || t("settings.updater.install_failed"));
    }
  };

  const canCheck = !checking && ![
    "checking", "downloading", "downloaded", "installing",
  ].includes(status?.status ?? "");

  return { status, checking, canCheck, check, download, install };
}
