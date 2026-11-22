import { Button } from "@/components/ui/button";
import { t } from "@/utils/lang";
import { SettingsSection } from "./fields";

const committeeLabels = {
  chair: "editor.expandable.setting.leaded_by",
  examiner1: "editor.expandable.setting.primary_examiner_name",
  examiner2: "editor.expandable.setting.secondary_examiner_name",
} as const;

export function WorkspaceProfileSection({ profile, onEdit }: {
  profile?: AuthorProfile;
  onEdit(): void;
}) {
  return (
    <SettingsSection tour="document-profile" title={t("document_profile.title")}>
      <p className="text-xs text-muted-foreground">{t("document_profile.workspace_only")}</p>
      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
        <ProfileValue label={t("settings.profile.name.label")} value={profile?.name} />
        <ProfileValue label={t("settings.profile.nim.label")} value={profile?.nim} />
        <ProfileValue label={t("settings.profile.advisor.name.label")} value={profile?.advisorName} />
        <ProfileValue label={t("settings.profile.advisor.nip.label")} value={profile?.advisorNip} />
        {profile?.secondAdvisor && (
          <ProfileValue label={t("settings.profile.second_advisor.name.label")} value={profile.secondAdvisor.name} />
        )}
        {Object.entries(profile?.committee ?? {}).map(([role, person]) => (
          <ProfileValue key={role}
            label={t(committeeLabels[role as keyof AcademicCommittee])}
            value={person?.name} />
        ))}
      </div>
      <Button data-tour="document-profile-source" size="sm" variant="outline" onClick={onEdit}>
        {t("document_profile.edit_in_profile")}
      </Button>
    </SettingsSection>
  );
}

function ProfileValue({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm">{value?.trim() || "—"}</p>
    </div>
  );
}
