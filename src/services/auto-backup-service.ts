import { HighTexDB } from "@/editor/storage/hightex-db";
import { Exporter } from "@/utils/htx/exporter";
import { toast } from "sonner";
import { t } from "@/utils/lang";

export interface BackupResult {
  success: boolean;
  count: number;
  folder?: string;
  error?: string;
}

const formatTimestamp = (d = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
};

export class AutoBackupService {
  private static isRunning = false;

  static async performBackup(options?: {
    notify?: boolean;
    isManual?: boolean;
  }): Promise<BackupResult> {
    if (this.isRunning) {
      return { success: false, count: 0, error: "Backup is already in progress." };
    }

    const config = window.config.get()?.backup;
    if (!config || (!config.enabled && !options?.isManual)) {
      return { success: false, count: 0, error: "Auto backup is disabled." };
    }

    const folder = config.folder;
    if (!folder) {
      return { success: false, count: 0, error: "No backup folder specified." };
    }

    this.isRunning = true;

    try {
      const documents = await HighTexDB.getInstance().documents.toArray();
      if (documents.length === 0) {
        return { success: true, count: 0, folder };
      }

      let exportedCount = 0;
      const timestamp = formatTimestamp();

      for (const doc of documents) {
        try {
          const safeTitle =
            (doc.title || "Untitled")
              .replace(/[^a-zA-Z0-9-_\. ]/g, "-")
              .trim() || "Untitled";

          const fileName = config.includeTimestamp
            ? `${safeTitle}_${timestamp}.hightex`
            : `${safeTitle}.hightex`;

          const exporter = new Exporter(doc.id, {
            format: "json",
            ext: "hightex",
            showDialog: false,
            defaultFolder: folder,
            fileName,
          });

          const result = await exporter.export();
          if (!result.canceled) {
            exportedCount++;
          }
        } catch (err) {
          console.error(`Failed to auto-backup document: ${doc.id} (${doc.title})`, err);
        }
      }

      const now = Date.now();
      await window.config.set({
        backup: {
          ...config,
          lastBackupAt: now,
        },
      });

      window.dispatchEvent(
        new CustomEvent("hightex:backup:completed", {
          detail: { count: exportedCount, timestamp: now, folder },
        }),
      );

      const shouldNotify = options?.notify ?? config.notifyOnSuccess;
      if (shouldNotify && exportedCount > 0) {
        toast.success(
          t("settings.backup.notify_success", { count: exportedCount }),
          {
            description: folder,
            action: {
              label: t("settings.backup.open_folder"),
              onClick: () => {
                window.file?.openPath?.(folder);
              },
            },
          },
        );
      }

      return { success: true, count: exportedCount, folder };
    } catch (err: any) {
      console.error("Auto backup execution error", err);
      return {
        success: false,
        count: 0,
        error: err?.message || "Unknown backup error",
      };
    } finally {
      this.isRunning = false;
    }
  }
}
