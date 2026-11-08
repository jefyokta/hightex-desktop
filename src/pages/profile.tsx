import { Link } from "react-router-dom";
import { FileText, Pencil } from "lucide-react";
import { DefaultProfileSection } from "@/components/default-profile-section";
import { CloudAccountSummary } from "@/components/cloud-account-summary";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t } from "@/utils/lang";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useProfileDraft } from "@/hooks/use-profile-draft";

export const Profile = () => {
  const { state } = useWorkspaces();
  const active = state?.profiles.find(
    (profile) => profile.id === state.activeId,
  );
  const draft = useProfileDraft();
  return (
    <>
      <PageHeader
        eyebrow={active?.name}
        title={t("profile.title")}
        description={t("profile.description")}
      />
      {active?.type === "local" ? (
        <DefaultProfileSection
          onDirtyChange={draft.onDirtyChange}
          onBusyChange={draft.onBusyChange}
        />
      ) : active?.type === "cloud" ? (
        <CloudAccountSummary />
      ) : null}
      <Card data-profile-cv-link>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            {t("document_profile.cv_title")}
          </CardTitle>
          <CardDescription>
            {t("document_profile.cv_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/profile/cv">
              <Pencil className="size-4" />
              {t("profile.edit_cv")}
            </Link>
          </Button>
        </CardContent>
      </Card>
      {draft.guard}
    </>
  );
};
