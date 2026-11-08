import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProfileCVPage } from "@/components/profile-cv-page";
import { Button } from "@/components/ui/button";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { resolveWorkspaceDocumentProfile } from "@/utils/document-profile";
import { t } from "@/utils/lang";
import { openProfileInMainWindow } from "@/utils/open-profile-in-main-window";
import { toast } from "sonner";

export const Cv = ({ onReady }: { onReady?: (ready: boolean) => void }) => {
  const { id } = useParams();
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<DocumentProfile>();

  useEffect(() => {
    let mounted = true;
    let revision = 0;
    setLoaded(false);
    setProfile(undefined);
    if (!id) return;

    const load = async () => {
      const request = ++revision;
      const document = await HighTexDB.getInstance().documents.get(id);
      if (!document || !mounted) return;
      const resolved = await resolveWorkspaceDocumentProfile(document);
      if (mounted && request === revision) {
        setProfile(resolved);
        setLoaded(true);
      }
    };
    const refresh = () => {
      void load().catch(() => {
        if (mounted) toast.error(t("onboarding.profile.load_failed"));
      });
    };
    refresh();
    const offProfile = window.profile.onChange?.(refresh);
    const offSession = window.session.onChange?.(refresh);

    return () => {
      mounted = false;
      offProfile?.();
      offSession?.();
    };
  }, [id]);

  useEffect(() => {
    onReady?.(loaded);
  }, [loaded, onReady]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3 text-sm">
        <span className="text-muted-foreground">
          {t("document_profile.workspace_only")}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void openProfileInMainWindow()}
        >
          {t("document_profile.edit_in_profile")}
        </Button>
      </div>
      <ProfileCVPage
        id="document-cv"
        value={profile?.cv ?? ""}
        picture={profile?.picture}
        busy={!loaded}
      />
    </>
  );
};
