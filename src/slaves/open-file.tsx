import { HighTexImporter } from "@/utils/import-v2";
import { useEffect } from "react";
import { toast } from "sonner";
import { t } from "@/utils/lang";
import { resolveImportMode } from "@/utils/import-conflict";

export const OpenFileSlave = () => {
  useEffect(() => {
    const off = window.hightex.onOpenFile(async (path) => {
      try {
        const workspaces = await window.workspaces.state();
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
        const buffer = await window.hightex.readFile(path);

        const uint8 = new Uint8Array(buffer);

        const file = new File(
          [uint8],
          path.split(/[\\/]/).pop() || "file.hightex",
          {
            type: "application/octet-stream",
          },
        );

        const importer = await HighTexImporter.create(file, path);

        const mode = await resolveImportMode(importer);
        if (!mode) return;
        const id = toast.loading(t("open_file.importing"));
        await importer
          .import(mode)
          .then((doc) => {
            return window.editor.open(doc.id, doc.file);
          })
          .catch(() => {
            toast.error(t("open_file.import_failed"));
          })
          .finally(() => {
            toast.dismiss(id);
          });
      } catch (error) {
        toast.error(t("open_file.open_failed"), {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return () => off?.();
  }, []);

  return null;
};
