import { PageHeader } from "@/components/dashboard/page-header";
import { WorkspaceProfiles } from "@/components/workspace-profiles";
import { t } from "@/utils/lang";

export const Workspaces = () => (
  <>
    <PageHeader
      title={t("workspace_profiles.title")}
      description={t("workspace_profiles.description")}
    />
    <WorkspaceProfiles />
  </>
);
