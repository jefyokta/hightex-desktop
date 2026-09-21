import { Button } from "@/components/ui/button";
import { HighTexImporter } from "@/utils/import-hightex";
import { truncate } from "@/utils/truncate";
import { useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { t } from "@/utils/lang";

export const OpenFileSlave = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const off = window.hightex.onOpenFile(async (path) => {
      try {
        // console.log("open file", path);

        const buffer = await window.hightex.readFile(path);

        const uint8 = new Uint8Array(buffer);

        const file = new File(
          [uint8],
          path.split("/").pop() || "file.hightex",
          {
            type: "application/octet-stream",
          },
        );

        const importer = await HighTexImporter.create(file);

        if (importer.exists) {
          const confirmed = confirm(
            t("open_file.confirm_overwrite"),
          );

          if (!confirmed) {
            return;
          }
        }

        toast.promise(importer.import(), {
          loading: t("open_file.importing"),

          success: (doc) => ({
            message: t("open_file.import_success"),
            description: (
              <div className="flex items-center gap-2">
                <span>
                  {t("open_file.added", { title: truncate(doc.title, 20) })}
                </span>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/document/${doc.id}/1`)}
                >
                  {t("open")}
                </Button>
              </div>
            ),
          }),

          error: (error) => ({
            message: t("open_file.import_failed"),
            description: error instanceof Error ? error.message : String(error),
          }),
        });
      } catch (error) {
        toast.error(t("open_file.open_failed"), {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return () => off?.();
  }, [navigate]);

  return null;
};
