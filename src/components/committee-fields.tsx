import { Disclosure } from "@/components/ui/disclosure";
import { t } from "@/utils/lang";
import { LecturerPicker } from "./lecturer-picker";

const roles = [
  ["chair", "editor.expandable.setting.leaded_by"],
  ["examiner1", "editor.expandable.setting.primary_examiner_name"],
  ["examiner2", "editor.expandable.setting.secondary_examiner_name"],
] as const;

export function CommitteeFields({
  value = {},
  onChange,
  disabled = false,
}: {
  value?: AcademicCommittee;
  onChange: (value: AcademicCommittee) => void;
  disabled?: boolean;
}) {
  return (
    <Disclosure
      data-tour="profile-committee"
      className="rounded-md border p-3"
      triggerClassName="cursor-pointer text-sm font-medium"
      label={t("document_profile.committee_title")}
    >
      <div className="mt-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          {t("document_profile.committee_hint")}
        </p>
        {roles.map(([role, label]) => (
          <LecturerPicker
            key={role}
            label={t(label)}
            disabled={disabled}
            value={value[role] ?? { name: "", nip: "" }}
            onChange={(person) => onChange({ ...value, [role]: person })}
          />
        ))}
      </div>
    </Disclosure>
  );
}
