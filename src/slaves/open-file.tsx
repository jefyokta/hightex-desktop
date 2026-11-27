import { useIPC } from "@/hooks/use-ipc";
import { HighTexImporter } from "@/utils/import-v2";
import { useEffect } from "react";
import { toast } from "sonner";
import { t } from "@/utils/lang";
import { ShouldNotified } from "@/exception/interfaces/should-notified";

export const OpenFileSlave = () => {
  useEffect(() => {
    const off = useIPC("hightex").hightex.onOpenFile(async (path) => {
      try {
        const workspaces = await useIPC("workspaces").workspaces.state();
        const active = workspaces.profiles.find(
          (profile) => profile.id === workspaces.activeId,
        );
        if (
          navigator.onLine &&
          (active?.pendingCloudBinding ||
            (active?.type === "cloud" && !active.accountId))
        ) {
          toast.error(t("workspace_profiles.cloud_login_required"));
          return;
        }
        const buffer = await useIPC("hightex").hightex.readFile(path);

        const uint8 = new Uint8Array(buffer);

        const file = new File(
          [uint8],
          path.split(/[\\/]/).pop() || "file.hightex",
          {
            type: "application/octet-stream",
          },
        );

        const importer = await HighTexImporter.create(file, path);

        const id = toast.loading(t("open_file.importing"));
        try {
          await importer.open();
        } finally {
          toast.dismiss(id);
        }
      } catch (error) {
        toast.error(t("open_file.open_failed"), {
          description: error instanceof ShouldNotified
            ? error.description
            : error instanceof Error ? error.message : String(error),
        });
      }
    });

    return () => off?.();
  }, []);

  return null;
};
