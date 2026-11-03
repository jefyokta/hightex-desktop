import { useId } from "react";
import { LecturerPicker, LecturerDirectoryStatus } from "./lecturer-picker";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { t } from "@/utils/lang";

export function AdvisorFields({
  profile,
  onChange,
  intern = false,
  readOnly = false,
}: {
  profile: Pick<Profile, "advisorName" | "advisorNip" | "secondAdvisor">;
  onChange(patch: Partial<Profile>): void;
  intern?: boolean;
  readOnly?: boolean;
}) {
  const id = useId();
  if (intern)
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`}>
            {t("document_profile.campus_advisor")}
          </Label>
          <Input
            id={`${id}-name`}
            value={profile.advisorName}
            onChange={(e) => onChange({ advisorName: e.target.value })}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-nip`}>
            {t("settings.profile.advisor.nip.label")}
          </Label>
          <Input
            id={`${id}-nip`}
            value={profile.advisorNip}
            onChange={(e) => onChange({ advisorNip: e.target.value })}
            disabled={readOnly}
          />
        </div>
      </div>
    );
  return (
    <div className="space-y-3">
      <LecturerDirectoryStatus />
      <LecturerPicker
        label={t("settings.profile.advisor.name.label")}
        value={{ name: profile.advisorName, nip: profile.advisorNip }}
        onChange={(person) =>
          onChange({ advisorName: person.name, advisorNip: person.nip })
        }
        disabled={readOnly}
      />
      {profile.secondAdvisor && (
        <LecturerPicker
          label={t("settings.profile.second_advisor.name.label")}
          value={profile.secondAdvisor}
          onChange={(person) =>
            onChange({ secondAdvisor: { name: person.name, nip: person.nip } })
          }
          disabled={readOnly}
        />
      )}
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              secondAdvisor: profile.secondAdvisor
                ? undefined
                : { name: "", nip: "" },
            })
          }
        >
          {t(
            profile.secondAdvisor
              ? "document_profile.remove_second_advisor"
              : "settings.profile.second_advisor.enable_label",
          )}
        </Button>
      )}
    </div>
  );
}
