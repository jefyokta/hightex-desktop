import { DatePickerInput } from "@/components/ui/date-picker";
import { t } from "@/utils/lang";
import { SettingsField, SettingsSection } from "./fields";

interface ConfigFieldsProps {
  value: HighTexConfig;
  onChange(patch: Partial<HighTexConfig>): void;
}

export function FacultyOfficialFields({ value, onChange, disabled }: ConfigFieldsProps & { disabled: boolean }) {
  return (
    <SettingsSection disabled={disabled} title={t("document_profile.faculty_officials")}>
      <OfficialFields value={value.kaprodi}
        nameLabel={t("editor.expandable.setting.kaprodi_name")}
        nipLabel={t("editor.expandable.setting.kaprodi_nip")}
        onChange={kaprodi => onChange({ kaprodi })} />
      <OfficialFields value={value.dekan}
        nameLabel={t("editor.expandable.setting.dekan_name")}
        nipLabel={t("editor.expandable.setting.dekan_nip")}
        onChange={dekan => onChange({ dekan })} />
    </SettingsSection>
  );
}

function OfficialFields({ value, nameLabel, nipLabel, onChange }: {
  value?: HighTexConfig["kaprodi"];
  nameLabel: string;
  nipLabel: string;
  onChange(value: NonNullable<HighTexConfig["kaprodi"]>): void;
}) {
  return (
    <>
      <SettingsField label={nameLabel} value={value?.name ?? ""}
        onChange={name => onChange({ ...value, name })} />
      <SettingsField label={nipLabel} value={value?.nip ?? ""}
        onChange={nip => onChange({ ...value, nip })} />
    </>
  );
}

export function ThesisDateFields({ value, onChange }: ConfigFieldsProps) {
  return (
    <SettingsSection title={t("editor.expandable.setting.thesis_dates")}>
      <DatePickerInput label={t("editor.expandable.setting.consent_date")} date={value.consentDate}
        setDate={consentDate => onChange({ consentDate })} />
      <DatePickerInput label={t("editor.expandable.setting.validity_date")} date={value.validityDate}
        setDate={validityDate => onChange({ validityDate })} />
      <DatePickerInput label={t("editor.expandable.setting.statement_date")} date={value.statementDate}
        setDate={statementDate => onChange({ statementDate })} />
    </SettingsSection>
  );
}

export function InternshipFields({ value, onChange }: {
  value: HighTexConfig["intern"];
  onChange(intern: HighTexConfig["intern"]): void;
}) {
  return (
    <SettingsSection title={t("editor.expandable.setting.intern_document_info")}>
      <SettingsField label={t("editor.expandable.setting.onsite_location")} value={value?.onsite_at ?? ""}
        onChange={onsite_at => onChange({ ...value, onsite_at })} />
      <OfficialFields value={value?.advisor}
        nameLabel={t("editor.expandable.setting.internship_advisor_name")}
        nipLabel={t("editor.expandable.setting.internship_advisor_nip")}
        onChange={advisor => onChange({ ...value, advisor })} />
      <DatePickerInput label={t("editor.expandable.setting.intern_validity_date")} date={value?.validity}
        setDate={validity => onChange({ ...value, validity })} />
    </SettingsSection>
  );
}
