import { Disclosure } from "@/components/ui/disclosure";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { confirm } from "@/utils/confirm";
import { t } from "@/utils/lang";
import { parseItalic } from "@/utils/parse-italic";
import {
  resolveDraftConflicts,
  type DraftField,
  type LegacyFormDraft,
  type WorkspaceFormDraft,
} from "@/forms/draft";

const fieldNames: Record<string, string> = {
  program: "Program studi",
  city: "Kota penandatanganan",
  internTitle: "Judul laporan KP",
  internDate: "Tanggal persetujuan laporan KP",
  gpa: "IPK",
  credits: "Jumlah SKS",
  "people.head.name": "Nama Ketua Program Studi",
  "people.head.nip": "NIP/NIK Ketua Program Studi",
  "people.internAdvisor.name": "Nama Pembimbing KP",
  "people.internAdvisor.nip": "NIP/NIK Pembimbing KP",
  eventDate: "Tanggal kegiatan",
  eventTime: "Waktu kegiatan",
  eventPlace: "Tempat kegiatan",
  signDate: "Tanggal penandatanganan",
};
function fieldLabel(field: DraftField) {
  const [stage, key] = field.split(".");
  if (stage === "proposal" || stage === "defense")
    return `${t(`forms.${stage}`)} · ${key === "choices" ? t("forms.choose_forms") : fieldNames[key]}`;
  return field === "internId" ? t("forms.intern_document") : fieldNames[field];
}
export function FormDraftRecovery({
  draft,
  legacy,
  documents,
  onChange,
}: {
  draft: WorkspaceFormDraft;
  legacy: LegacyFormDraft[];
  documents: HighTexDocument[];
  onChange: Dispatch<SetStateAction<WorkspaceFormDraft>>;
}) {
  const [selected, setSelected] = useState<Partial<Record<DraftField, string>>>(
    {},
  );
  const [restore, setRestore] = useState("");
  if (!legacy.length && !draft.conflicts.length) return null;
  const documentName = (id: string) =>
    parseItalic(documents.find((document) => document.id === id)?.title ?? id)
      .map((part) => part.text)
      .join("");
  return (
    <div className="space-y-3 rounded-xl border p-4" data-form-recovery>
      {draft.conflicts.length > 0 && (
        <div
          className="space-y-4"
          role="region"
          aria-label={t("forms.migration_title")}
        >
          <p className="text-sm font-semibold">{t("forms.migration_title")}</p>
          <p className="text-xs text-muted-foreground">
            {t("forms.migration_hint")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {draft.conflicts.map((conflict) => (
              <label
                key={conflict.field}
                className="space-y-1.5 text-xs font-medium"
              >
                <span>{fieldLabel(conflict.field)}</span>
                <NativeSelect
                  value={selected[conflict.field] ?? ""}
                  onChange={(event) =>
                    setSelected((state) => ({
                      ...state,
                      [conflict.field]: event.target.value,
                    }))
                  }
                >
                  <option value="">{t("forms.choose_legacy_value")}</option>
                  {conflict.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {conflict.field === "internId"
                        ? documentName(option.value)
                        : conflict.field.endsWith(".choices")
                          ? JSON.parse(option.value)
                              .map((item: { code: string }) => item.code)
                              .join(", ") || t("forms.no_selection")
                          : option.value}{" "}
                      — {option.sources.map(documentName).join(", ")}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={draft.conflicts.some(
                (conflict) => !selected[conflict.field],
              )}
              onClick={() =>
                onChange((state) => resolveDraftConflicts(state, selected))
              }
            >
              {t("forms.apply_legacy_values")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onChange((state) => resolveDraftConflicts(state, {}))
              }
            >
              {t("forms.skip_legacy_conflicts")}
            </Button>
          </div>
        </div>
      )}
      {legacy.length > 0 && (
        <Disclosure
          triggerClassName="cursor-pointer text-xs font-medium"
          label={t("forms.recover_legacy")}
        >
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              {t("forms.legacy_preserved")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                aria-label={t("forms.recover_legacy")}
                value={restore}
                onChange={(event) => setRestore(event.target.value)}
                className="min-w-0 flex-1"
              >
                <option value="">{t("forms.choose_legacy_draft")}</option>
                {legacy.map((item, index) => (
                  <option
                    key={`${item.documentId}:${item.stage}`}
                    value={String(index)}
                  >
                    {documentName(item.documentId)} · {t(`forms.${item.stage}`)}
                  </option>
                ))}
              </NativeSelect>
              <Button
                type="button"
                variant="outline"
                disabled={restore === ""}
                onClick={() =>
                  void (async () => {
                    if (
                      !(await confirm({
                        title: t("forms.restore_confirm"),
                        desc: t("forms.legacy_preserved"),
                      }))
                    )
                      return;
                    const old = legacy[Number(restore)];
                    if (old)
                      onChange((state) => ({
                        ...state,
                        stage: old.stage,
                        values: { ...state.values, ...old.values },
                        conflicts: state.conflicts.filter(
                          (conflict) =>
                            old.values[conflict.field] === undefined,
                        ),
                      }));
                  })()
                }
              >
                {t("forms.restore_legacy")}
              </Button>
            </div>
          </div>
        </Disclosure>
      )}
    </div>
  );
}
