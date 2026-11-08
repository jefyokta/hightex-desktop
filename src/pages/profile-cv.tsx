import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/dashboard/page-header";
import { LocalCVEditor } from "@/components/local-cv-editor";
import { Button } from "@/components/ui/button";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useProfileDraft } from "@/hooks/use-profile-draft";
import { t } from "@/utils/lang";
import { CloudCVEditor } from "./cloud/cv";

export function ProfileCV() {
  const { state } = useWorkspaces();
  const active = state?.profiles.find(
    (profile) => profile.id === state.activeId,
  );
  const draft = useProfileDraft();
  return (
    <>
      <PageHeader
        eyebrow={active?.name}
        title={t("document_profile.cv_title")}
        description={t("document_profile.cv_description")}
        actions={
          <Button asChild variant="outline">
            <Link to="/profile">
              <ArrowLeft className="size-4" />
              {t("profile.back_to_profile")}
            </Link>
          </Button>
        }
      />
      {active?.type === "local" ? (
        <div data-tour="workspace-cv-editor">
          <LocalCVEditor
            onDirtyChange={draft.onDirtyChange}
            onBusyChange={draft.onBusyChange}
          />
        </div>
      ) : active?.type === "cloud" ? (
        <div data-tour="workspace-cv-editor">
          <CloudCVEditor
            onDirtyChange={draft.onDirtyChange}
            onBusyChange={draft.onBusyChange}
          />
        </div>
      ) : null}
      {draft.guard}
    </>
  );
}
