import { HighTexImporter } from "@/utils/import-v2";
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

        const importer = await HighTexImporter.create(file, path);

        if (importer.exists) {
          const confirmed = confirm(t("open_file.confirm_overwrite"));

          if (!confirmed) {
            return;
          }
        }
        const id = toast.loading(t("open_file.importing"));
        importer.import().then((doc) => {
          return window.editor.open(doc.id,doc.file);

        }).catch(()=>{
          toast.error(t("open_file.import_failed"));
        }).finally(()=>{
          toast.dismiss(id)
        })

      
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
