import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Manager } from "@/editor/manager";
import { useExpandableSidebar } from "@/hooks/use-expandable-sidebar";
import { t } from "@/utils/lang";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";

export const DocumentProfileNotice = ({
  documentId,
}: {
  documentId: string;
}) => {
  const [missing, setMissing] = useState(false);
  const [cloud, setCloud] = useState(false);
  const { setContent, setOpen } = useExpandableSidebar();

  useEffect(() => {
    let mounted = true;
    const update = (document?: HighTexDocument) => {
      if (mounted) {
        setCloud(Boolean(document?.cloudAcademic));
        setMissing(
          !document?.profile?.name.trim() || !document.profile.nim.trim(),
        );
      }
    };
    void HighTexDB.getInstance().documents.get(documentId).then(update);
    const off = Manager.app.on("document:updated", ({ document }) => {
      if (document.id === documentId) update(document);
    });
    return () => {
      mounted = false;
      off();
    };
  }, [documentId]);

  if (!missing) return null;

  return (
    <Alert className="w-[21cm] max-w-full">
      <Info />
      <AlertTitle>{t("document_profile.notice_title")}</AlertTitle>
      <AlertDescription>
        <p>
          {t(
            cloud
              ? "cloud_academic.missing"
              : "document_profile.notice_description",
          )}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setContent("setting");
            setOpen(true);
          }}
        >
          {t("document_profile.open_settings")}
        </Button>
      </AlertDescription>
    </Alert>
  );
};
