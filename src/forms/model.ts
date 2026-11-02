import { documentCommittee } from "../utils/document-committee";

export type FormStage = "proposal" | "defense";
export type FormCode =
  | "B0"
  | "B1"
  | "B2"
  | "B3"
  | "TA01"
  | "TA02"
  | "TA03"
  | "TA04"
  | "TA07"
  | "TA08"
  | "TA09"
  | "TA10";
export type PersonKey =
  | "advisor1"
  | "advisor2"
  | "examiner1"
  | "examiner2"
  | "chair"
  | "head"
  | "internAdvisor";
export type FormPerson = AcademicPerson;
// Only supplemental administrative data. Assessment, comments, revisions and
// signatures belong to faculty and are deliberately absent from this model.
export interface FormAdditionalData {
  program: string;
  eventDate: string;
  eventTime: string;
  eventPlace: string;
  signDate: string;
  city: string;
  internTitle: string;
  internDate: string;
  gpa: string;
  credits: string;
  people: Record<PersonKey, FormPerson>;
}
export type FormData = Pick<AuthorProfile, "name" | "nim" | "secondAdvisor"> &
  Pick<HighTexDocument, "title"> &
  FormAdditionalData;
export interface FormSelection {
  code: FormCode;
}
export interface FormPrintInput {
  documentId: string;
  stage: FormStage;
  data: FormData;
  selection: FormSelection[];
}
export interface FormSheet {
  code: FormCode;
  recipient?: PersonKey;
}
export interface FormFile extends FormSheet {
  filename: string;
  label: string;
  pages: number;
}
export function buildFormFiles(input: FormPrintInput): FormFile[] {
  return buildFormSheets(input).map((sheet) => ({
    ...sheet,
    filename: `${formLabel(sheet.code)}${sheet.recipient ? `-${PERSON_LABELS[sheet.recipient].replace(/[ /]+/g, "-")}` : ""}.pdf`,
    label: `${formLabel(sheet.code)}${sheet.recipient ? ` · ${PERSON_LABELS[sheet.recipient]}` : ""}`,
    pages: 1,
  }));
}
export const PERSON_LABELS: Record<PersonKey, string> = {
  advisor1: "Pembimbing I",
  advisor2: "Pembimbing II",
  examiner1: "Penguji I",
  examiner2: "Penguji II",
  chair: "Ketua Seminar/Sidang",
  head: "Ketua Program Studi",
  internAdvisor: "Pembimbing KP",
};
export const ADVISORS: PersonKey[] = ["advisor1", "advisor2"];
export const ASSESSORS: PersonKey[] = [...ADVISORS, "examiner1", "examiner2"];
export const COMMITTEE: PersonKey[] = ["chair", ...ASSESSORS];
export const FORM_CATALOG: {
  code: FormCode;
  title: string;
  stages: FormStage[];
  recipients?: PersonKey[];
}[] = [
  {
    code: "B0",
    title: "Bukti Menghadiri Seminar Proposal",
    stages: ["proposal"],
  },
  {
    code: "B1",
    title: "Bukti Selesai Laporan Kerja Praktek",
    stages: ["proposal"],
  },
  {
    code: "B2",
    title: "Kartu Bimbingan Tugas Akhir",
    stages: ["proposal", "defense"],
    recipients: ADVISORS,
  },
  {
    code: "B3",
    title: "Bukti Perbaikan Laporan",
    stages: ["proposal", "defense"],
    recipients: ASSESSORS,
  },
  {
    code: "TA01",
    title: "Daftar Hadir/Presensi",
    stages: ["proposal", "defense"],
  },
  {
    code: "TA02",
    title: "Penilaian Pembimbing",
    stages: ["proposal", "defense"],
    recipients: ADVISORS,
  },
  {
    code: "TA03",
    title: "Daftar Penilaian Ujian",
    stages: ["proposal", "defense"],
    recipients: ASSESSORS,
  },
  { code: "TA04", title: "Penilaian Ketua Sidang", stages: ["defense"] },
  {
    code: "TA07",
    title: "Berita Acara Seminar/Sidang",
    stages: ["proposal", "defense"],
  },
  {
    code: "TA08",
    title: "Rekapitulasi Nilai Proposal/Sidang",
    stages: ["proposal", "defense"],
  },
  {
    code: "TA09",
    title: "Nilai Tugas Akhir 1 (Proposal)",
    stages: ["proposal"],
  },
  { code: "TA10", title: "Nilai Tugas Akhir 2 (Sidang)", stages: ["defense"] },
];
export const formLabel = (code: FormCode) =>
  code.startsWith("TA") ? `TA-${code.slice(2)}` : code;
export const formTitle = (code: FormCode) =>
  FORM_CATALOG.find((form) => form.code === code)!.title;
export const hasSecondAdvisor = (data: Pick<AuthorProfile, "secondAdvisor">) =>
  Boolean(data.secondAdvisor);
export const committee = (data: FormData) =>
  COMMITTEE.filter((key) => key !== "advisor2" || hasSecondAdvisor(data));
export const formRecipients = (code: FormCode, data: FormData): PersonKey[] =>
  FORM_CATALOG.find((form) => form.code === code)?.recipients?.filter(
    (key) => key !== "advisor2" || hasSecondAdvisor(data),
  ) ?? [];
