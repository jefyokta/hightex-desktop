import { AdvisorFields } from "@/components/advisor-fields";
import { CommitteeFields } from "@/components/committee-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/utils/lang";

export type EditableProfile = Omit<Profile, "cv">;

export function ProfileFields({
  profile,
  onChange,
  disabled = false,
}: {
  profile: EditableProfile;
  onChange(patch: Partial<Profile>): void;
  disabled?: boolean;
}) {
  return (
    <>
      <div data-tour="default-profile-identity" className="space-y-6">
        <div className="grid w-full grid-cols-2 items-center gap-4">
          <div className="space-y-0.5">
            <Label>{t("settings.profile.name.label")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("settings.profile.name.description")}
            </p>
          </div>
          <Input
            value={profile.name}
            disabled={disabled}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </div>

        <div className="grid w-full grid-cols-2 items-center gap-4">
          <div className="space-y-0.5">
            <Label>{t("settings.profile.nim.label")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("settings.profile.nim.description")}
            </p>
          </div>
          <Input
            value={profile.nim}
            disabled={disabled}
            onChange={(event) => onChange({ nim: event.target.value })}
          />
        </div>
      </div>

      <AdvisorFields
        profile={profile}
        readOnly={disabled}
        onChange={onChange}
      />
      <CommitteeFields
        value={profile.committee}
        disabled={disabled}
        onChange={(committee) => onChange({ committee })}
      />
    </>
  );
}
