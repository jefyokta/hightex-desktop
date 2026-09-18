import { useEffect, useRef } from "react";
import { AutoBackupService } from "@/services/auto-backup-service";

export const AutoBackupSlave = () => {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const setupTimer = (backupConfig?: ConfigShape["backup"]) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (!backupConfig?.enabled) {
        return;
      }

      const minutes = Math.max(1, backupConfig.intervalMinutes || 30);
      const intervalMs = minutes * 60 * 1000;

      timerRef.current = setInterval(() => {
        AutoBackupService.performBackup();
      }, intervalMs);
    };

    const initialConfig = window.config.get();
    if (initialConfig?.backup) {
      setupTimer(initialConfig.backup);
    }

    const unsubscribe = window.config.onChange((cfg) => {
      setupTimer(cfg.backup);
    });

    const triggerListener = (event: Event) => {
      const ce = event as CustomEvent<{ notify?: boolean; isManual?: boolean }>;
      AutoBackupService.performBackup(ce.detail);
    };

    window.addEventListener("hightex:backup:trigger", triggerListener);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      unsubscribe?.();
      window.removeEventListener("hightex:backup:trigger", triggerListener);
    };
  }, []);

  return null;
};
