import {
  defaultSelection,
  emptyFormData,
  type FormData,
  type FormSelection,
  type FormStage,
} from "./model";

export const FORM_DRAFT_KEY = "hightex:forms:workspace:v1";
export const LEGACY_FORM_DRAFT_PREFIX = "hightex:forms:v1:";
const stages = ["proposal", "defense"] as const;
export const SHARED_FORM_FIELDS = [
  "program",
  "city",
  "internTitle",
  "internDate",
  "gpa",
  "credits",
  "people.head.name",
  "people.head.nip",
  "people.internAdvisor.name",
  "people.internAdvisor.nip",
] as const;
export const STAGE_FORM_FIELDS = [
  "eventDate",
  "eventTime",
  "eventPlace",
  "signDate",
] as const;
type DataField =
  | (typeof SHARED_FORM_FIELDS)[number]
  | (typeof STAGE_FORM_FIELDS)[number];
export type DraftField =
  | (typeof SHARED_FORM_FIELDS)[number]
  | "internId"
  | `${FormStage}.${(typeof STAGE_FORM_FIELDS)[number] | "choices"}`;
const fields: DraftField[] = [
  ...SHARED_FORM_FIELDS,
  "internId",
  ...stages.flatMap((stage) => [
    ...STAGE_FORM_FIELDS.map((field) => `${stage}.${field}` as DraftField),
    `${stage}.choices` as const,
  ]),
];
export type DraftConflict = {
  field: DraftField;
  options: { value: string; sources: string[] }[];
};
export type WorkspaceFormDraft = {
  version: 3;
  stage: FormStage;
  values: Partial<Record<DraftField, string>>;
  conflicts: DraftConflict[];
};
export type LegacyFormDraft = {
  documentId: string;
  stage: FormStage;
  values: WorkspaceFormDraft["values"];
};
type DraftStorage = Pick<Storage, "length" | "key" | "getItem">;

export const emptyWorkspaceFormDraft = (): WorkspaceFormDraft => ({
  version: 3,
  stage: "proposal",
  values: {},
  conflicts: [],
});
const isStage = (value: unknown): value is FormStage =>
  stages.includes(value as FormStage);
function choices(
  value: unknown,
  stage: FormStage,
): FormSelection[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return defaultSelection(stage).filter((item) =>
    value.some((choice) => choice?.code === item.code),
  );
}
function readValue(
  data: Partial<FormData> | undefined,
  field: DataField,
): string {
  const [root, role, key] = field.split(".");
  const value =
    root === "people"
      ? data?.people?.[role as "head" | "internAdvisor"]?.[
          key as "name" | "nip"
        ]
      : data?.[root as keyof FormData];
  return typeof value === "string" ? value : "";
}
function normalizeValues(value: unknown): WorkspaceFormDraft["values"] {
  const result: WorkspaceFormDraft["values"] = {};
  if (!value || typeof value !== "object") return result;
  for (const field of fields) {
    const item = (value as Record<string, unknown>)[field];
    if (typeof item !== "string" || item.length > 1000) continue;
    if (field.endsWith(".choices")) {
      try {
        const selected = choices(
          JSON.parse(item),
          field.split(".")[0] as FormStage,
        );
        if (selected) result[field] = JSON.stringify(selected);
      } catch {
        /* An invalid selection must not replace the defaults. */
      }
    } else result[field] = item;
  }
  return result;
}

export function readLegacyFormDrafts(storage: DraftStorage): LegacyFormDraft[] {
  const drafts: LegacyFormDraft[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(LEGACY_FORM_DRAFT_PREFIX)) continue;
    let saved;
    try {
      saved = JSON.parse(storage.getItem(key) ?? "null");
    } catch {
      continue;
    }
    if (![1, 2].includes(saved?.version) || !isStage(saved.stage)) continue;
    for (const stage of stages) {
      const input = saved.inputs?.[stage];
      const values: WorkspaceFormDraft["values"] = {};
      for (const field of SHARED_FORM_FIELDS) {
        const value = readValue(input, field).trim();
        if (value) values[field] = value;
      }
      for (const field of STAGE_FORM_FIELDS) {
        const value = readValue(input, field).trim();
        if (value) values[`${stage}.${field}`] = value;
      }
      if (typeof saved.internId === "string" && saved.internId.trim())
        values.internId = saved.internId;
      const selected = choices(saved.choices?.[stage], stage);
      if (selected) values[`${stage}.choices`] = JSON.stringify(selected);
      if (Object.keys(values).length)
        drafts.push({
          documentId: key.slice(LEGACY_FORM_DRAFT_PREFIX.length),
          stage,
          values: normalizeValues(values),
        });
    }
  }
  return drafts;
}

