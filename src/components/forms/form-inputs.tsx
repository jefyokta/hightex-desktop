import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ParsedItalic, parseItalic } from "@/utils/parse-italic";
import { t } from "@/utils/lang";
import {
  committee,
  formRecipients,
  PERSON_LABELS,
  type FormCode,
  type FormData,
  type PersonKey,
} from "@/forms/model";

function Field({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  italic = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  type?: string;
  multiline?: boolean;
  italic?: boolean;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      {multiline ? (
        <Textarea
          id={id}
          aria-label={label}
          value={value}
          required={required}
          maxLength={1000}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          aria-label={label}
          type={type}
          value={value}
          required={required}
          maxLength={300}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {italic && value && (
        <p className="text-xs text-muted-foreground">
          <ParsedItalic text={value} />
        </p>
      )}
    </div>
  );
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}
function rolesFor(code: FormCode, data: FormData): PersonKey[] {
  if (["TA01", "TA07", "TA08", "TA09", "TA10"].includes(code))
    return [
      ...committee(data),
      ...(["TA09", "TA10"].includes(code) ? ["head" as const] : []),
    ];
  if (code === "B1") return ["internAdvisor", "head"];
  if (code === "TA04") return ["chair"];
  return formRecipients(code, data);
}

/** All staff-owned fields remain on paper. Supplemental administration is
 * optional and progressively disclosed for the currently viewed form only. */
export function FormInputs({
  code,
  data,
  source,
  documents,
  internId,
  onInternChange,
  onChange,
}: {
  code: FormCode;
  data: FormData;
  source: FormData;
  documents: HighTexDocument[];
  internId: string;
  onInternChange(id: string): void;
  onChange(data: FormData): void;
}) {
  const set = (key: keyof FormData, value: string) =>
    onChange({ ...data, [key]: value });
  const field = (
    key: keyof FormData,
    label: string,
    type = "text",
    required = false,
  ) =>
    source[key] && !["program", "city"].includes(key) ? null : (
      <Field
        key={key}
        label={label}
        value={String(data[key] ?? "")}
        onChange={(value) => set(key, value)}
        type={type}
        required={required}
        multiline={key === "title" || key === "internTitle"}
        italic={key === "title" || key === "internTitle"}
      />
    );
  const missingIdentity =
    !source.name.trim() || !source.nim.trim() || !source.title.trim();
  const missingPeople = rolesFor(code, data).filter(
    (role) =>
      !source.people[role].name.trim() || !source.people[role].nip.trim(),
  );
  const schedule = ["TA01", "TA07", "TA08"].includes(code);
  const signing = !["B0", "B2"].includes(code);
  return (
    <div className="space-y-3">
      {missingIdentity && (
        <div className="rounded-lg border p-4">
          <Group title={t("forms.complete_missing")}>
            {field("name", "Nama mahasiswa", "text", true)}
            {field("nim", "NIM", "text", true)}
            {field("title", "Judul tugas akhir", "text", true)}
          </Group>
        </div>
      )}
      <details
        className="rounded-lg border"
        key={code}
        data-form-administration
      >
        <summary className="cursor-pointer px-4 py-3 text-xs font-medium">
          {t("forms.optional_administration")}
        </summary>
        <div className="space-y-5 border-t p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("forms.optional_administration_hint")}
          </p>
          {schedule && (
            <Group title={t("forms.schedule")}>
              {field("eventDate", "Tanggal kegiatan", "date")}
              {field("eventTime", "Waktu kegiatan", "time")}
              {field("eventPlace", "Tempat kegiatan")}
            </Group>
          )}
          {signing && (
            <Group title={t("forms.signing")}>
              {field("signDate", "Tanggal penandatanganan", "date")}
              {field("city", "Kota penandatanganan")}
            </Group>
          )}
          {code === "B1" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="forms-intern-document"
                  className="text-xs font-medium"
                >
                  {t("forms.intern_document")}
                </label>
                <NativeSelect
                  id="forms-intern-document"
                  value={internId}
                  onChange={(event) => onInternChange(event.target.value)}
                >
                  <option value="">{t("forms.manual_intern")}</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {parseItalic(doc.title)
                        .map((part) => part.text)
                        .join("")}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Group title="Data laporan KP">
                {field("internTitle", "Judul laporan KP")}
                {field("internDate", "Tanggal persetujuan laporan KP", "date")}
                {field("gpa", "IPK")}
                {field("credits", "Jumlah SKS")}
              </Group>
            </div>
          )}
          {missingPeople.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs font-medium">
                {t("forms.missing_lecturers")}
              </summary>
              <div className="mt-4 space-y-4">
                {missingPeople.map((role) => (
                  <Group key={role} title={PERSON_LABELS[role]}>
                    {(["name", "nip"] as const)
                      .filter((key) => !source.people[role][key].trim())
                      .map((key) => (
                        <Field
                          key={key}
                          label={`${key === "name" ? "Nama" : "NIP/NIK"} ${PERSON_LABELS[role]}`}
                          value={data.people[role][key]}
                          onChange={(value) =>
                            onChange({
                              ...data,
                              people: {
                                ...data.people,
                                [role]: { ...data.people[role], [key]: value },
                              },
                            })
                          }
                        />
                      ))}
                  </Group>
                ))}
              </div>
            </details>
          )}
          {["B0", "B1", "B3", "TA02", "TA03", "TA04", "TA09", "TA10"].includes(
            code,
          ) && (
            <Group title={t("forms.other_details")}>
              {field("program", "Program studi")}
            </Group>
          )}
        </div>
      </details>
    </div>
  );
}