export const defaultSelection = (stage: FormStage): FormSelection[] =>
  FORM_CATALOG.filter((form) => form.stages.includes(stage)).map((form) => ({
    code: form.code,
  }));
export const buildFormSheets = (input: FormPrintInput): FormSheet[] =>
  FORM_CATALOG.filter(
    (form) =>
      form.stages.includes(input.stage) &&
      input.selection.some((choice) => choice.code === form.code),
  ).flatMap((form) =>
    form.recipients
      ? formRecipients(form.code, input.data).map((recipient) => ({
          code: form.code,
          recipient,
        }))
      : [{ code: form.code }],
  );

export function emptyFormData(): FormData {
  return {
    name: "",
    nim: "",
    title: "",
    program: "Sistem Informasi",
    city: "Pekanbaru",
    eventDate: "",
    eventTime: "",
    eventPlace: "",
    signDate: "",
    internTitle: "",
    internDate: "",
    gpa: "",
    credits: "",
    people: Object.fromEntries(
      Object.keys(PERSON_LABELS).map((key) => [key, { name: "", nip: "" }]),
    ) as FormData["people"],
  };
}

/** Legacy documents may use the existing local default profile. A document's
 * own author profile always remains authoritative, including intentionally
 * missing fields; data from different authors must never be mixed. */
export function documentFormData(
  document: HighTexDocument,
  intern?: HighTexDocument,
  stage: FormStage = "proposal",
  defaultProfile?: Profile,
): FormData {
  const data = emptyFormData();
  const profile = document.profile ?? defaultProfile;
  const config = document.config ?? {};
  data.name = profile?.name ?? "";
  data.nim = profile?.nim ?? "";
  data.title = document.title;
  data.secondAdvisor = profile?.secondAdvisor;
  data.people.advisor1 = {
    name: profile?.advisorName ?? "",
    nip: profile?.advisorNip ?? "",
  };
  data.people.advisor2 = {
    name: profile?.secondAdvisor?.name ?? "",
    nip: profile?.secondAdvisor?.nip ?? "",
  };
  const committee = documentCommittee({ ...document, profile });
  for (const role of ["examiner1", "examiner2", "chair"] as const) {
    data.people[role] = {
      name: committee[role]?.name ?? "",
      nip: committee[role]?.nip ?? "",
    };
  }
  data.people.head = {
    name: config.kaprodi?.name ?? "",
    nip: config.kaprodi?.nip ?? "",
  };
  data.eventDate = dateInput(
    stage === "proposal" ? config.consentDate : config.validityDate,
  );
  data.signDate = data.eventDate;
  if (intern) {
    data.internTitle = intern.title;
    data.people.internAdvisor = {
      name: intern.profile?.advisorName ?? "",
      nip: intern.profile?.advisorNip ?? "",
    };
    data.internDate = dateInput(
      intern.config?.intern?.validity ?? intern.config?.validityDate,
    );
  }
  return data;
}
export function dateInput(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))
    return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function displayDate(value: string, weekday = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(weekday ? { weekday: "long" as const } : {}),
  }).format(new Date(`${value}T12:00:00`));
}
export function resolveFormData(
  source: FormData,
  draft?: Partial<FormData>,
): FormData {
  const data = emptyFormData();
  // Whitelist fields so old drafts cannot bring back assessment/revision data.
  for (const key of Object.keys(data) as (keyof FormData)[]) {
    if (key === "people") continue;
    const saved = draft?.[key];
    Object.assign(data, {
      [key]: typeof saved === "string" ? saved : data[key],
    });
    if (
      typeof source[key] === "string" &&
      String(source[key]).trim() &&
      !["program", "city"].includes(key)
    )
      Object.assign(data, { [key]: source[key] });
  }
  for (const key of Object.keys(PERSON_LABELS) as PersonKey[]) {
    data.people[key] = {
      name: source.people[key].name.trim()
        ? source.people[key].name
        : (draft?.people?.[key]?.name ?? ""),
      nip: source.people[key].nip.trim()
        ? source.people[key].nip
        : (draft?.people?.[key]?.nip ?? ""),
    };
  }
  data.secondAdvisor = source.secondAdvisor;
  if (!source.secondAdvisor) data.people.advisor2 = { name: "", nip: "" };
  return data;
}
export function validatePrintInput(input: FormPrintInput): boolean {
  try {
    return (
      Boolean(input) &&
      typeof input.documentId === "string" &&
      input.documentId.length <= 256 &&
      ["proposal", "defense"].includes(input.stage) &&
      Array.isArray(input.selection) &&
      input.selection.length <= FORM_CATALOG.length &&
      input.selection.every((item) =>
        FORM_CATALOG.some((form) => form.code === item.code),
      ) &&
      JSON.stringify(input).length <= 2_000_000 &&
      Object.keys(emptyFormData())
        .filter((key) => key !== "people")
        .every(
          (key) => typeof input.data[key as keyof FormData] === "string",
        ) &&
      Object.keys(PERSON_LABELS).every(
        (key) =>
          typeof input.data.people[key as PersonKey]?.name === "string" &&
          typeof input.data.people[key as PersonKey]?.nip === "string",
      )
    );
  } catch {
    return false;
  }
}
