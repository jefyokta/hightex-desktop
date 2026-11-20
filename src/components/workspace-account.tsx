import { t } from "@/utils/lang";

/** The persisted workspace binding stays visible after logout and while offline. */
export function WorkspaceAccount({ profile }: { profile: WorkspaceProfile }) {
  if (profile.type !== "cloud" || !profile.accountId) return null;
  return (
    <p
      data-workspace-account
      className="mt-1 break-all text-xs text-muted-foreground"
    >
      {profile.accountEmail ??
        t("workspace_profiles.account_id", { id: profile.accountId })}
      {!profile.accountEmail && (
        <span className="block">{t("workspace_profiles.email_unknown")}</span>
      )}
    </p>
  );
}
