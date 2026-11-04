import type { LocaleKey } from "./lang";

const labels = {
  name: "settings.profile.name.label",
  nim: "settings.profile.nim.label",
  advisor: "settings.profile.advisor.name.label",
  secondAdvisor: "settings.profile.second_advisor.name.label",
  chair: "editor.expandable.setting.leaded_by",
  examiner1: "editor.expandable.setting.primary_examiner_name",
  examiner2: "editor.expandable.setting.secondary_examiner_name",
} satisfies Record<string, LocaleKey>;

export type DefaultProfileField = keyof typeof labels;
export interface DefaultProfileChange {
  field: DefaultProfileField;
  label: LocaleKey;
  before: { text: string; nip?: string };
  after: { text: string; nip?: string };
  clearsValue: boolean;
}
type Defaults = Omit<Profile, "cv">;
const value = (
  profile: Partial<Profile> | undefined,
  field: DefaultProfileField,
) => {
  if (field === "name" || field === "nim")
    return { text: profile?.[field] ?? "" };
  const person =
    field === "advisor"
      ? { name: profile?.advisorName ?? "", nip: profile?.advisorNip ?? "" }
      : field === "secondAdvisor"
        ? profile?.secondAdvisor
        : profile?.committee?.[field];
  return { text: person?.name ?? "", nip: person?.nip ?? "" };
};

/** Compare visible values; directory IDs alone do not replace an existing selection. */
export function defaultProfileChanges(
  current: Partial<Profile> | undefined,
  defaults: Defaults,
  intern = false,
): DefaultProfileChange[] {
  const fields: DefaultProfileField[] = intern
    ? ["name", "nim"]
    : (Object.keys(labels) as DefaultProfileField[]);
  return fields.flatMap((field) => {
    const before = value(current, field),
      after = value(defaults, field);
    if (before.text === after.text && before.nip === after.nip) return [];
    return [
      {
        field,
        label: labels[field],
        before,
        after,
        clearsValue: Boolean(
          (before.text.trim() && !after.text.trim()) ||
          (before.nip?.trim() && !after.nip?.trim()),
        ),
      },
    ];
  });
}

/** Apply only reviewed fields. CV, photo, other roles and config are outside this patch. */
export function defaultProfilePatch(
  current: Partial<Profile> | undefined,
  defaults: Defaults,
  selected: ReadonlySet<DefaultProfileField>,
  intern = false,
): Partial<Profile> {
  const patch: Partial<Profile> = {};
  for (const { field } of defaultProfileChanges(current, defaults, intern)) {
    if (!selected.has(field)) continue;
    if (field === "name" || field === "nim") patch[field] = defaults[field];
    else if (field === "advisor") {
      patch.advisorName = defaults.advisorName;
      patch.advisorNip = defaults.advisorNip;
    } else if (field === "secondAdvisor")
      patch.secondAdvisor = defaults.secondAdvisor
        ? structuredClone(defaults.secondAdvisor)
        : undefined;
    else {
      patch.committee ??= structuredClone(current?.committee ?? {});
      const person = defaults.committee?.[field];
      if (person) patch.committee[field] = structuredClone(person);
      else delete patch.committee[field];
    }
  }
  return patch;
}
