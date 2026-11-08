import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Manager } from "@/editor/manager";
import { t } from "@/utils/lang";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { resolveWorkspaceDocumentProfile } from "@/utils/document-profile";
import { openProfileInMainWindow } from "@/utils/open-profile-in-main-window";

export const DocumentProfileNotice = ({
  documentId,
}: {
  documentId: string;
}) => {
  const [missing, setMissing] = useState(false);
  const [cloud, setCloud] = useState(false);

  useEffect(() => {
    let mounted = true;
    const update = async (document?: HighTexDocument) => {
      const current =
        document ?? (await HighTexDB.getInstance().documents.get(documentId));
      if (!current || !mounted) return;
      const profile = await resolveWorkspaceDocumentProfile(current);
      if (!mounted) return;
      setCloud(Boolean(current.cloudAcademic));
      setMissing(!profile.name.trim() || !profile.nim.trim());
    };
    void update();
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
          onClick={() => void openProfileInMainWindow()}
        >
          {t("document_profile.open_settings")}
        </Button>
      </AlertDescription>
    </Alert>
  );
};
