import { Disclosure } from "@/components/ui/disclosure";
import { type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ParsedItalic, parseItalic } from "@/utils/parse-italic";
import { t } from "@/utils/lang";
import { displayDate, type FormData, type FormStage } from "@/forms/model";
import {
  GENERAL_FORM_FIELDS,
  IDENTITY_FORM_FIELDS,
  INTERNSHIP_FORM_FIELDS,
  SCHEDULE_FORM_FIELDS,
  facultyFormFields,
  formFieldValue,
  formFieldProblem,
  changeFormField,
  type FormField,
} from "@/forms/fields";

export type FormInputContext = { source: FormData; data: FormData };
type Row = {
  field: FormField;
  id: string;
  data: FormData;
  stage: FormStage;
  locked: boolean;
  stageLabel?: string;
};
const inputId = (id: string) => `forms-field-${id.replace(/\./g, "-")}`;
function Group({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {actions}
      </header>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** One data panel for the entire workspace package, independent of the previewed PDF. */
export function FormInputs({
  contexts,
  stage,
  documents,
  selectedDocument,
  internId,
  onInternChange,
  onChange,
  onReset,
}: {
  contexts: Record<FormStage, FormInputContext>;
  stage: FormStage;
  documents: HighTexDocument[];
  selectedDocument?: HighTexDocument;
  internId: string;
  onInternChange(id: string): void;
  onChange(stage: FormStage, data: FormData): void;
  onReset(): void;
}) {
  const active = contexts[stage];
  const rows = (
    fields: FormField[],
    kind: "identity" | "general" | "intern" | "faculty" | FormStage,
  ): Row[] =>
    fields.map((field) => {
      const fieldStage =
        kind === "proposal" || kind === "defense" ? kind : stage;
      const { data, source } = contexts[fieldStage];
      const external = kind === "identity" || kind === "faculty";
      const fromSource =
        Boolean(formFieldValue(source, field.key).trim()) &&
        !["program", "city"].includes(field.key);
      return {
        field,
        id: `${kind === "proposal" || kind === "defense" ? kind + "." : ""}${field.key}`,
        data,
        stage: fieldStage,
        locked: external || fromSource,
        stageLabel:
          kind === "proposal" || kind === "defense"
            ? t(`forms.${kind}`)
            : undefined,
      };
    });
  const identity = rows(IDENTITY_FORM_FIELDS, "identity");
  const general = rows(GENERAL_FORM_FIELDS, "general");
  const intern =
    stage === "proposal" ? rows(INTERNSHIP_FORM_FIELDS, "intern") : [];
  const schedule = rows(SCHEDULE_FORM_FIELDS, stage);
  const faculty = rows(facultyFormFields(active.data), "faculty");
  const all = [...identity, ...general, ...intern, ...schedule, ...faculty];
  const issues = all.flatMap((row) => {
    const problem = formFieldProblem(row.field, row.data);
    return problem ? [{ row, problem }] : [];
  });
  const missing = issues.filter((issue) => issue.problem === "missing").length;
  const invalid = issues.length - missing;
  const render = (row: Row) => {
    const { field, data, locked, stage: fieldStage } = row;
    const value = formFieldValue(data, field.key);
    const problem = formFieldProblem(field, data);
    const invalid = problem && problem !== "missing";
    const id = inputId(row.id);
    const label = field.label + (row.stageLabel ? ` · ${row.stageLabel}` : "");
    const isTitle = field.key === "title" || field.key === "internTitle";
    if (locked)
      return (
        <div
          key={row.id}
          data-form-field={row.id}
          className={`min-w-0 space-y-1.5 ${isTitle ? "sm:col-span-2" : ""}`}
        >
          <p className="text-xs text-muted-foreground">{field.label}</p>
          <p
            id={id}
            tabIndex={-1}
            aria-label={label}
            className="min-h-8 break-words rounded-sm text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {value ? (
              isTitle ? (
                <ParsedItalic text={value} />
              ) : field.type === "date" && !invalid ? (
                displayDate(value)
              ) : (
                value
              )
            ) : (
              <span className="text-muted-foreground">
                {t("forms.data_not_set")}
              </span>
            )}
          </p>
          {invalid && (
            <p className="text-xs text-destructive">
              {t(`forms.data_error_${problem}`)}
            </p>
          )}
        </div>
      );
    return (
      <div
        key={row.id}
        data-form-field={row.id}
        className="min-w-0 space-y-1.5"
      >
        <label htmlFor={id} className="text-xs font-medium">
          {field.label}
          {field.required && (
            <span className="ml-1 text-muted-foreground" aria-hidden="true">
              *
            </span>
          )}
        </label>
        <Input
          id={id}
          value={value}
          aria-label={label}
          aria-invalid={Boolean(invalid)}
          aria-describedby={invalid ? `${id}-hint` : undefined}
          placeholder={t(
            field.required ? "forms.data_required_empty" : "forms.optional",
          )}
          type={field.type ?? "text"}
          inputMode={
            field.key === "gpa"
              ? "decimal"
              : field.key === "credits"
                ? "numeric"
                : undefined
          }
          maxLength={isTitle ? 1000 : 300}
          onChange={(event) =>
            onChange(
              fieldStage,
              changeFormField(data, field.key, event.target.value),
            )
          }
        />
        {isTitle && value.includes("_") && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            <ParsedItalic text={value} />
          </p>
        )}
        {invalid && (
          <p id={`${id}-hint`} className="text-xs text-destructive">
            {t(`forms.data_error_${problem}`)}
            {field.type && ` (${value})`}
          </p>
        )}
      </div>
    );
  };
  return (
    <section
      className="space-y-5"
      data-tour="forms-inputs"
      data-form-data-panel
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{t("forms.data_title")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="size-3.5" />
            {t("forms.data_reset")}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="#forms-output">{t("forms.data_to_preview")}</a>
          </Button>
        </div>
      </header>
      <Disclosure
        key={invalid > 0 ? "invalid" : "valid"}
        defaultOpen={invalid > 0}
        className="rounded-lg border bg-muted/20 p-3"
        data-form-data-review
        aria-label={t("forms.data_review")}
        triggerClassName="cursor-pointer text-xs font-medium"
        label={
          <>
            {" "}
            {invalid
              ? t("forms.data_review_counts", { missing, invalid })
              : missing
                ? t("forms.data_empty_count", { count: missing })
                : t("forms.data_filled")}{" "}
          </>
        }
      >
        {issues.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {issues.map(({ row, problem }) => (
              <button
                key={row.id}
                type="button"
                className={`rounded-md border bg-background px-2 py-1 text-left text-xs hover:bg-muted ${problem !== "missing" ? "border-destructive/50 text-destructive" : "text-muted-foreground"}`}
                onClick={() => {
                  const field = document.getElementById(inputId(row.id));
                  field?.scrollIntoView({
                    block: "center",
                    behavior: "smooth",
                  });
                  field?.focus({ preventScroll: true });
                }}
              >
                {row.field.label}
              </button>
            ))}
          </div>
        )}
      </Disclosure>
      <Group
        title={t("forms.identity")}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/profile">{t("profile.title")}</Link>
            </Button>
            {selectedDocument && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  window.editor.open(selectedDocument.id, selectedDocument.file)
                }
              >
                {t("forms.data_open_document")}
              </Button>
            )}
          </div>
        }
      >
        {identity.map(render)}
      </Group>
      <Group title={t("forms.other_details")}>{general.map(render)}</Group>
      <Group title={`${t("forms.schedule")} · ${t("forms.optional")}`}>
        {schedule.map(render)}
      </Group>
      {stage === "proposal" && (
        <section className="space-y-4 rounded-xl border p-4 sm:p-5">
          <h3 className="text-sm font-semibold">
            {t("forms.data_internship")}
          </h3>
          <div className="max-w-xl space-y-1.5">
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
          <div className="grid gap-4 sm:grid-cols-2">{intern.map(render)}</div>
        </section>
      )}
      <Group title={t("forms.people")}>{faculty.map(render)}</Group>
    </section>
  );
}
