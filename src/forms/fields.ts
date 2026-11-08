import {
  FORM_CATALOG,
  PERSON_LABELS,
  committee,
  formRecipients,
  type FormCode,
  type FormData,
  type FormStage,
  type PersonKey,
} from "./model";

export type FormFieldKey =
  | Exclude<keyof FormData, "people" | "secondAdvisor">
  | `people.${PersonKey}.${"name" | "nip"}`;
export type FormField = {
  key: FormFieldKey;
  label: string;
  type?: "date" | "time";
  codes: FormCode[];
  required?: boolean;
};
const all = FORM_CATALOG.map((form) => form.code);
const signing = all.filter((code) => !["B0", "B2", "TA01"].includes(code));
export const GENERAL_FORM_FIELDS: FormField[] = [
  {
    key: "program",
    label: "Program studi",
    codes: ["B0", "B1", "B3", "TA02", "TA03", "TA04", "TA09", "TA10"],
  },
  { key: "city", label: "Kota penandatanganan", codes: signing },
  {
    key: "people.head.name",
    label: "Nama Ketua Program Studi",
    codes: ["B1", "TA09", "TA10"],
  },
  {
    key: "people.head.nip",
    label: "NIP/NIK Ketua Program Studi",
    codes: ["B1", "TA09", "TA10"],
  },
];
export const IDENTITY_FORM_FIELDS: FormField[] = [
  { key: "name", label: "Nama mahasiswa", codes: all, required: true },
  { key: "nim", label: "NIM", codes: all, required: true },
  {
    key: "title",
    label: "Judul tugas akhir",
    codes: all.filter((code) => !["B0", "B1"].includes(code)),
    required: true,
  },
];
export const INTERNSHIP_FORM_FIELDS: FormField[] = [
  { key: "internTitle", label: "Judul laporan KP", codes: ["B1"] },
  {
    key: "internDate",
    label: "Tanggal persetujuan laporan KP",
    type: "date",
    codes: ["B1"],
  },
  { key: "gpa", label: "IPK", codes: ["B1"] },
  { key: "credits", label: "Jumlah SKS", codes: ["B1"] },
  {
    key: "people.internAdvisor.name",
    label: "Nama Pembimbing KP",
    codes: ["B1"],
  },
  {
    key: "people.internAdvisor.nip",
    label: "NIP/NIK Pembimbing KP",
    codes: ["B1"],
  },
];
export const SCHEDULE_FORM_FIELDS: FormField[] = [
  {
    key: "eventDate",
    label: "Tanggal kegiatan",
    type: "date",
    codes: ["TA01", "TA07", "TA08"],
  },
  {
    key: "eventTime",
    label: "Waktu kegiatan",
    type: "time",
    codes: ["TA01", "TA07", "TA08"],
  },
  {
    key: "eventPlace",
    label: "Tempat kegiatan",
    codes: ["TA01", "TA07", "TA08"],
  },
  {
    key: "signDate",
    label: "Tanggal penandatanganan",
    type: "date",
    codes: signing,
  },
];
export function facultyFormFields(data: FormData): FormField[] {
  return committee(data).flatMap((role) =>
    (["name", "nip"] as const).map((key) => ({
      key: `people.${role}.${key}` as FormFieldKey,
      label: `${key === "name" ? "Nama" : "NIP/NIK"} ${PERSON_LABELS[role]}`,
      codes: all.filter(
        (code) =>
          ["TA01", "TA07", "TA08", "TA09", "TA10"].includes(code) ||
          (code === "TA04" && role === "chair") ||
          formRecipients(code, data).includes(role),
      ),
    })),
  );
}
export function formFieldValue(data: FormData, key: FormFieldKey): string {
  if (!key.startsWith("people."))
    return String(data[key as keyof FormData] ?? "");
  const [, role, field] = key.split(".");
  return data.people[role as PersonKey][field as "name" | "nip"];
}
export function changeFormField(
  data: FormData,
  key: FormFieldKey,
  value: string,
): FormData {
  if (!key.startsWith("people.")) return { ...data, [key]: value };
  const [, role, field] = key.split(".");
  return {
    ...data,
    people: {
      ...data.people,
      [role]: { ...data.people[role as PersonKey], [field]: value },
    },
  };
}

export function formFieldProblem(
  field: FormField,
  data: FormData,
): "missing" | "gpa" | "credits" | "date" | "time" | undefined {
  const value = formFieldValue(data, field.key).trim();
  if (!value) return "missing";
  if (
    field.key === "gpa" &&
    (!/^\d+(?:[.,]\d+)?$/.test(value) || Number(value.replace(",", ".")) > 4)
  )
    return "gpa";
  if (field.key === "credits" && !/^\d+$/.test(value)) return "credits";
  if (field.type === "time" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))
    return "time";
  if (field.type === "date") {
    const date = new Date(`${value}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      return "date";
  }
}

/** Review the complete selected package; never depend on which PDF is being previewed. */
export function formPackageProblems(
  data: FormData,
  stage: FormStage,
  codes: FormCode[],
) {
  const fields = [
    ...IDENTITY_FORM_FIELDS,
    ...GENERAL_FORM_FIELDS,
    ...INTERNSHIP_FORM_FIELDS,
    ...SCHEDULE_FORM_FIELDS,
    ...facultyFormFields(data),
  ];
  const allowed = new Set(
    FORM_CATALOG.filter(
      (form) => form.stages.includes(stage) && codes.includes(form.code),
    ).map((form) => form.code),
  );
  return fields
    .filter(
      (field) =>
        field.required || field.codes.some((code) => allowed.has(code)),
    )
    .flatMap((field) => {
      const problem = formFieldProblem(field, data);
      return problem ? [{ field, problem }] : [];
    });
}
