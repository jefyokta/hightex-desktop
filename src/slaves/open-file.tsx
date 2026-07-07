import { Button } from "@/components/ui/button";
import { HighTexImporter } from "@/utils/import-hightex";
import { truncate } from "@/utils/truncate";
import { useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

export const OpenFileSlave = () => {
  const navigate = useNavigate();

  useEffect(() => {

    const off = window.hightex.onOpenFile(async (path) => {
      try {
        console.log("open file", path);

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
            "Document already imported, wanna overwrite it?",
          );

          if (!confirmed) {
            return;
          }
        }

        toast.promise(importer.import(), {
          loading: "Importing document...",

          success: (doc) => ({
            message: "Import Success!",
            description: (
              <div className="flex items-center gap-2">
                <span>Added {truncate(doc.title, 20)}</span>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/document/${doc.id}/1`)}
                >
                  Open
                </Button>
              </div>
            ),
          }),

          error: (error) => ({
            message: "Import Failed",
            description: error instanceof Error ? error.message : String(error),
          }),
        });
      } catch (error) {
        toast.error("Unable to open file", {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return () => off?.();
  }, [navigate]);

  return null;
};
