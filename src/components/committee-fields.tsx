import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/utils/lang";

const roles = [
  ["chair", "editor.expandable.setting.leaded_by"],
  ["examiner1", "editor.expandable.setting.primary_examiner_name"],
  ["examiner2", "editor.expandable.setting.secondary_examiner_name"],
] as const;

export function CommitteeFields({
  value = {},
  onChange,
}: {
  value?: AcademicCommittee;
  onChange: (value: AcademicCommittee) => void;
}) {
  const id = useId();
  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {t("editor.expandable.setting.thesis_examination_committee")}
      </summary>
      <div className="mt-4 space-y-4">
        {roles.map(([role, label]) => (
          <div key={role} className="grid gap-2">
            <Label htmlFor={`${id}-${role}-name`}>{t(label)}</Label>
            <Input
              id={`${id}-${role}-name`}
              value={value[role]?.name ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  [role]: {
                    name: event.target.value,
                    nip: value[role]?.id ? "" : (value[role]?.nip ?? ""),
                  },
                })
              }
            />
            <Label
              className="text-xs text-muted-foreground"
              htmlFor={`${id}-${role}-nip`}
            >
              NIP / NIK
            </Label>
            <Input
              id={`${id}-${role}-nip`}
              value={value[role]?.nip ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  [role]: {
                    name: value[role]?.name ?? "",
                    nip: event.target.value,
                  },
                })
              }
            />
          </div>
        ))}
      </div>
    </details>
  );
}