export function migrateFormDrafts(
  legacy: LegacyFormDraft[],
): WorkspaceFormDraft {
  const draft = emptyWorkspaceFormDraft();
  for (const field of fields) {
    const candidates = new Map<string, string[]>();
    for (const old of legacy) {
      const value = old.values[field];
      if (value === undefined) continue;
      const sources = candidates.get(value) ?? [];
      if (!sources.includes(old.documentId)) sources.push(old.documentId);
      candidates.set(value, sources);
    }
    if (candidates.size === 1) draft.values[field] = [...candidates.keys()][0];
    else if (candidates.size > 1)
      draft.conflicts.push({
        field,
        options: [...candidates].map(([value, sources]) => ({
          value,
          sources,
        })),
      });
  }
  return draft;
}

/** A single key belongs to the current profile's isolated browser origin. Legacy keys stay intact. */
export function readWorkspaceFormDraft(
  storage: DraftStorage,
): WorkspaceFormDraft {
  const raw = storage.getItem(FORM_DRAFT_KEY);
  if (raw === null) return migrateFormDrafts(readLegacyFormDrafts(storage));
  const saved = JSON.parse(raw);
  if (saved?.version !== 3 || !isStage(saved.stage))
    throw Error("Invalid workspace form draft");
  const conflicts: DraftConflict[] = [];
  if (Array.isArray(saved.conflicts))
    for (const conflict of saved.conflicts) {
      if (!fields.includes(conflict?.field) || !Array.isArray(conflict.options))
        continue;
      const options: DraftConflict["options"] = [];
      for (const option of conflict.options) {
        const value = normalizeValues({ [conflict.field]: option?.value })[
          conflict.field as DraftField
        ];
        if (value !== undefined && Array.isArray(option.sources))
          options.push({
            value,
            sources: option.sources.filter(
              (id: unknown): id is string => typeof id === "string",
            ),
          });
      }
      if (options.length > 1)
        conflicts.push({ field: conflict.field, options });
    }
  return {
    version: 3,
    stage: saved.stage,
    values: normalizeValues(saved.values),
    conflicts,
  };
}

export function formDraftData(draft: WorkspaceFormDraft): FormData {
  const data = emptyFormData();
  for (const field of [...SHARED_FORM_FIELDS, ...STAGE_FORM_FIELDS]) {
    const value =
      draft.values[
        (STAGE_FORM_FIELDS as readonly string[]).includes(field)
          ? (`${draft.stage}.${field}` as DraftField)
          : (field as DraftField)
      ];
    if (value === undefined) continue;
    if (field.startsWith("people.")) {
      const [, role, key] = field.split(".");
      data.people[role as "head" | "internAdvisor"][key as "name" | "nip"] =
        value;
    } else Object.assign(data, { [field]: value });
  }
  return data;
}

/** Only changed supplements are stored; document-derived values never erase hidden shared inputs. */
export function updateFormDraft(
  draft: WorkspaceFormDraft,
  before: FormData,
  after: FormData,
): WorkspaceFormDraft {
  const values = { ...draft.values };
  const changed = new Set<DraftField>();
  for (const field of [...SHARED_FORM_FIELDS, ...STAGE_FORM_FIELDS]) {
    if (readValue(before, field) === readValue(after, field)) continue;
    const key = (STAGE_FORM_FIELDS as readonly string[]).includes(field)
      ? (`${draft.stage}.${field}` as DraftField)
      : (field as DraftField);
    values[key] = readValue(after, field);
    changed.add(key);
  }
  return {
    ...draft,
    values,
    conflicts: draft.conflicts.filter(
      (conflict) => !changed.has(conflict.field),
    ),
  };
}

export const formDraftSelection = (
  draft: WorkspaceFormDraft,
): FormSelection[] => {
  const value = draft.values[`${draft.stage}.choices`];
  return value === undefined
    ? defaultSelection(draft.stage)
    : (choices(JSON.parse(value), draft.stage) ??
        defaultSelection(draft.stage));
};

export function resolveDraftConflicts(
  draft: WorkspaceFormDraft,
  selected: Partial<Record<DraftField, string>>,
): WorkspaceFormDraft {
  const values = { ...draft.values };
  for (const conflict of draft.conflicts) {
    const value = selected[conflict.field];
    if (
      value !== undefined &&
      conflict.options.some((option) => option.value === value)
    )
      values[conflict.field] = value;
  }
  return { ...draft, values, conflicts: [] };
}
